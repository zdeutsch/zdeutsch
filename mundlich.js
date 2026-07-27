const DATA_URL = "database/mundlich.json";
const PROGRESS_KEY = "zdeutsch.mundlich.b1.progress.v1";
const PART_LABELS = {
  "teil-1": "Einander kennenlernen",
  "teil-2": "Über ein Thema sprechen",
  "teil-3": "Gemeinsam etwas planen"
};
const PART_SUBTITLES = {
  "teil-1": "Vorstellen & nachfragen",
  "teil-2": "Positionen austauschen",
  "teil-3": "Vorschlagen & einigen"
};
const LANGUAGE_BANKS = {
  "teil-2": [
    "In dem Text geht es um ...",
    "Person A ist der Meinung, dass ...",
    "Ich sehe das ähnlich / anders, weil ...",
    "Welche Erfahrungen hast du damit?",
    "Da stimme ich dir zu, aber ...",
    "Zusammenfassend würde ich sagen ..."
  ],
  "teil-3": [
    "Ich schlage vor, dass ...",
    "Das klingt gut. Wir könnten auch ...",
    "Da bin ich nicht ganz einverstanden, weil ...",
    "Wer übernimmt welche Aufgabe?",
    "Wann und wo treffen wir uns?",
    "Dann einigen wir uns auf ..."
  ]
};

const elements = {
  partTabs: document.getElementById("part-tabs"),
  libraryTitle: document.getElementById("library-title"),
  randomTopic: document.getElementById("random-topic"),
  searchWrap: document.getElementById("topic-search-wrap"),
  search: document.getElementById("topic-search"),
  topicList: document.getElementById("topic-list"),
  topicResultStatus: document.getElementById("topic-result-status"),
  practicePanel: document.getElementById("practice-panel"),
  timerToggle: document.getElementById("timer-toggle"),
  timerReset: document.getElementById("timer-reset"),
  timerValue: document.getElementById("timer-value"),
  discussionCount: document.getElementById("discussion-count"),
  planningCount: document.getElementById("planning-count"),
  toast: document.getElementById("toast")
};

const state = {
  database: null,
  level: "b1",
  partKey: "teil-1",
  selectedTopics: {},
  search: "",
  followUpIndex: 0,
  progress: loadProgress(),
  timer: {
    durationSeconds: 180,
    remainingSeconds: 180,
    endAt: null,
    intervalId: null,
    running: false
  }
};

function loadProgress() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRESS_KEY) || "{}");
    return {
      prepared: Array.isArray(parsed.prepared) ? parsed.prepared : [],
      done: {
        "teil-2": Array.isArray(parsed.done?.["teil-2"]) ? parsed.done["teil-2"] : [],
        "teil-3": Array.isArray(parsed.done?.["teil-3"]) ? parsed.done["teil-3"] : []
      }
    };
  } catch (error) {
    return {
      prepared: [],
      done: { "teil-2": [], "teil-3": [] }
    };
  }
}

function saveProgress() {
  window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(state.progress));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getLevel() {
  return state.database?.levels?.[state.level] || null;
}

function getPart(partKey = state.partKey) {
  return getLevel()?.parts?.[partKey] || null;
}

function getTopics(partKey = state.partKey) {
  return getPart(partKey)?.topics || [];
}

function getFilteredTopics() {
  const query = normalize(state.search);
  if (!query) {
    return getTopics();
  }
  return getTopics().filter((topic) => {
    return normalize([
      topic.title,
      topic.prompt,
      topic.personA?.opinion,
      topic.personB?.opinion,
      ...(topic.notes || [])
    ].filter(Boolean).join(" ")).includes(query);
  });
}

function getSelectedTopic() {
  const topics = getFilteredTopics();
  if (!topics.length) {
    return null;
  }
  const selectedId = state.selectedTopics[state.partKey];
  return topics.find((topic) => topic.id === selectedId) || topics[0];
}

function getCompletedSet(partKey) {
  if (partKey === "teil-1") {
    return new Set(state.progress.prepared);
  }
  return new Set(state.progress.done[partKey] || []);
}

function getProgressCount(partKey) {
  return getCompletedSet(partKey).size;
}

function getTotalCount(partKey) {
  const part = getPart(partKey);
  return partKey === "teil-1" ? (part?.prompts || []).length : (part?.topics || []).length;
}

function showToast(message) {
  window.clearTimeout(showToast.timeoutId);
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  showToast.timeoutId = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2400);
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function syncTimerDisplay() {
  elements.timerValue.textContent = formatTime(state.timer.remainingSeconds);
  elements.timerToggle.classList.toggle("is-running", state.timer.running);
  elements.timerToggle.setAttribute("aria-label", state.timer.running ? "Timer pausieren" : "Timer starten");
}

function stopTimer() {
  window.clearInterval(state.timer.intervalId);
  state.timer.intervalId = null;
  state.timer.endAt = null;
  state.timer.running = false;
  syncTimerDisplay();
}

function resetTimer() {
  stopTimer();
  const durationMinutes = Number(getPart()?.durationMinutes || 3);
  state.timer.durationSeconds = durationMinutes * 60;
  state.timer.remainingSeconds = state.timer.durationSeconds;
  syncTimerDisplay();
}

function updateTimer() {
  if (!state.timer.running || !state.timer.endAt) {
    return;
  }
  state.timer.remainingSeconds = Math.max(0, Math.ceil((state.timer.endAt - Date.now()) / 1000));
  syncTimerDisplay();
  if (state.timer.remainingSeconds === 0) {
    stopTimer();
    showToast("Zeit abgelaufen. Schließen Sie Ihren Gedanken noch in einem Satz ab.");
  }
}

function toggleTimer() {
  if (state.timer.running) {
    updateTimer();
    stopTimer();
    return;
  }
  if (state.timer.remainingSeconds <= 0) {
    resetTimer();
  }
  state.timer.running = true;
  state.timer.endAt = Date.now() + (state.timer.remainingSeconds * 1000);
  state.timer.intervalId = window.setInterval(updateTimer, 250);
  syncTimerDisplay();
}

function setPart(partKey) {
  if (!getLevel()?.parts?.[partKey]) {
    return;
  }
  state.partKey = partKey;
  state.search = "";
  elements.search.value = "";
  window.history.replaceState(null, "", `?level=${state.level}&part=${partKey}`);
  resetTimer();
  render();
}

function renderPartTabs() {
  const level = getLevel();
  elements.partTabs.innerHTML = level.partOrder.map((partKey, index) => {
    const completed = getProgressCount(partKey);
    const total = getTotalCount(partKey);
    return `
      <button class="oral-part-tab${partKey === state.partKey ? " is-active" : ""}" type="button" data-part="${partKey}" aria-pressed="${partKey === state.partKey}">
        <span class="oral-part-number">0${index + 1}</span>
        <span>
          <strong>${escapeHtml(level.parts[partKey].shortTitle || PART_LABELS[partKey])}</strong>
          <small>${escapeHtml(PART_SUBTITLES[partKey])}</small>
        </span>
        <span class="oral-part-progress">${completed}/${total}</span>
      </button>
    `;
  }).join("");
}

function renderTopicList() {
  const part = getPart();
  elements.libraryTitle.textContent = part?.shortTitle || PART_LABELS[state.partKey];
  const isIntro = state.partKey === "teil-1";
  elements.searchWrap.classList.toggle("is-hidden", isIntro);
  elements.randomTopic.classList.toggle("is-hidden", isIntro);

  if (isIntro) {
    const prepared = getCompletedSet("teil-1");
    elements.topicList.innerHTML = part.prompts.map((prompt, index) => `
      <button class="oral-topic-button${prepared.has(index) ? " is-done" : ""}" type="button" data-prompt-index="${index}">
        <span class="oral-topic-index">${String(index + 1).padStart(2, "0")}</span>
        <span class="oral-topic-name">${escapeHtml(prompt)}</span>
        <span class="oral-topic-check" aria-hidden="true">✓</span>
      </button>
    `).join("");
    elements.topicResultStatus.textContent = `${prepared.size} von ${part.prompts.length} Punkten vorbereitet`;
    return;
  }

  const topics = getFilteredTopics();
  const selected = getSelectedTopic();
  if (selected) {
    state.selectedTopics[state.partKey] = selected.id;
  }
  const completed = getCompletedSet(state.partKey);
  elements.topicList.innerHTML = topics.map((topic, index) => `
    <button class="oral-topic-button${topic.id === selected?.id ? " is-active" : ""}${completed.has(topic.id) ? " is-done" : ""}" type="button" data-topic-id="${escapeHtml(topic.id)}"${topic.id === selected?.id ? " aria-current=\"true\"" : ""}>
      <span class="oral-topic-index">${String(index + 1).padStart(2, "0")}</span>
      <span class="oral-topic-name">${escapeHtml(topic.title)}</span>
      <span class="oral-topic-check" aria-hidden="true">✓</span>
    </button>
  `).join("");
  elements.topicResultStatus.textContent = topics.length
    ? `${topics.length} ${topics.length === 1 ? "Thema" : "Themen"} · ${completed.size} geübt`
    : "Kein passendes Thema gefunden";
}

function renderLanguageBank(partKey) {
  const phrases = LANGUAGE_BANKS[partKey] || [];
  if (!phrases.length) {
    return "";
  }
  return `
    <section class="oral-language-bank">
      <h3>Redemittel für den Gesprächsfluss</h3>
      <ul class="oral-phrase-grid">
        ${phrases.map((phrase) => `<li>${escapeHtml(phrase)}</li>`).join("")}
      </ul>
    </section>
  `;
}

function renderPracticeFooter(topic) {
  const completed = getCompletedSet(state.partKey);
  const isDone = completed.has(topic.id);
  return `
    <footer class="oral-practice-footer">
      <p>Sprechen Sie frei. Nutzen Sie die Stichpunkte nur als Leitplanken.</p>
      <button class="oral-complete-button${isDone ? " is-done" : ""}" type="button" data-action="toggle-complete" data-topic-id="${escapeHtml(topic.id)}">
        ${isDone ? "Als geübt markiert ✓" : "Als geübt markieren"}
      </button>
    </footer>
  `;
}

function renderPart1() {
  const part = getPart();
  const prepared = getCompletedSet("teil-1");
  const followUp = part.followUps[state.followUpIndex % part.followUps.length];
  elements.practicePanel.innerHTML = `
    <header class="oral-practice-head">
      <div>
        <span class="oral-practice-label">Teil 1 · Kennenlernen</span>
        <h2>Ihre Geschichte in klaren Stationen</h2>
      </div>
      <span class="oral-time-chip">${part.durationMinutes} Minuten</span>
    </header>
    <p class="oral-instruction">${escapeHtml(part.instruction)}</p>
    <section class="oral-checklist-card">
      <h3>Persönliche Stichpunkte vorbereiten</h3>
      <div class="oral-checklist">
        ${part.prompts.map((prompt, index) => `
          <button class="oral-checklist-item${prepared.has(index) ? " is-ready" : ""}" type="button" data-action="toggle-prompt" data-prompt-index="${index}">
            <span class="oral-check-icon" aria-hidden="true">✓</span>
            <span>${escapeHtml(prompt)}</span>
          </button>
        `).join("")}
      </div>
    </section>
    <section class="oral-follow-up">
      <span class="oral-follow-up-mark" aria-hidden="true">?</span>
      <span>
        <small>Spontane Rückfrage</small>
        <strong>${escapeHtml(followUp)}</strong>
      </span>
      <button class="oral-secondary-button" type="button" data-action="new-follow-up">Neue Frage</button>
    </section>
    <section class="oral-language-bank">
      <h3>Ein natürlicher Einstieg</h3>
      <ul class="oral-phrase-grid">
        <li>Ich heiße ... und komme ursprünglich aus ...</li>
        <li>Zurzeit wohne ich ...</li>
        <li>Beruflich beschäftige ich mich mit ...</li>
        <li>In meiner Freizeit ist mir ... besonders wichtig.</li>
      </ul>
    </section>
  `;
}

function renderPart2(topic) {
  const part = getPart();
  elements.practicePanel.innerHTML = `
    <header class="oral-practice-head">
      <div>
        <span class="oral-practice-label">Teil 2 · Thema ${escapeHtml(topic.id.split("-").slice(-1)[0])}</span>
        <h2>${escapeHtml(topic.title)}</h2>
      </div>
      <span class="oral-time-chip">${part.durationMinutes} Minuten</span>
    </header>
    <p class="oral-instruction">${escapeHtml(part.instruction)}</p>
    <div class="oral-position-grid">
      <section class="oral-position-card">
        <span class="oral-position-tag">Position A</span>
        <p class="oral-position-speaker">${escapeHtml(topic.personA?.speaker || "Person A")}</p>
        <p class="oral-position-opinion">${escapeHtml(topic.personA?.opinion)}</p>
      </section>
      <section class="oral-position-card position-b">
        <span class="oral-position-tag">Position B</span>
        <p class="oral-position-speaker">${escapeHtml(topic.personB?.speaker || "Person B")}</p>
        <p class="oral-position-opinion">${escapeHtml(topic.personB?.opinion)}</p>
      </section>
    </div>
    ${renderLanguageBank("teil-2")}
    ${renderPracticeFooter(topic)}
  `;
}

function renderPart3(topic) {
  const part = getPart();
  const notes = topic.notes?.length
    ? topic.notes
    : ["Wann?", "Wo?", "Wer macht was?", "Kosten und Material?"];
  elements.practicePanel.innerHTML = `
    <header class="oral-practice-head">
      <div>
        <span class="oral-practice-label">Teil 3 · Planung</span>
        <h2>${escapeHtml(topic.title)}</h2>
      </div>
      <span class="oral-time-chip">${part.durationMinutes} Minuten</span>
    </header>
    <p class="oral-instruction">${escapeHtml(part.instruction)}</p>
    <section class="oral-plan-card">
      <h3>Ihre gemeinsame Aufgabe</h3>
      <p class="oral-plan-prompt">${escapeHtml(topic.prompt)}</p>
      <ul class="oral-note-grid">
        ${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
      </ul>
    </section>
    ${renderLanguageBank("teil-3")}
    ${renderPracticeFooter(topic)}
  `;
}

function renderPracticePanel() {
  if (state.partKey === "teil-1") {
    renderPart1();
    return;
  }
  const topic = getSelectedTopic();
  if (!topic) {
    elements.practicePanel.innerHTML = `
      <div class="oral-empty">
        <div>
          <h2>Kein Thema gefunden</h2>
          <p>Ändern Sie den Suchbegriff und versuchen Sie es erneut.</p>
        </div>
      </div>
    `;
    return;
  }
  if (state.partKey === "teil-2") {
    renderPart2(topic);
    return;
  }
  renderPart3(topic);
}

function render() {
  renderPartTabs();
  renderTopicList();
  renderPracticePanel();
}

function togglePrompt(index) {
  const prepared = new Set(state.progress.prepared);
  if (prepared.has(index)) {
    prepared.delete(index);
  } else {
    prepared.add(index);
  }
  state.progress.prepared = Array.from(prepared).sort((a, b) => a - b);
  saveProgress();
  render();
}

function toggleComplete(topicId) {
  const completed = new Set(state.progress.done[state.partKey] || []);
  const wasComplete = completed.has(topicId);
  if (wasComplete) {
    completed.delete(topicId);
  } else {
    completed.add(topicId);
  }
  state.progress.done[state.partKey] = Array.from(completed);
  saveProgress();
  render();
  showToast(wasComplete ? "Markierung entfernt." : "Thema als geübt gespeichert.");
}

function chooseRandomTopic() {
  const topics = getFilteredTopics();
  if (!topics.length) {
    return;
  }
  const currentId = state.selectedTopics[state.partKey];
  const choices = topics.length > 1 ? topics.filter((topic) => topic.id !== currentId) : topics;
  const topic = choices[Math.floor(Math.random() * choices.length)];
  state.selectedTopics[state.partKey] = topic.id;
  render();
  elements.practicePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindEvents() {
  elements.partTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-part]");
    if (button) {
      setPart(button.dataset.part);
    }
  });

  elements.topicList.addEventListener("click", (event) => {
    const promptButton = event.target.closest("[data-prompt-index]");
    if (promptButton) {
      togglePrompt(Number(promptButton.dataset.promptIndex));
      return;
    }
    const topicButton = event.target.closest("[data-topic-id]");
    if (topicButton) {
      state.selectedTopics[state.partKey] = topicButton.dataset.topicId;
      render();
    }
  });

  elements.practicePanel.addEventListener("click", (event) => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) {
      return;
    }
    if (actionButton.dataset.action === "toggle-prompt") {
      togglePrompt(Number(actionButton.dataset.promptIndex));
    }
    if (actionButton.dataset.action === "new-follow-up") {
      const followUps = getPart()?.followUps || [];
      state.followUpIndex = (state.followUpIndex + 1) % Math.max(1, followUps.length);
      renderPracticePanel();
    }
    if (actionButton.dataset.action === "toggle-complete") {
      toggleComplete(actionButton.dataset.topicId);
    }
  });

  elements.search.addEventListener("input", () => {
    state.search = elements.search.value;
    renderTopicList();
    renderPracticePanel();
  });
  elements.randomTopic.addEventListener("click", chooseRandomTopic);
  elements.timerToggle.addEventListener("click", toggleTimer);
  elements.timerReset.addEventListener("click", resetTimer);

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      event.key === "/"
      && state.partKey !== "teil-1"
      && !/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName || "")
    ) {
      event.preventDefault();
      elements.search.focus();
    }
  });
}

async function loadDatabase() {
  const params = new URLSearchParams(window.location.search);
  state.level = normalize(params.get("level")) || "b1";
  const requestedPart = normalize(params.get("part"));
  const loader = typeof window.fetchFreshJson === "function"
    ? window.fetchFreshJson(DATA_URL)
    : fetch(DATA_URL).then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      });
  state.database = await loader;
  const level = getLevel();
  if (!level) {
    throw new Error(`Level ${state.level.toUpperCase()} ist nicht verfügbar.`);
  }
  state.partKey = level.partOrder.includes(requestedPart) ? requestedPart : level.partOrder[0];
  elements.discussionCount.textContent = String(level.parts["teil-2"]?.topics?.length || 0);
  elements.planningCount.textContent = String(level.parts["teil-3"]?.topics?.length || 0);
  level.partOrder.forEach((partKey) => {
    const firstTopic = level.parts[partKey]?.topics?.[0];
    if (firstTopic) {
      state.selectedTopics[partKey] = firstTopic.id;
    }
  });
  resetTimer();
  bindEvents();
  render();
}

loadDatabase().catch((error) => {
  elements.practicePanel.innerHTML = `
    <div class="oral-empty">
      <div>
        <h2>Inhalte konnten nicht geladen werden</h2>
        <p>${escapeHtml(error.message)}</p>
      </div>
    </div>
  `;
});
