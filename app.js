const homeView = document.getElementById("home-view");
const examView = document.getElementById("exam-view");
const footer = document.getElementById("footer");
const backBtn = document.getElementById("back-btn");
const settingsBtn = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");
const fontSizeInput = document.getElementById("font-size-input");
const fontSizeValue = document.getElementById("font-size-value");
const levelList = document.getElementById("level-list");
const sectionList = document.getElementById("section-list");
const themeGrid = document.getElementById("theme-grid");
const themeSearchInput = document.getElementById("theme-search");
const homeLoader = document.getElementById("home-loader");
const partCards = document.getElementById("part-cards");
const timerDisplay = document.getElementById("timer-display");
const timerValue = document.getElementById("timer-value");
const timerToggle = document.getElementById("timer-toggle");
const versionModal = document.getElementById("version-modal");
const versionOverlay = document.getElementById("version-overlay");
const versionTitle = document.getElementById("version-title");
const versionOptions = document.getElementById("version-options");
const versionCloseBtn = document.getElementById("version-close");
const resultView = document.getElementById("result-view");
const resultTitle = document.getElementById("result-title");
const resultSubtitle = document.getElementById("result-subtitle");
const resultSummary = document.getElementById("result-summary");
const resultBreakdown = document.getElementById("result-breakdown");
const resultRetryBtn = document.getElementById("result-retry-btn");
const resultHomeBtn = document.getElementById("result-home-btn");

const leftPanel = document.getElementById("left-panel");
const rightPanel = document.getElementById("right-panel");

const themeTitle = document.getElementById("theme-title");
const levelPill = document.getElementById("level-pill");
const partLabel = document.getElementById("part-label");
const brandLogo = document.getElementById("brand-logo");
const headerLeft = document.getElementById("header-left");
const headerTitle = document.getElementById("header-title");
const headerDivider = document.getElementById("header-divider");
const returnLabel = document.getElementById("return-label");
const progressDots = document.getElementById("progress-dots");
const prevBtn = document.getElementById("prev-btn");
const nextBtn = document.getElementById("next-btn");

const PART_LABELS = {
  "teil-1": "Lesen Teil 1",
  "teil-2": "Lesen Teil 2",
  "teil-3": "Lesen Teil 3",
  "sprachbausteine-1": "Sprachbausteine 1",
  "sprachbausteine-2": "Sprachbausteine 2"
};
const PDF_PART_ORDER = ["teil-1", "teil-2", "teil-3", "sprachbausteine-1", "sprachbausteine-2"];

const state = {
  db: null,
  config: null,
  level: null,
  section: null,
  theme: null,
  version: null,
  pendingTheme: null,
  search: "",
  part: null,
  responses: {},
  submitted: {},
  active: {},
  view: "home",
  timer: {
    enabled: true,
    durationMs: 0,
    endAt: null,
    intervalId: null
  }
};

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== undefined) {
    el.textContent = text;
  }
  return el;
}

function setHomeLoaderVisible(show) {
  if (!homeLoader) {
    return;
  }
  homeLoader.classList.toggle("hidden", !show);
}

function normalize(value) {
  return (value || "").toLowerCase().trim();
}

const DEFAULT_CONFIG = {
  dataFile: "lesen.json",
  fontScale: 1,
  timer: {
    enabled: true,
    durationMinutes: 90
  },
  scoreConfig: {
    passPercent: 60,
    parts: {
      "teil-1": { pointsPerQuestion: 5 },
      "teil-2": { pointsPerQuestion: 5 },
      "teil-3": { pointsPerQuestion: 2.5 },
      "sprachbausteine-1": { pointsPerQuestion: 1.5 },
      "sprachbausteine-2": { pointsPerQuestion: 1.5 }
    }
  }
};

async function loadFreshJson(path) {
  if (typeof window.fetchFreshJson === "function") {
    return window.fetchFreshJson(path);
  }
  const requestUrl = typeof window.buildFreshUrl === "function" ? window.buildFreshUrl(path) : path;
  const response = await fetch(requestUrl);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function loadConfig() {
  const paths = ["database/config.json", "../database/config.json"];
  for (const path of paths) {
    try {
      const config = await loadFreshJson(path);
      return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
      // ignore and try next
    }
  }
  return { ...DEFAULT_CONFIG };
}

function applyFontScale(scale) {
  const safeScale = Number.isFinite(scale) ? scale : DEFAULT_CONFIG.fontScale;
  document.documentElement.style.setProperty("--font-scale", String(safeScale));
  if (fontSizeValue) {
    fontSizeValue.textContent = `${Math.round(safeScale * 100)}%`;
  }
}

function applyAsideWidth(value) {
  if (!value) {
    return;
  }
  if (typeof value === "number") {
    if (value > 1) {
      document.documentElement.style.setProperty("--aside-width", `${value}%`);
      return;
    }
    if (value > 0) {
      document.documentElement.style.setProperty("--aside-width", `${Math.round(value * 100)}%`);
      return;
    }
    return;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.endsWith("%")) {
      document.documentElement.style.setProperty("--aside-width", trimmed);
      return;
    }
    const numeric = Number.parseFloat(trimmed);
    if (Number.isFinite(numeric)) {
      const percent = numeric > 1 ? numeric : numeric * 100;
      document.documentElement.style.setProperty("--aside-width", `${Math.round(percent)}%`);
    }
  }
}

function getStoredTimerEnabled() {
  const raw = window.localStorage.getItem("timerEnabled");
  if (raw === null) {
    return null;
  }
  return raw === "true";
}

function getTimerConfig() {
  const fallback = DEFAULT_CONFIG.timer;
  const config = state.config?.timer || {};
  const stored = getStoredTimerEnabled();
  const enabled = typeof stored === "boolean"
    ? stored
    : typeof config.enabled === "boolean"
      ? config.enabled
      : fallback.enabled;
  const durationMinutes = Number.isFinite(config.durationMinutes)
    ? config.durationMinutes
    : fallback.durationMinutes;
  return {
    enabled,
    durationMs: Math.max(0, durationMinutes) * 60 * 1000
  };
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function updateTimerDisplay(remainingMs) {
  if (!timerDisplay || !timerValue) {
    return;
  }
  const show = state.view === "exam" && state.timer.enabled;
  timerDisplay.classList.toggle("hidden", !show);
  if (!show) {
    return;
  }
  const value = Number.isFinite(remainingMs) ? remainingMs : state.timer.durationMs;
  timerValue.textContent = formatTime(value);
}

function stopExamTimer() {
  if (state.timer.intervalId) {
    window.clearInterval(state.timer.intervalId);
    state.timer.intervalId = null;
  }
  state.timer.endAt = null;
}

function startExamTimer() {
  stopExamTimer();
  const timerConfig = getTimerConfig();
  state.timer.enabled = timerConfig.enabled;
  state.timer.durationMs = timerConfig.durationMs;
  if (!timerConfig.enabled || timerConfig.durationMs <= 0) {
    updateTimerDisplay(timerConfig.durationMs);
    return;
  }
  state.timer.endAt = Date.now() + timerConfig.durationMs;
  updateTimerDisplay(timerConfig.durationMs);
  state.timer.intervalId = window.setInterval(() => {
    if (!state.timer.endAt || state.view !== "exam") {
      stopExamTimer();
      updateTimerDisplay();
      return;
    }
    const remaining = state.timer.endAt - Date.now();
    if (remaining <= 0) {
      stopExamTimer();
      setView("results");
      renderResults();
      return;
    }
    updateTimerDisplay(remaining);
  }, 1000);
}

function setTimerEnabled(enabled) {
  state.timer.enabled = Boolean(enabled);
  window.localStorage.setItem("timerEnabled", state.timer.enabled ? "true" : "false");
  if (!state.timer.enabled) {
    stopExamTimer();
    updateTimerDisplay();
    return;
  }
  if (state.view === "exam") {
    startExamTimer();
  } else {
    updateTimerDisplay();
  }
}

function applyTimerConfig() {
  const timerConfig = getTimerConfig();
  state.timer.enabled = timerConfig.enabled;
  state.timer.durationMs = timerConfig.durationMs;
  if (timerToggle) {
    timerToggle.checked = timerConfig.enabled;
  }
  updateTimerDisplay(timerConfig.durationMs);
}

function getScoreConfig() {
  const fallback = DEFAULT_CONFIG.scoreConfig;
  const config = state.config?.scoreConfig || {};
  const parts = { ...fallback.parts, ...(config.parts || {}) };
  const passPercent = Number.isFinite(config.passPercent)
    ? config.passPercent
    : fallback.passPercent;
  return { passPercent, parts };
}

function getStoredFontScale() {
  const raw = window.localStorage.getItem("fontScale");
  const parsed = raw ? Number.parseFloat(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPoints(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

async function loadDatabase() {
  const config = state.config || DEFAULT_CONFIG;
  const dataFile = config.dataFile || DEFAULT_CONFIG.dataFile;
  const paths = [`database/${dataFile}`, `../database/${dataFile}`];
  for (const path of paths) {
    try {
      return await loadFreshJson(path);
    } catch (error) {
      // ignore and try next
    }
  }
  return null;
}

function ensurePartState(partKey) {
  const versionKey = getActiveVersionKey();
  const key = [state.level, state.section, state.theme, versionKey, partKey].join("|");
  if (!Object.prototype.hasOwnProperty.call(state.responses, key)) {
    state.responses[key] = {};
  }
  if (!Object.prototype.hasOwnProperty.call(state.submitted, key)) {
    state.submitted[key] = false;
  }
  if (!Object.prototype.hasOwnProperty.call(state.active, key)) {
    state.active[key] = {};
  }
  return {
    key,
    responses: state.responses[key],
    submitted: state.submitted[key],
    active: state.active[key]
  };
}

function setView(view) {
  closeVersionModal();
  if (view !== "exam") {
    stopExamTimer();
  }
  if (view !== "exam" && settingsPanel) {
    settingsPanel.classList.add("hidden");
  }
  state.view = view;
  if (view === "home") {
    homeView.classList.remove("hidden");
    examView.classList.add("hidden");
    resultView?.classList.add("hidden");
    footer.classList.add("hidden");
    themeTitle.textContent = "Select a theme";
    if (partLabel) {
      partLabel.textContent = "Library";
    }
    if (backBtn) {
      backBtn.classList.add("hidden");
    }
    if (returnLabel) {
      returnLabel.classList.add("hidden");
    }
    if (headerDivider) {
      headerDivider.classList.add("hidden");
    }
    if (headerTitle) {
      headerTitle.classList.add("hidden");
    }
    if (brandLogo) {
      brandLogo.classList.remove("hidden");
    }
    if (settingsBtn) {
      settingsBtn.classList.add("hidden");
    }
  } else if (view === "results") {
    homeView.classList.add("hidden");
    examView.classList.add("hidden");
    resultView?.classList.remove("hidden");
    footer.classList.add("hidden");
    if (backBtn) {
      backBtn.classList.remove("hidden");
    }
    if (returnLabel) {
      returnLabel.classList.remove("hidden");
    }
    if (headerDivider) {
      headerDivider.classList.remove("hidden");
    }
    if (headerTitle) {
      headerTitle.classList.remove("hidden");
    }
    if (brandLogo) {
      brandLogo.classList.add("hidden");
    }
    if (settingsBtn) {
      settingsBtn.classList.add("hidden");
    }
  } else {
    homeView.classList.add("hidden");
    examView.classList.remove("hidden");
    resultView?.classList.add("hidden");
    footer.classList.remove("hidden");
    if (backBtn) {
      backBtn.classList.remove("hidden");
    }
    if (returnLabel) {
      returnLabel.classList.remove("hidden");
    }
    if (headerDivider) {
      headerDivider.classList.remove("hidden");
    }
    if (headerTitle) {
      headerTitle.classList.remove("hidden");
    }
    if (brandLogo) {
      brandLogo.classList.add("hidden");
    }
    if (settingsBtn) {
      settingsBtn.classList.remove("hidden");
    }
  }
  renderPartCards();
  updateTimerDisplay();
}

function getThemeEntry() {
  return state.db?.levels?.[state.level]?.themes?.[state.theme] || null;
}

function getActiveVersionKey() {
  if (state.version) {
    return state.version;
  }
  const themeEntry = getThemeEntry();
  if (themeEntry?.defaultVersion) {
    return themeEntry.defaultVersion;
  }
  const order = themeEntry?.versionOrder || [];
  if (order.length) {
    return order[0];
  }
  return "default";
}

function getThemeVersionEntry(themeEntry) {
  if (!themeEntry) {
    return null;
  }
  const key = getActiveVersionKey();
  return themeEntry.versions?.[key] || null;
}

function getActiveLesen(themeEntry) {
  const versionEntry = getThemeVersionEntry(themeEntry);
  return versionEntry?.lesen || themeEntry?.lesen || null;
}

function setHeader(meta) {
  themeTitle.textContent = meta?.title || "Theme";
  levelPill.textContent = (meta?.level || state.level || "").toUpperCase();
  if (partLabel) {
    partLabel.textContent = PART_LABELS[state.part] || meta?.partLabel || "Part";
  }
}

function renderProgress(order) {
  progressDots.innerHTML = "";
  order.forEach((partKey) => {
    const dot = createEl("span", "h-2 w-2 rounded-full bg-stone-300");
    if (partKey === state.part) {
      dot.classList.add("bg-azure");
    }
    progressDots.append(dot);
  });
}

function getAnsweredCounts(partKey, partData) {
  const { responses } = ensurePartState(partKey);
  if (partKey === "teil-1") {
    return countAnsweredTeil1(partData.content || {}, responses);
  }
  if (partKey === "teil-2") {
    return countAnsweredTeil2(partData.content || {}, responses);
  }
  if (partKey === "teil-3") {
    return countAnsweredTeil3(partData.content || {}, responses);
  }
  if (partKey === "sprachbausteine-1" || partKey === "sprachbausteine-2") {
    return countAnsweredSprach(partData.content || {}, responses);
  }
  return { answered: 0, total: 0 };
}

function renderPartCards() {
  if (!partCards) {
    return;
  }
  const themeEntry = getThemeEntry();
  const show = state.view === "exam" && themeEntry;
  partCards.classList.toggle("hidden", !show);
  partCards.innerHTML = "";
  if (!show) {
    return;
  }
  const lesenEntry = getActiveLesen(themeEntry);
  const order = lesenEntry?.partOrder || [];
  order.forEach((partKey) => {
    const partData = lesenEntry?.parts?.[partKey];
    if (!partData) {
      return;
    }
    const counts = getAnsweredCounts(partKey, partData);
    const isComplete = counts.total > 0 && counts.answered === counts.total;
    const isActive = partKey === state.part;
    const card = createEl(
      "button",
      classNames(
        "flex items-center justify-center gap-2 rounded-xl border px-2 py-2.5 h-10 min-w-[110px] text-[9px] font-display uppercase tracking-[0.2em] transition-colors",
        isActive
          ? "border-azure/60 bg-azure/10 text-azure ring-2 ring-azure/30"
          : "border-stone-300 bg-white/80 text-slate hover:border-stone-300"
      ),
      partData.meta?.partLabel || PART_LABELS[partKey] || partKey
    );
    card.type = "button";
    if (isComplete) {
      card.append(makeCheckBadge());
    }
    card.addEventListener("click", () => {
      state.part = partKey;
      setView("exam");
      renderCurrentPart();
    });
    partCards.append(card);
  });
  refreshIcons();
}

function renderMessage(text) {
  leftPanel.innerHTML = "";
  rightPanel.innerHTML = "";
  leftPanel.append(
    createEl(
      "div",
      "rounded-2xl border border-stone-200 bg-stone-50 px-4 py-6 text-center text-sm text-slate",
      text
    )
  );
}

function renderInstruction(text) {
  if (!text) {
    return null;
  }
  const card = createEl("div", "rounded-2xl border border-stone-200 bg-stone-50 p-4 mb-6");
  card.append(
    createEl("div", "font-display text-xs uppercase tracking-[0.2em] text-slate", "Aufgabe"),
    createEl("p", "mt-2 text-sm text-ink", text)
  );
  return card;
}

function makePill(label, variant) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-display uppercase tracking-[0.2em]";
  if (variant === "correct") {
    return createEl("span", `${base} bg-mint/20 text-mint border border-mint/40`, label);
  }
  if (variant === "wrong") {
    return createEl("span", `${base} bg-rose/15 text-rose border border-rose/40`, label);
  }
  return createEl("span", `${base} bg-azure/10 text-azure border border-azure/40`, label);
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function makeLucideIcon(name, className) {
  const icon = createEl("i", className);
  icon.setAttribute("data-lucide", name);
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

function makeCheckBadge() {
  const badge = createEl(
    "span",
    "h-4 w-4 rounded-full border border-mint/40 bg-mint/20 text-mint flex items-center justify-center"
  );
  badge.append(makeLucideIcon("check", "h-3 w-3"));
  return badge;
}

function makeDownloadIcon() {
  return makeLucideIcon("download", "h-4 w-4");
}

function countCorrectTeil1(content, responses) {
  const answers = content.answers || [];
  let correct = 0;
  answers.forEach((item) => {
    const selected = responses[item.textId];
    if (selected && normalize(selected) === normalize(item.headlineId)) {
      correct += 1;
    }
  });
  const total = answers.length || (content.texts || []).length;
  return { correct, total };
}

function countCorrectTeil2(content, responses) {
  const questions = content.questions || [];
  let correct = 0;
  questions.forEach((question) => {
    const selected = responses[question.id];
    if (selected && normalize(selected) === normalize(question.answerId)) {
      correct += 1;
    }
  });
  return { correct, total: questions.length };
}

function countCorrectTeil3(content, responses) {
  const answers = content.answers || [];
  let correct = 0;
  answers.forEach((item) => {
    const selected = responses[item.situationId];
    if (selected && normalize(selected) === normalize(item.adId)) {
      correct += 1;
    }
  });
  const total = answers.length || (content.situations || []).length;
  return { correct, total };
}

function getSprachAnswerMap(content) {
  const answers = (content.answers && content.answers.length) ? content.answers : (content.blanks || []);
  return new Map((answers || []).map((item) => [String(item.id), item.answer || item.text || ""]));
}

function countCorrectSprach(content, responses) {
  const answerMap = getSprachAnswerMap(content);
  let correct = 0;
  answerMap.forEach((answer, id) => {
    const selected = responses[id];
    if (selected && normalize(selected) === normalize(answer)) {
      correct += 1;
    }
  });
  const total = answerMap.size;
  return { correct, total };
}

function hasResponseValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function countAnsweredTeil1(content, responses) {
  const texts = content.texts || [];
  const total = texts.length || (content.answers || []).length;
  let answered = 0;
  texts.forEach((item) => {
    if (hasResponseValue(responses[item.id])) {
      answered += 1;
    }
  });
  return { answered, total };
}

function countAnsweredTeil2(content, responses) {
  const questions = content.questions || [];
  let answered = 0;
  questions.forEach((question) => {
    if (hasResponseValue(responses[question.id])) {
      answered += 1;
    }
  });
  return { answered, total: questions.length };
}

function countAnsweredTeil3(content, responses) {
  const situations = content.situations || [];
  const total = situations.length || (content.answers || []).length;
  let answered = 0;
  situations.forEach((item) => {
    if (hasResponseValue(responses[item.id])) {
      answered += 1;
    }
  });
  return { answered, total };
}

function countAnsweredSprach(content, responses) {
  const blanks = (content.blanks && content.blanks.length) ? content.blanks : (content.answers || []);
  let answered = 0;
  blanks.forEach((blank) => {
    if (hasResponseValue(responses[blank.id])) {
      answered += 1;
    }
  });
  return { answered, total: blanks.length };
}

function computePartScore(partKey, partData) {
  const { responses } = ensurePartState(partKey);
  const scoreConfig = getScoreConfig();
  const pointsPerQuestion = Number(scoreConfig.parts?.[partKey]?.pointsPerQuestion || 0);

  let counts = { correct: 0, total: 0 };
  if (partKey === "teil-1") {
    counts = countCorrectTeil1(partData.content || {}, responses);
  } else if (partKey === "teil-2") {
    counts = countCorrectTeil2(partData.content || {}, responses);
  } else if (partKey === "teil-3") {
    counts = countCorrectTeil3(partData.content || {}, responses);
  } else if (partKey === "sprachbausteine-1" || partKey === "sprachbausteine-2") {
    counts = countCorrectSprach(partData.content || {}, responses);
  }

  const maxPoints = counts.total * pointsPerQuestion;
  const earnedPoints = counts.correct * pointsPerQuestion;
  return {
    partKey,
    label: PART_LABELS[partKey] || partKey,
    correct: counts.correct,
    total: counts.total,
    pointsPerQuestion,
    maxPoints,
    earnedPoints
  };
}

function renderResults() {
  if (!resultView) {
    return;
  }

  const themeEntry = getThemeEntry();
  if (!themeEntry) {
    resultTitle.textContent = "No results available.";
    resultSubtitle.textContent = "Please select a theme first.";
    resultSummary.innerHTML = "";
    resultBreakdown.innerHTML = "";
    return;
  }

  const scoreConfig = getScoreConfig();
  const lesenEntry = getActiveLesen(themeEntry);
  const order = lesenEntry?.partOrder || [];
  const scores = order
    .map((partKey) => {
      const partData = lesenEntry?.parts?.[partKey];
      if (!partData) {
        return null;
      }
      return computePartScore(partKey, partData);
    })
    .filter(Boolean);

  const totalMax = scores.reduce((sum, item) => sum + item.maxPoints, 0);
  const totalEarned = scores.reduce((sum, item) => sum + item.earnedPoints, 0);
  const percent = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  const passed = percent >= scoreConfig.passPercent;

  const versionEntry = getThemeVersionEntry(themeEntry);
  themeTitle.textContent = versionEntry?.title || themeEntry.title || "Results";
  if (partLabel) {
    partLabel.textContent = "Results";
  }
  resultTitle.textContent = passed ? "Well done." : "Keep practicing.";
  resultSubtitle.textContent = `You reached ${percent}% (pass mark ${scoreConfig.passPercent}%).`;

  resultSummary.innerHTML = "";
  const summaryGrid = createEl("div", "grid gap-4 sm:grid-cols-3");
  const totalCard = createEl("div", "rounded-2xl border border-stone-200 bg-stone-50 p-4");
  totalCard.append(
    createEl("div", "text-xs uppercase tracking-[0.2em] text-slate font-display", "Total points"),
    createEl("div", "mt-2 text-2xl font-display text-ink", `${formatPoints(totalEarned)} / ${formatPoints(totalMax)}`)
  );
  const percentCard = createEl("div", "rounded-2xl border border-stone-200 bg-stone-50 p-4");
  percentCard.append(
    createEl("div", "text-xs uppercase tracking-[0.2em] text-slate font-display", "Percent"),
    createEl("div", "mt-2 text-2xl font-display text-ink", `${percent}%`)
  );
  const statusCard = createEl("div", "rounded-2xl border border-stone-200 bg-stone-50 p-4");
  statusCard.append(
    createEl("div", "text-xs uppercase tracking-[0.2em] text-slate font-display", "Result"),
    createEl("div", classNames("mt-2 text-2xl font-display", passed ? "text-mint" : "text-rose"), passed ? "Passed" : "Not passed")
  );
  summaryGrid.append(totalCard, percentCard, statusCard);
  resultSummary.append(summaryGrid);

  resultBreakdown.innerHTML = "";
  scores.forEach((score) => {
    const row = createEl("div", "rounded-2xl border border-stone-200 bg-white/90 p-4 space-y-3");
    const header = createEl("div", "flex items-center justify-between gap-3");
    const left = createEl("div", "space-y-1");
    left.append(
      createEl("div", "text-sm font-display text-ink", score.label),
      createEl("div", "text-xs text-slate", `Correct answers: ${score.correct} / ${score.total}`)
    );
    const right = createEl("div", "text-sm font-display text-ink");
    right.textContent = `${formatPoints(score.earnedPoints)} / ${formatPoints(score.maxPoints)}`;
    header.append(left, right);
    const bar = createEl("div", "h-2 w-full rounded-full bg-stone-200 overflow-hidden");
    const fill = createEl("div", "h-full bg-azure");
    const width = score.maxPoints > 0 ? Math.round((score.earnedPoints / score.maxPoints) * 100) : 0;
    fill.style.width = `${width}%`;
    bar.append(fill);
    row.append(header, bar);
    resultBreakdown.append(row);
  });
}

function renderActionBar(partKey) {
  const { key, submitted } = ensurePartState(partKey);
  const wrapper = createEl("div", "sticky bottom-0 left-0 right-0 pt-4");
  const bar = createEl("div", "flex items-center justify-between gap-2");
  const button = createEl(
    "button",
    classNames(
      "w-full rounded-xl px-4 py-2 text-sm font-display",
      submitted
        ? "border border-stone-300 bg-stone-50 text-slate"
        : "bg-azure text-white shadow-lg ring-2 ring-azure/20"
    ),
    submitted ? "Retry" : "Check Answers"
  );

  button.type = "button";
  button.addEventListener("click", () => {
    if (submitted) {
      state.responses[key] = {};
      state.submitted[key] = false;
    } else {
      state.submitted[key] = true;
    }
    renderCurrentPart();
  });

  bar.append(button);
  wrapper.append(bar);
  return wrapper;
}

function renderLesenTeil1(content) {
  const partKey = "teil-1";
  const { responses, submitted, active } = ensurePartState(partKey);
  leftPanel.innerHTML = "";
  rightPanel.innerHTML = "";

  const instruction = renderInstruction(content.instruction);
  if (instruction) {
    leftPanel.append(instruction);
  }

  const correctMap = new Map((content.answers || []).map((item) => [item.textId, item.headlineId]));
  const texts = content.texts || [];
  if (!active.textId && texts.length) {
    active.textId = texts[0].id;
  }

  const list = createEl("div", "space-y-4");
  texts.forEach((item) => {
    const selected = responses[item.id];
    const correct = correctMap.get(item.id);
    const isCorrect = selected && selected === correct;

    const card = createEl(
      "button",
      classNames(
        "w-full text-left rounded-2xl border border-stone-300 bg-white/90 p-4 transition-shadow",
        item.id === active.textId
          ? "border-azure/60 bg-azure/10 shadow-panel ring-2 ring-azure/20"
          : "hover:border-stone-300"
      )
    );
    card.type = "button";
    card.addEventListener("click", () => {
      if (active.headlineId && assignHeadline(item.id, active.headlineId)) {
        renderCurrentPart();
        return;
      }
      active.textId = item.id;
      renderCurrentPart();
    });
    card.addEventListener("dblclick", () => {
      if (responses[item.id]) {
        delete responses[item.id];
        renderCurrentPart();
      }
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const headlineId = event.dataTransfer?.getData("text/plain");
      if (!headlineId) {
        return;
      }
      if (assignHeadline(item.id, headlineId)) {
        renderCurrentPart();
      }
    });

    const pills = createEl("div", "mb-2 flex flex-wrap gap-2");
    
    if (submitted) {
      if (selected) {
        pills.append(makePill(`Your: ${selected}`, isCorrect ? "correct" : "wrong"));
      }
      if (!isCorrect && correct) {
        pills.append(makePill(`Correct: ${correct}`, "correct"));
      }
    } else if (selected) {
      pills.append(makePill(`Selected: ${selected}`, "selected"));
    }

    if (pills.childNodes.length) {
      card.append(pills);
    }

    card.append(createEl("div", "h-8 w-8 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-center text-sm font-display text-slate", item.id));

    card.append(createEl("p", "mt-3 text-sm text-ink", item.text));

    list.append(card);
  });
  leftPanel.append(list);

  const header = createEl("div", "space-y-1");
  header.append(
    createEl("h2", "font-display text-lg", "Überschriften"),
    createEl("p", "text-xs uppercase tracking-[0.2em] text-slate font-display", `Für Text ${active.textId || ""}`)
  );
  rightPanel.append(header);

  const usedHeadlines = new Map();
  Object.entries(responses).forEach(([textId, headlineId]) => {
    if (headlineId) {
      usedHeadlines.set(headlineId, Number.parseInt(textId, 10));
    }
  });

  const assignHeadline = (textId, headlineId) => {
    const usedBy = usedHeadlines.get(headlineId);
    if (usedBy && usedBy !== textId) {
      return false;
    }
    responses[textId] = headlineId;
    active.textId = textId;
    active.headlineId = null;
    return true;
  };

  const options = createEl("div", "mt-4 space-y-3");
  const correct = correctMap.get(active.textId);
  (content.headlines || []).forEach((headline) => {
    const selected = responses[active.textId];
    const isSelected = selected === headline.id;
    const isCorrect = submitted && headline.id === correct;
    const isWrong = submitted && isSelected && headline.id !== correct;
    const usedBy = usedHeadlines.get(headline.id);
    const isUsedByOther = !submitted && usedBy && usedBy !== active.textId;
    const isChoiceActive = normalize(active.headlineId) === normalize(headline.id);

    const option = createEl(
      "button",
      classNames(
        "w-full rounded-xl border px-3 py-3 text-left text-sm font-display flex items-center gap-3 transition-colors",
        isCorrect ? "border-mint/60 bg-mint/20 text-mint" :
        isWrong ? "border-rose/50 bg-rose/15 text-rose" :
        isSelected ? "border-azure/60 bg-azure/10 text-azure" :
        isUsedByOther ? "border-stone-200 bg-stone-50 text-slate opacity-50 cursor-not-allowed" :
        "border-stone-300 bg-white text-ink hover:border-stone-300"
      )
    );
    option.type = "button";
    option.draggable = true;
    option.append(createEl("span", "h-6 w-6 rounded-lg border border-black/10 bg-white flex items-center justify-center text-xs", headline.id));
    option.append(createEl("span", "text-sm", headline.text));
    if (isChoiceActive) {
      option.classList.add("ring-2", "ring-azure/30");
    }

    option.addEventListener("click", () => {
      if (active.textId && assignHeadline(active.textId, headline.id)) {
        renderCurrentPart();
        return;
      }
      if (isUsedByOther) {
        return;
      }
      active.headlineId = headline.id;
      renderCurrentPart();
    });

    option.addEventListener("dblclick", () => {
      if (usedBy) {
        delete responses[usedBy];
        active.headlineId = null;
        renderCurrentPart();
      }
    });

    option.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", headline.id);
    });

    options.append(option);
  });
  rightPanel.append(options, renderActionBar(partKey));
}

function renderLesenTeil2(content) {
  const partKey = "teil-2";
  const { responses, submitted } = ensurePartState(partKey);
  leftPanel.innerHTML = "";
  rightPanel.innerHTML = "";

  leftPanel.append(createEl("span", "inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-slate font-display", "Lesetext"));
  leftPanel.append(createEl("h2", "mt-4 text-2xl font-display", content.passage?.title || ""));

  (content.passage?.paragraphs || []).forEach((para) => {
    leftPanel.append(createEl("p", "mt-4 text-sm text-ink leading-relaxed", para));
  });

  const header = createEl("div", "space-y-1");
  header.append(
    createEl("h2", "font-display text-lg", "Aufgaben"),
    createEl("p", "text-xs uppercase tracking-[0.2em] text-slate font-display", "Wählen Sie die richtige Lösung")
  );
  rightPanel.append(header);

  (content.questions || []).forEach((question) => {
    const block = createEl("div", "mt-4 rounded-2xl border border-stone-300 bg-stone-50 p-4");
    const qHeader = createEl("div", "flex items-start gap-2 text-sm font-display");
    qHeader.append(createEl("span", "text-azure", `${question.id}.`), createEl("span", "text-ink", question.prompt));
    block.append(qHeader);

    const list = createEl("div", "mt-3 space-y-2");
    (question.options || []).forEach((option) => {
      const selected = responses[question.id];
      const isSelected = selected === option.id;
      const isCorrect = submitted && option.id === question.answerId;
      const isWrong = submitted && isSelected && option.id !== question.answerId;

      const item = createEl(
        "button",
        classNames(
          "w-full rounded-xl border px-3 py-2 text-left text-sm font-display flex items-center gap-2 transition-colors",
          isCorrect ? "border-mint/60 bg-mint/20 text-mint" :
          isWrong ? "border-rose/50 bg-rose/15 text-rose" :
          isSelected ? "border-azure/60 bg-azure/10 text-azure" :
          "border-stone-300 bg-white text-ink hover:border-stone-300"
        )
      );
      item.type = "button";
      item.append(createEl("span", "text-xs", `${option.id.toUpperCase()})`));
      item.append(createEl("span", "text-sm", option.text));
      item.addEventListener("click", () => {
        responses[question.id] = option.id;
        renderCurrentPart();
      });
      list.append(item);
    });
    block.append(list);
    rightPanel.append(block);
  });

  rightPanel.append(renderActionBar(partKey));
}

function renderLesenTeil3(content) {
  const partKey = "teil-3";
  const { responses, submitted, active } = ensurePartState(partKey);
  leftPanel.innerHTML = "";
  rightPanel.innerHTML = "";

  const situations = content.situations || [];
  if (!active.situationId && situations.length) {
    active.situationId = situations[0].id;
  }

  const correctMap = new Map((content.answers || []).map((item) => [item.situationId, item.adId]));
  const usedAds = new Map();
  Object.entries(responses).forEach(([situationId, adId]) => {
    if (adId && adId !== "X") {
      usedAds.set(adId, Number.parseInt(situationId, 10));
    }
  });

  leftPanel.append(createEl("h2", "font-display text-lg", "Anzeigen"));
  const adsGrid = createEl("div", "mt-4 grid grid-cols-2 gap-3");
  (content.ads || []).forEach((ad) => {
    const selected = responses[active.situationId];
    const correct = correctMap.get(active.situationId);
    const isSelected = selected === ad.id;
    const isCorrect = submitted && ad.id === correct;
    const isWrong = submitted && isSelected && ad.id !== correct;
    const usedBy = usedAds.get(ad.id);
    const isNoAnzeige = ad.id === "X";
    const isUsedByOther = !submitted && !isNoAnzeige && usedBy && usedBy !== active.situationId;
    const isChoiceActive = normalize(active.adId) === normalize(ad.id);

    const item = createEl(
      "button",
      classNames(
        "w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors flex flex-col items-start justify-start",
        isCorrect ? "border-mint/60 bg-mint/20 text-mint" :
        isWrong ? "border-rose/50 bg-rose/15 text-rose" :
        isSelected ? "border-azure/60 bg-azure/10 text-azure" :
        isUsedByOther ? "border-stone-200 bg-stone-50 text-slate opacity-50 cursor-not-allowed" :
        "border-stone-300 bg-white text-ink hover:border-stone-300"
      )
    );
    item.type = "button";
    item.draggable = true;
    item.append(createEl("div", "h-7 w-7 rounded-lg border border-stone-300 bg-white flex items-center justify-center text-xs font-display text-slate", ad.id));
    item.append(createEl("p", "mt-2 text-sm", ad.text));
    if (isChoiceActive) {
      item.classList.add("ring-2", "ring-azure/30");
    }

    item.addEventListener("click", () => {
      if (active.situationId && (!isUsedByOther || usedBy === active.situationId || isNoAnzeige)) {
        responses[active.situationId] = ad.id;
        active.adId = null;
        renderCurrentPart();
        return;
      }
      if (isUsedByOther) {
        return;
      }
      active.adId = ad.id;
      renderCurrentPart();
    });

    item.addEventListener("dblclick", () => {
      if (usedBy) {
        delete responses[usedBy];
        active.adId = null;
        renderCurrentPart();
      }
    });

    item.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", ad.id);
    });

    adsGrid.append(item);
  });
  leftPanel.append(adsGrid);

  rightPanel.append(createEl("h2", "font-display text-lg", "Situationen"));
  const list = createEl("div", "mt-4 space-y-3");

  situations.forEach((item) => {
    const selected = responses[item.id];
    const correct = correctMap.get(item.id);
    const isCorrect = selected && selected === correct;

    const card = createEl(
      "button",
      classNames(
        "w-full text-left rounded-2xl border border-stone-300 bg-white/90 p-4 transition-shadow",
        item.id === active.situationId
          ? "border-azure/60 bg-azure/10 shadow-panel ring-2 ring-azure/20"
          : "hover:border-stone-300"
      )
    );
    card.type = "button";
    card.addEventListener("click", () => {
      if (active.adId && (!usedAds.get(active.adId) || usedAds.get(active.adId) === item.id)) {
        responses[item.id] = active.adId;
        active.situationId = item.id;
        active.adId = null;
        renderCurrentPart();
        return;
      }
      active.situationId = item.id;
      renderCurrentPart();
    });
    card.addEventListener("dblclick", () => {
      if (responses[item.id]) {
        delete responses[item.id];
        renderCurrentPart();
      }
    });
    card.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const adId = event.dataTransfer?.getData("text/plain");
      if (!adId) {
        return;
      }
      if (adId !== "X" && usedAds.get(adId) && usedAds.get(adId) !== item.id) {
        return;
      }
      responses[item.id] = adId;
      active.situationId = item.id;
      active.adId = null;
      renderCurrentPart();
    });

    const pills = createEl("div", "mb-2 flex flex-wrap gap-2");
    if (submitted) {
      if (selected) {
        pills.append(makePill(`Your: ${selected}`, isCorrect ? "correct" : "wrong"));
      }
      if (!isCorrect && correct) {
        pills.append(makePill(`Correct: ${correct}`, "correct"));
      }
    } else if (selected) {
      pills.append(makePill(`Selected: ${selected}`, "selected"));
    }

    if (pills.childNodes.length) {
      card.append(pills);
    }

    card.append(createEl("p", "text-xs uppercase tracking-[0.2em] text-slate font-display", `Situation ${item.id}`));

    card.append(createEl("p", "mt-2 text-sm", item.text));

    list.append(card);
  });
  rightPanel.append(list, renderActionBar(partKey));
}

function renderSprachbausteine1(content) {
  const partKey = "sprachbausteine-1";
  const { responses, submitted, active } = ensurePartState(partKey);
  leftPanel.innerHTML = "";
  rightPanel.innerHTML = "";

  leftPanel.append(createEl("h2", "font-display text-xl", content.title || "Sprachbausteine"));
  leftPanel.append(createEl("p", "mt-2 text-sm text-slate", content.instruction || ""));

  const blanks = content.blanks || [];
  const answers = (content.answers || []).length ? content.answers : blanks;
  if (!active.blankId && blanks.length) {
    active.blankId = blanks[0].id;
  }

  const answerMap = new Map((answers || []).map((item) => [item.id, item.answer || item.text || ""]));
  const textBlock = createEl("p", "mt-6 text-sm leading-relaxed");

  (content.segments || []).forEach((segment) => {
    if (segment.type === "text") {
      textBlock.append(document.createTextNode(segment.value));
      return;
    }

    const selected = responses[segment.id];
    const correct = answerMap.get(segment.id) || segment.answer || "";
    const isCorrect = submitted && selected && normalize(selected) === normalize(correct);
    const isWrong = submitted && selected && normalize(selected) !== normalize(correct);
    const isActive = segment.id === active.blankId;

    const blank = createEl(
      "button",
      classNames(
        "mx-1 inline-flex min-w-[52px] items-center justify-center rounded-xl border px-2 py-1 text-xs font-display",
        isCorrect ? "border-mint/60 bg-mint/20 text-mint" :
        isWrong ? "border-rose/50 bg-rose/15 text-rose" :
        selected ? "border-azure/60 bg-azure/10 text-azure" :
        "border-stone-300 bg-stone-50 text-slate",
        isActive ? "ring-2 ring-azure/20" : ""
      ),
      selected || `(${segment.id})`
    );
    blank.type = "button";
    blank.addEventListener("click", () => {
      active.blankId = segment.id;
      renderCurrentPart();
    });
    textBlock.append(blank);
  });
  leftPanel.append(textBlock);

  const header = createEl("div", "space-y-1");
  header.append(
    createEl("h2", "font-display text-lg", "Antworten"),
    createEl("p", "text-xs uppercase tracking-[0.2em] text-slate font-display", "Wählen Sie für jede Lücke die passende Option")
  );
  rightPanel.append(header);

  const list = createEl("div", "mt-4 space-y-4");
  blanks.forEach((blank) => {
    const selected = responses[blank.id];
    const correct = answerMap.get(blank.id) || "";
    const card = createEl(
      "div",
      classNames(
        "rounded-2xl border p-3",
        blank.id === active.blankId ? "border-azure/50 bg-azure/10" : "border-stone-200 bg-white"
      )
    );

    const heading = createEl("div", "flex items-center justify-between gap-2");
    heading.append(
      createEl("div", "text-xs uppercase tracking-[0.2em] text-slate font-display", `Lücke ${blank.id}`)
    );
    card.append(heading);

    const options = createEl("div", "mt-2 space-y-2");
    (blank.options || []).forEach((optionText) => {
      const isSelected = normalize(optionText) === normalize(selected);
      const isCorrect = submitted && normalize(optionText) === normalize(correct);
      const isWrong = submitted && isSelected && normalize(optionText) !== normalize(correct);

      const option = createEl(
        "button",
        classNames(
          "w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors",
          isCorrect ? "border-mint/60 bg-mint/20 text-mint" :
          isWrong ? "border-rose/50 bg-rose/15 text-rose" :
          isSelected ? "border-azure/60 bg-azure/10 text-azure" :
          "border-stone-300 bg-white text-ink hover:border-stone-300"
        ),
        optionText
      );
      option.type = "button";
      option.addEventListener("click", () => {
        active.blankId = blank.id;
        responses[blank.id] = optionText;
        renderCurrentPart();
      });
      options.append(option);
    });

    card.append(options);
    list.append(card);
  });

  rightPanel.append(list, renderActionBar(partKey));
}

function renderSprachbausteine2(content) {
  const partKey = "sprachbausteine-2";
  const { responses, submitted, active } = ensurePartState(partKey);
  leftPanel.innerHTML = "";
  rightPanel.innerHTML = "";

  leftPanel.append(createEl("h2", "font-display text-xl", content.title || "Sprachbausteine"));
  leftPanel.append(createEl("p", "mt-2 text-sm text-slate", content.instruction || ""));

  const blanks = (content.blanks && content.blanks.length) ? content.blanks : (content.answers || []);
  const answers = (content.answers || []).length ? content.answers : content.blanks || [];
  if (!active.blankId && blanks.length) {
    active.blankId = blanks[0].id;
  }

  const answerMap = new Map((answers || []).map((item) => [item.id, item.answer || item.text || ""]));
  const usedWords = new Map();
  Object.entries(responses).forEach(([blankId, selected]) => {
    if (selected) {
      usedWords.set(normalize(selected), Number.parseInt(blankId, 10));
    }
  });
  const textBlock = createEl("p", "mt-6 text-sm leading-relaxed");

  (content.segments || []).forEach((segment) => {
    if (segment.type === "text") {
      textBlock.append(document.createTextNode(segment.value));
      return;
    }

    const selected = responses[segment.id];
    const correct = answerMap.get(segment.id) || segment.answer || "";
    const isCorrect = submitted && selected && normalize(selected) === normalize(correct);
    const isWrong = submitted && selected && normalize(selected) !== normalize(correct);
    const isActive = segment.id === active.blankId;

    const blank = createEl(
      "button",
      classNames(
        "mx-1 inline-flex min-w-[52px] items-center justify-center rounded-xl border px-2 py-1 text-xs font-display",
        isCorrect ? "border-mint/60 bg-mint/20 text-mint" :
        isWrong ? "border-rose/50 bg-rose/15 text-rose" :
        selected ? "border-azure/60 bg-azure/10 text-azure" :
        "border-stone-300 bg-stone-50 text-slate",
        isActive ? "ring-2 ring-azure/20" : ""
      ),
      selected || `(${segment.id})`
    );
    blank.type = "button";
    blank.addEventListener("click", () => {
      if (active.wordText) {
        const usedBy = usedWords.get(normalize(active.wordText));
        if (!usedBy || usedBy === segment.id) {
          responses[segment.id] = active.wordText;
          active.blankId = segment.id;
          active.wordText = null;
          renderCurrentPart();
          return;
        }
      }
      active.blankId = segment.id;
      renderCurrentPart();
    });
    blank.addEventListener("dblclick", () => {
      if (responses[segment.id]) {
        delete responses[segment.id];
        renderCurrentPart();
      }
    });
    blank.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    blank.addEventListener("drop", (event) => {
      event.preventDefault();
      const wordText = event.dataTransfer?.getData("text/plain");
      if (!wordText) {
        return;
      }
      const usedBy = usedWords.get(normalize(wordText));
      if (usedBy && usedBy !== segment.id) {
        return;
      }
      responses[segment.id] = wordText;
      active.blankId = segment.id;
      active.wordText = null;
      renderCurrentPart();
    });
    textBlock.append(blank);
  });
  leftPanel.append(textBlock);

  const header = createEl("div", "space-y-1");
  header.append(
    createEl("h2", "font-display text-lg", "Wörter"),
    createEl(
      "p",
      "text-xs uppercase tracking-[0.2em] text-slate font-display",
      "Wählen Sie ein Wort"
    )
  );
  rightPanel.append(header);

  const derivedOptions = (content.options && content.options.length)
    ? content.options
    : (content.blanks || []).map((blank) => blank.answer).filter(Boolean);
  const uniqueOptions = Array.from(new Set(derivedOptions.map((text) => normalize(text))))
    .map((key) => derivedOptions.find((text) => normalize(text) === key))
    .filter(Boolean);

  const wordBank = (content.wordBank && content.wordBank.length)
    ? content.wordBank
    : uniqueOptions.map((text) => ({ id: "", text }));

  if (!wordBank.length) {
    rightPanel.append(
      createEl("div", "mt-4 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-slate", "No words available. Re-extract this exam.")
    );
  } else {
    const grid = createEl("div", "mt-4 grid grid-cols-2 gap-2");
    wordBank.forEach((word) => {
      const selected = responses[active.blankId];
      const correct = answerMap.get(active.blankId) || "";
      const isSelected = normalize(word.text) === normalize(selected);
      const isCorrect = submitted && normalize(word.text) === normalize(correct);
      const isWrong = submitted && isSelected && normalize(word.text) !== normalize(correct);
      const usedBy = usedWords.get(normalize(word.text));
      const isUsedByOther = !submitted && usedBy && usedBy !== active.blankId;
      const isChoiceActive = normalize(active.wordText) === normalize(word.text);

      const card = createEl(
        "button",
        classNames(
          "rounded-xl border px-3 py-2 text-xs font-display transition-colors",
          isCorrect ? "border-mint/60 bg-mint/20 text-mint" :
          isWrong ? "border-rose/50 bg-rose/15 text-rose" :
          isSelected ? "border-azure/60 bg-azure/10 text-azure" :
          isUsedByOther ? "border-stone-200 bg-stone-50 text-slate opacity-50 cursor-not-allowed" :
          "border-stone-300 bg-white text-ink hover:border-stone-300"
        ),
        `${word.id} ${word.text}`.trim()
      );
      card.type = "button";
      card.draggable = true;
      if (isChoiceActive) {
        card.classList.add("ring-2", "ring-azure/30");
      }
      card.addEventListener("click", () => {
        if (active.blankId && (!isUsedByOther || usedBy === active.blankId)) {
          responses[active.blankId] = word.text;
          active.wordText = null;
          renderCurrentPart();
          return;
        }
        if (isUsedByOther) {
          return;
        }
        active.wordText = word.text;
        renderCurrentPart();
      });
      card.addEventListener("dblclick", () => {
        if (usedBy) {
          delete responses[usedBy];
          active.wordText = null;
          renderCurrentPart();
        }
      });
      card.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData("text/plain", word.text);
      });
      grid.append(card);
    });
    rightPanel.append(grid);
  }
  rightPanel.append(renderActionBar(partKey));
}

function renderCurrentPart() {
  const themeEntry = getThemeEntry();
  if (!themeEntry) {
    renderMessage("database/lesen.json not loaded.");
    return;
  }

  const lesenEntry = getActiveLesen(themeEntry);
  const partData = lesenEntry?.parts?.[state.part];
  if (!partData) {
    renderMessage("Part not available.");
    return;
  }

  setHeader(partData.meta);
  renderProgress(lesenEntry?.partOrder || []);

  if (state.part === "teil-1") {
    renderLesenTeil1(partData.content);
  } else if (state.part === "teil-2") {
    renderLesenTeil2(partData.content);
  } else if (state.part === "teil-3") {
    renderLesenTeil3(partData.content);
  } else if (state.part === "sprachbausteine-1") {
    renderSprachbausteine1(partData.content);
  } else if (state.part === "sprachbausteine-2") {
    renderSprachbausteine2(partData.content);
  }

  const order = lesenEntry?.partOrder || [];
  const index = order.indexOf(state.part);
  const atLastPart = index === order.length - 1;
  prevBtn.disabled = index <= 0;
  nextBtn.disabled = index === -1;
  nextBtn.textContent = atLastPart ? "Ergebnis" : "Weiter";
  prevBtn.classList.toggle("opacity-50", prevBtn.disabled);
  nextBtn.classList.toggle("opacity-50", nextBtn.disabled);
  renderPartCards();
}

function resetCurrentTheme() {
  const themeEntry = getThemeEntry();
  if (!themeEntry) {
    return;
  }
  const lesenEntry = getActiveLesen(themeEntry);
  const order = lesenEntry?.partOrder || [];
  order.forEach((partKey) => {
    const { key } = ensurePartState(partKey);
    state.responses[key] = {};
    state.submitted[key] = false;
    state.active[key] = {};
  });
}

function renderChoiceButton(label, active) {
  return createEl(
    "button",
    classNames(
      "rounded-full border px-4 py-2 text-xs font-display uppercase tracking-[0.2em]",
      active
        ? "border-azure/60 bg-azure/10 text-azure ring-2 ring-azure/20"
        : "border-stone-300 bg-stone-50 text-slate shadow-sm"
    ),
    label
  );
}

function makeMetaPill(label) {
  return createEl(
    "span",
    "rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-display uppercase tracking-[0.2em] text-slate",
    label
  );
}

function getPdfFilename(levelKey, themeKey, versionKey) {
  const version = versionKey || "default";
  return `${levelKey}-${themeKey}-${version}.pdf`;
}

const PDF_STYLES = `
  @page {
    size: A4;
    margin: 0;
  }
  .pdf-export {
    font-family: "Helvetica Neue", Arial, sans-serif;
    font-size: 12px;
    color: #1f2933;
    margin: 0;
    padding: 10mm 14mm 12mm;
    width: 210mm;
    max-width: 210mm;
    background: #ffffff;
  }
  .pdf-export,
  .pdf-export * {
    box-sizing: border-box;
  }
  .pdf-export .no-break {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .pdf-export h2 {
    font-size: 18px;
    margin: 0 0 12px;
  }
  .pdf-export h3 {
    font-size: 14px;
    margin: 12px 0 8px;
  }
  .pdf-export p {
    margin: 0 0 8px;
    line-height: 1.5;
  }
  .pdf-export .page {
    padding: 8px 0 16px;
    page-break-after: always;
    break-after: page;
  }
  .pdf-export .page:last-of-type {
    page-break-after: auto;
    break-after: auto;
  }
  .pdf-export .version-block + .version-block {
    page-break-before: always;
    break-before: page;
  }
  .pdf-export .meta {
    border: 1px solid #e7d9c6;
    background: #fbf7f0;
    padding: 10px 12px;
    border-radius: 12px;
    margin-bottom: 16px;
  }
  .pdf-export .meta,
  .pdf-export .item,
  .pdf-export .question,
  .pdf-export .text-block,
  .pdf-export .correction-block,
  .pdf-export .blank-lines,
  .pdf-export .word-bank,
  .pdf-export .anzeige-list,
  .pdf-export .answer-line {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .pdf-export .meta-title {
    font-size: 16px;
    font-weight: 700;
  }
  .pdf-export .meta-subtitle {
    margin-top: 4px;
    color: #5c6672;
  }
  .pdf-export .columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
  }
  .pdf-export .section {
    margin-bottom: 12px;
    break-inside: auto;
  }
  .pdf-export .col {
    min-width: 0;
  }
  .pdf-export .grid-two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
  }
  .pdf-export .grid-two .item {
    margin-bottom: 0;
  }
  .pdf-export .item {
    border: 1px solid #e7d9c6;
    border-radius: 12px;
    padding: 10px 12px;
    margin-bottom: 10px;
    background: #fff;
  }
  .pdf-export .item-id {
    font-weight: 700;
    margin-bottom: 6px;
    color: #0f766e;
  }
  .pdf-export .item-text {
    line-height: 1.45;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .pdf-export .list {
    padding-left: 16px;
    margin: 0;
  }
  .pdf-export .list.grid-two {
    padding-left: 0;
    list-style-position: inside;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 16px;
  }
  .pdf-export .list.grid-two li {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .pdf-export .list li {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .pdf-export .question {
    border: 1px solid #e7d9c6;
    border-radius: 12px;
    padding: 10px 12px;
    margin-bottom: 10px;
  }
  .pdf-export .question-title {
    font-weight: 600;
    margin-bottom: 6px;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .pdf-export .text-block {
    border: 1px solid #e7d9c6;
    border-radius: 12px;
    padding: 12px;
    background: #fff;
    margin-bottom: 12px;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  .pdf-export .answer-line {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .pdf-export .answer-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #6b7280;
    white-space: nowrap;
  }
  .pdf-export .answer-rule {
    display: block;
    flex: 1;
    border-bottom: 1px solid #bfb6a6;
    height: 12px;
  }
  .pdf-export .blank {
    display: inline-flex;
    align-items: flex-end;
    gap: 6px;
    margin: 0 4px;
  }
  .pdf-export .blank-id {
    font-size: 10px;
    color: #6b7280;
  }
  .pdf-export .blank-line {
    display: block;
    flex: 1;
    min-width: 72px;
    border-bottom: 1px solid #bfb6a6;
    height: 12px;
  }
  .pdf-export .blank-lines {
    margin-top: 10px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 12px;
  }
  .pdf-export .blank-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
  }
  .pdf-export .blank-row .answer-rule {
    height: 12px;
  }
  .pdf-export .word-bank {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .pdf-export .word-bank span {
    border: 1px solid #e7d9c6;
    border-radius: 999px;
    padding: 4px 8px;
    background: #fbf7f0;
    font-size: 11px;
  }
  .pdf-export .corrections {
    page-break-before: always;
    break-before: page;
  }
  .pdf-export .corrections-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
  }
  .pdf-export .correction-block {
    border: 1px solid #e7d9c6;
    border-radius: 12px;
    padding: 10px 12px;
    margin-bottom: 10px;
    background: #fff;
  }
  .pdf-export .doc-title {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 4px;
  }
  .pdf-export .doc-subtitle {
    font-size: 12px;
    color: #5c6672;
    margin-bottom: 16px;
  }
`;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapWords(value) {
  const text = String(value || "");
  return text
    .split(/(\s+)/)
    .map((chunk) => {
      if (!chunk) {
        return "";
      }
      if (/^\s+$/.test(chunk)) {
        return chunk;
      }
      return `<span class="no-break">${escapeHtml(chunk)}</span>`;
    })
    .join("");
}

function wrapAllWords(root) {
  const doc = root?.ownerDocument || document;
  const nodeFilter = (doc.defaultView && doc.defaultView.NodeFilter) || NodeFilter;
  const walker = doc.createTreeWalker(
    root,
    nodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return nodeFilter.FILTER_SKIP;
        }
        const parent = node.parentElement;
        if (!parent) {
          return nodeFilter.FILTER_SKIP;
        }
        if (parent.closest(".no-break")) {
          return nodeFilter.FILTER_SKIP;
        }
        const tag = parent.tagName;
        if (tag === "STYLE" || tag === "SCRIPT" || tag === "TITLE") {
          return nodeFilter.FILTER_SKIP;
        }
        return nodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodes = [];
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  nodes.forEach((textNode) => {
    const parts = textNode.nodeValue.split(/(\s+)/);
    const fragment = doc.createDocumentFragment();
    parts.forEach((part) => {
      if (!part) {
        return;
      }
      if (/^\s+$/.test(part)) {
        fragment.append(doc.createTextNode(part));
        return;
      }
      const span = doc.createElement("span");
      span.className = "no-break";
      span.textContent = part;
      fragment.append(span);
    });
    textNode.parentNode.replaceChild(fragment, textNode);
  });
}

function renderHeaderBlock(title, subtitle) {
  return `
    <div class="meta">
      <div class="meta-title">${wrapWords(title)}</div>
      <div class="meta-subtitle">${wrapWords(subtitle || "")}</div>
    </div>
  `;
}

function renderAnswerLine(label) {
  const safeLabel = label ? wrapWords(label) : wrapWords("Antwort");
  return `
    <div class="answer-line">
      <span class="answer-label">${safeLabel}:</span>
      <span class="answer-rule"></span>
    </div>
  `;
}

function getBlankIdsFromSegments(segments) {
  const ids = [];
  const seen = new Set();
  (segments || []).forEach((segment) => {
    if (segment.type === "text") {
      return;
    }
    const value = segment.id;
    if (value === undefined || value === null) {
      return;
    }
    const key = String(value);
    if (!seen.has(key)) {
      seen.add(key);
      ids.push(key);
    }
  });
  return ids;
}

function getBlankIds(content) {
  const ids = [];
  const seen = new Set();
  const addId = (value) => {
    if (value === undefined || value === null) {
      return;
    }
    const key = String(value);
    if (!seen.has(key)) {
      seen.add(key);
      ids.push(key);
    }
  };
  (content?.blanks || []).forEach((blank) => addId(blank.id));
  getBlankIdsFromSegments(content?.segments || []).forEach(addId);
  return ids;
}

function renderBlankLines(blankIds) {
  if (!blankIds.length) {
    return "";
  }
  return `
    <div class="blank-lines">
      ${blankIds
        .map(
          (id) => `
            <div class="blank-row">
              <span class="answer-label">Lücke ${wrapWords(id)}</span>
              <span class="answer-rule"></span>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTextList(items, options = {}) {
  const answerLabel = options.answerLabel;
  return (items || [])
    .map(
      (item) => `
        <div class="item">
          <div class="item-id">${wrapWords(item.id)}</div>
          <div class="item-text">${wrapWords(item.text)}</div>
          ${answerLabel ? renderAnswerLine(answerLabel) : ""}
        </div>
      `
    )
    .join("");
}

function renderTextGrid(items, options = {}) {
  const answerLabel = options.answerLabel;
  return `
    <div class="grid-two">
      ${(items || [])
        .map(
          (item) => `
            <div class="item">
              <div class="item-id">${wrapWords(item.id)}</div>
              <div class="item-text">${wrapWords(item.text)}</div>
              ${answerLabel ? renderAnswerLine(answerLabel) : ""}
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderHeadlines(items) {
  return `
    <ul class="list">
      ${(items || [])
        .map(
          (item) => `
            <li><strong>${wrapWords(item.id)}.</strong> ${wrapWords(item.text)}</li>
          `
        )
        .join("")}
    </ul>
  `;
}

function splitParagraphs(paragraphs) {
  const list = paragraphs || [];
  const totalChars = list.reduce((sum, item) => sum + item.length, 0);
  if (list.length <= 4 && totalChars < 1400) {
    return [list];
  }
  const target = totalChars / 2;
  const first = [];
  const second = [];
  let current = 0;
  list.forEach((para, index) => {
    if (index === list.length - 1) {
      second.push(para);
      return;
    }
    if (current < target) {
      first.push(para);
      current += para.length;
    } else {
      second.push(para);
    }
  });
  return [first, second].filter((block) => block.length);
}

function renderQuestion(question) {
  const options = (question.options || [])
    .map(
      (option) => `
        <li><strong>${wrapWords(option.id.toUpperCase())})</strong> ${wrapWords(option.text)}</li>
      `
    )
    .join("");
  return `
    <div class="question">
      <div class="question-title">${wrapWords(question.id)}. ${wrapWords(question.prompt)}</div>
      <ul class="list">${options}</ul>
      ${renderAnswerLine("Antwort")}
    </div>
  `;
}

function renderSegments(segments) {
  return (segments || [])
    .map((segment) => {
      if (segment.type === "text") {
        return wrapWords(segment.value);
      }
      return `
        <span class="blank">
          <span class="blank-id">${wrapWords(segment.id)}</span>
          <span class="blank-line"></span>
        </span>
      `;
    })
    .join("");
}

function renderOptionsPerBlank(blanks) {
  return `
    <ul class="list grid-two">
      ${(blanks || [])
        .map(
          (blank) => `
            <li><strong>Lücke ${wrapWords(blank.id)}:</strong> ${wrapWords(
              (blank.options || []).join(" / ")
            )}</li>
          `
        )
        .join("")}
    </ul>
  `;
}

function renderWordBank(options) {
  return `
    <div class="word-bank">
      ${(options || []).map((option) => `<span>${wrapWords(option)}</span>`).join("")}
    </div>
  `;
}

function renderTeil1(content) {
  return `
    <section class="page">
      ${renderHeaderBlock("Lesen Teil 1", content.instruction || "")}
      <div class="section">
        <h3>${wrapWords("Überschriften")}</h3>
        ${renderHeadlines(content.headlines || [])}
      </div>
      <div class="section">
        <h3>${wrapWords("Texte")}</h3>
        ${renderTextList(content.texts || [], { answerLabel: "Antwort" })}
      </div>
    </section>
  `;
}

function renderTeil2(content) {
  const paragraphList = content.passage?.paragraphs || [];
  const textBlocks = splitParagraphs(paragraphList)
    .map((block) => block.map((para) => `<p>${wrapWords(para)}</p>`).join(""))
    .map((block) => `<div class="text-block">${block || ""}</div>`)
    .join("");
  const questions = (content.questions || []).map(renderQuestion).join("");
  return `
    <section class="page">
      ${renderHeaderBlock("Lesen Teil 2", content.instruction || "")}
      <h3>${wrapWords(content.passage?.title || "")}</h3>
      ${textBlocks}
      <h3>${wrapWords("Aufgaben")}</h3>
      ${questions}
    </section>
  `;
}

function renderTeil3(content) {
  return `
    <section class="page">
      ${renderHeaderBlock("Lesen Teil 3", "Ordnen Sie die Situationen den Anzeigen zu.")}
      <h3>${wrapWords("Situationen")}</h3>
      ${renderTextGrid(content.situations || [], { answerLabel: "Antwort" })}
      <h3>${wrapWords("Anzeigen")}</h3>
      ${renderTextGrid(content.ads || [])}
    </section>
  `;
}

function renderSprach1(content) {
  const blanks = content.blanks || [];
  const blankIds = getBlankIds(content);
  return `
    <section class="page">
      ${renderHeaderBlock("Sprachbausteine 1", content.instruction || "")}
      <div class="text-block">${renderSegments(content.segments || [])}</div>
      ${renderBlankLines(blankIds)}
      <h3>${wrapWords("Optionen")}</h3>
      ${renderOptionsPerBlank(blanks)}
    </section>
  `;
}

function renderSprach2(content) {
  const blankIds = getBlankIds(content);
  const wordBank = (content.wordBank && content.wordBank.length)
    ? content.wordBank.map((item) => item.text || item.answer || item)
    : (content.options || []).length
      ? content.options
      : (content.blanks || []).map((item) => item.answer).filter(Boolean);
  return `
    <section class="page">
      ${renderHeaderBlock("Sprachbausteine 2", content.instruction || "")}
      <div class="text-block">${renderSegments(content.segments || [])}</div>
      ${renderBlankLines(blankIds)}
      <h3>${wrapWords("Wortliste")}</h3>
      ${renderWordBank(wordBank)}
    </section>
  `;
}

function renderCorrections(lesenEntry, label) {
  const parts = lesenEntry.parts || {};
  const blocks = PDF_PART_ORDER.filter((key) => parts[key]).map((partKey) => {
    const content = parts[partKey].content || {};
    if (partKey === "teil-1") {
      const answers = (content.answers || [])
        .map((answer) => `<li>${wrapWords(`Text ${answer.textId} → ${answer.headlineId}`)}</li>`)
        .join("");
      return `
        <div class="correction-block">
          <h3>${wrapWords("Lesen Teil 1")}</h3>
          <ul class="list">${answers}</ul>
        </div>
      `;
    }
    if (partKey === "teil-2") {
      const answers = (content.questions || [])
        .map(
          (question) =>
            `<li>${wrapWords(
              `Frage ${question.id} → ${(question.answerId?.toUpperCase() || "")} ${question.answerText || ""}`
            )}</li>`
        )
        .join("");
      return `
        <div class="correction-block">
          <h3>${wrapWords("Lesen Teil 2")}</h3>
          <ul class="list">${answers}</ul>
        </div>
      `;
    }
    if (partKey === "teil-3") {
      const answers = (content.answers || [])
        .map(
          (answer) =>
            `<li>${wrapWords(`Situation ${answer.situationId} → ${answer.adId}`)}</li>`
        )
        .join("");
      return `
        <div class="correction-block">
          <h3>${wrapWords("Lesen Teil 3")}</h3>
          <ul class="list">${answers}</ul>
        </div>
      `;
    }
    if (partKey === "sprachbausteine-1") {
      const answers = (content.answers || [])
        .map((answer) => `<li>${wrapWords(`Lücke ${answer.id} → ${answer.answer}`)}</li>`)
        .join("");
      return `
        <div class="correction-block">
          <h3>${wrapWords("Sprachbausteine 1")}</h3>
          <ul class="list">${answers}</ul>
        </div>
      `;
    }
    if (partKey === "sprachbausteine-2") {
      const answers = (content.answers || [])
        .map((answer) => `<li>${wrapWords(`Lücke ${answer.id} → ${answer.answer}`)}</li>`)
        .join("");
      return `
        <div class="correction-block">
          <h3>${wrapWords("Sprachbausteine 2")}</h3>
          <ul class="list">${answers}</ul>
        </div>
      `;
    }
    return "";
  });

  const titleText = label ? `Korrekturen (${label})` : "Korrekturen";
  const title = wrapWords(titleText);
  return `
    <section class="page corrections">
      <h2>${title}</h2>
      <div class="corrections-grid">
        ${blocks.join("")}
      </div>
    </section>
  `;
}

function buildPdfMarkup({ levelLabel, versions }) {
  const versionBlocks = (versions || []).map((version) => {
    const lesenEntry = version.lesenEntry || {};
    const parts = lesenEntry.parts || {};
    const orderedParts = PDF_PART_ORDER.filter((key) => parts[key]).map((partKey) => {
      const content = parts[partKey].content || {};
      if (partKey === "teil-1") {
        return renderTeil1(content);
      }
      if (partKey === "teil-2") {
        return renderTeil2(content);
      }
      if (partKey === "teil-3") {
        return renderTeil3(content);
      }
      if (partKey === "sprachbausteine-1") {
        return renderSprach1(content);
      }
      if (partKey === "sprachbausteine-2") {
        return renderSprach2(content);
      }
      return "";
    });

    return `
      <div class="version-block">
        <div class="doc-title">${wrapWords(version.examTitle || "")}</div>
        <div class="doc-subtitle">${wrapWords(levelLabel)} · ${wrapWords(version.versionLabel || "")}</div>
        ${orderedParts.join("")}
        ${renderCorrections(lesenEntry, version.versionLabel)}
      </div>
    `;
  });

  return versionBlocks.join("");
}

async function fetchPdfBlob(url) {
  try {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      return null;
    }
    return await response.blob();
  } catch (error) {
    return null;
  }
}

function downloadBlob(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}


let cachedLogoData = null;

async function getLogoData() {
  if (cachedLogoData) {
    return cachedLogoData;
  }
  try {
    const response = await fetch("logo.svg", { cache: "force-cache" });
    if (!response.ok) {
      return null;
    }
    const svgText = await response.text();
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    const dataUrl = await new Promise((resolve, reject) => {
      image.onload = () => {
        const maxHeight = 24;
        const ratio = image.width / image.height || 1;
        const canvas = document.createElement("canvas");
        canvas.height = maxHeight;
        canvas.width = Math.round(maxHeight * ratio);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Logo load failed"));
      };
      image.src = url;
    });
    cachedLogoData = { dataUrl, width: image.width, height: image.height };
    return cachedLogoData;
  } catch (error) {
    return null;
  }
}

function addPdfHeaderFooter(pdf, { headerTitle, footerText, logoData }) {
  const pageCount = pdf.internal.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const headerY = 26;
  const footerY = pageHeight - 18;
  const leftMargin = 40;
  const rightMargin = pageWidth - 40;

  pdf.setFont("helvetica", "normal");
  for (let i = 1; i <= pageCount; i += 1) {
    pdf.setPage(i);
    if (logoData?.dataUrl) {
      const logoHeight = 18;
      const ratio = logoData.width / logoData.height || 1;
      const logoWidth = logoHeight * ratio;
      pdf.addImage(logoData.dataUrl, "PNG", leftMargin, headerY - 14, logoWidth, logoHeight);
      pdf.setFontSize(10);
      pdf.text("ZDeutsch Exam Library", leftMargin + logoWidth + 8, headerY);
    } else {
      pdf.setFontSize(10);
      pdf.text("ZDeutsch Exam Library", leftMargin, headerY);
    }
    pdf.setFontSize(12);
    pdf.text(headerTitle || "", rightMargin, headerY, { align: "right" });

    pdf.setFontSize(9);
    pdf.text(footerText || "", leftMargin, footerY);
    pdf.text(`Page ${i} / ${pageCount}`, rightMargin, footerY, { align: "right" });
  }
}

async function generatePdfFromData({ levelLabel, versions, fileName, headerTitle }) {
  if (!window.html2pdf) {
    throw new Error("html2pdf is not available.");
  }
  const styleTag = document.createElement("style");
  styleTag.textContent = PDF_STYLES;
  document.head.append(styleTag);

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.overflow = "auto";
  overlay.style.background = "rgba(255, 255, 255, 0.92)";
  overlay.style.zIndex = "9999";

  const container = document.createElement("div");
  container.className = "pdf-export";
  container.style.width = "210mm";
  container.style.margin = "0";
  container.style.background = "#ffffff";
  container.style.boxSizing = "border-box";
  container.innerHTML = buildPdfMarkup({
    levelLabel,
    versions
  });
  wrapAllWords(container);

  overlay.append(container);
  document.body.append(overlay);

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const worker = window.html2pdf()
      .set({
        margin: [60, 0, 50, 0],
        filename: fileName,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0
        },
        pagebreak: {
          mode: ["css", "legacy"],
          avoid: ".meta,.columns,.item,.question,.text-block,.correction-block,.blank-lines,.answer-line"
        },
        jsPDF: { unit: "pt", format: "a4", orientation: "portrait" }
      })
      .from(container);
    const pdf = await worker.toPdf().get("pdf");
    const logoData = await getLogoData();
    addPdfHeaderFooter(pdf, {
      headerTitle,
      footerText: "ZDeutsch community",
      logoData
    });
    pdf.save(fileName);
  } finally {
    overlay.remove();
    styleTag.remove();
  }
}

async function downloadThemePdf(themeKey, themeEntry) {
  if (!themeEntry || !themeKey) {
    return;
  }
  const versionKeys = getVersionKeys(themeEntry);
  const defaultVersion = themeEntry.defaultVersion || versionKeys[0] || "default";
  const activeVersionKey = state.theme === themeKey && state.version
    ? state.version
    : defaultVersion;
  const levelKey = state.level || "b1";
  const hasMultipleVersions = versionKeys.length > 1;
  const resolvedVersionKeys = versionKeys.length ? versionKeys : [activeVersionKey];
  const fileName = hasMultipleVersions
    ? getPdfFilename(levelKey, themeKey, "all")
    : getPdfFilename(levelKey, themeKey, activeVersionKey);
  const url = new URL(`exports/${fileName}`, window.location.href).href;
  const buildVersionData = (versionKey) => {
    const versionEntry = themeEntry.versions?.[versionKey] || themeEntry.versions?.default;
    const lesenEntry = versionEntry?.lesen || themeEntry.lesen;
    if (!lesenEntry) {
      return null;
    }
    return {
      versionKey,
      versionLabel: versionEntry?.label || versionKey,
      examTitle: versionEntry?.title || themeEntry.title || themeKey,
      lesenEntry
    };
  };
  const versions = (hasMultipleVersions ? resolvedVersionKeys : [activeVersionKey])
    .map(buildVersionData)
    .filter(Boolean);

  const existingBlob = await fetchPdfBlob(url);
  if (existingBlob) {
    downloadBlob(existingBlob, fileName);
    return;
  }

  if (!versions.length) {
    window.alert("PDF data is missing for this theme.");
    return;
  }

  try {
    await generatePdfFromData({
      levelLabel: levelKey.toUpperCase(),
      versions,
      fileName,
      headerTitle: themeEntry.title || themeKey
    });
  } catch (error) {
    console.error(error);
    window.alert("Failed to generate the PDF in the browser.");
  }
}


function getVersionKeys(themeEntry) {
  if (!themeEntry) {
    return [];
  }
  if (themeEntry.versionOrder?.length) {
    return themeEntry.versionOrder;
  }
  return Object.keys(themeEntry.versions || {});
}

function closeVersionModal() {
  if (!versionModal) {
    return;
  }
  versionModal.classList.add("hidden");
  state.pendingTheme = null;
}

function selectThemeVersion(themeKey, versionKey) {
  const levelEntry = state.db?.levels?.[state.level];
  const themeEntry = levelEntry?.themes?.[themeKey];
  if (!themeEntry) {
    return;
  }
  state.theme = themeKey;
  state.version = versionKey;
  state.section = "lesen";
  const lesenEntry = getActiveLesen(themeEntry);
  const order = lesenEntry?.partOrder || Object.keys(lesenEntry?.parts || {});
  state.part = order[0] || null;
  closeVersionModal();
  setView("exam");
  startExamTimer();
  renderCurrentPart();
}

function openVersionModal(themeKey, themeEntry) {
  if (!versionModal || !versionOptions) {
    const versionKeys = getVersionKeys(themeEntry);
    const fallback = themeEntry.defaultVersion || versionKeys[0] || "default";
    selectThemeVersion(themeKey, fallback);
    return;
  }
  state.pendingTheme = themeKey;
  if (versionTitle) {
    versionTitle.textContent = themeEntry.title || "Select version";
  }
  versionOptions.innerHTML = "";
  const versionKeys = getVersionKeys(themeEntry);
  versionKeys.forEach((versionKey) => {
    const versionEntry = themeEntry.versions?.[versionKey];
    const label = versionEntry?.label || `Version ${versionKey}`;
    const isDefault = versionKey === themeEntry.defaultVersion;
    const button = createEl(
      "button",
      classNames(
        "w-full rounded-2xl border border-stone-300 bg-white/90 p-4 text-left shadow-sm transition-transform",
        isDefault ? "ring-2 ring-azure/20" : "hover:border-stone-300 hover:-translate-y-0.5"
      )
    );
    button.type = "button";
    button.type = "button";
    button.append(
      createEl("div", "text-sm font-display text-ink", label),
      createEl("div", "mt-1 text-xs text-slate", versionEntry?.title || "")
    );
    button.addEventListener("click", () => {
      selectThemeVersion(themeKey, versionKey);
    });
    versionOptions.append(button);
  });
  versionModal.classList.remove("hidden");
}

function handleThemeSelection(themeKey, themeEntry) {
  const versionKeys = getVersionKeys(themeEntry);
  if (versionKeys.length > 1) {
    openVersionModal(themeKey, themeEntry);
    return;
  }
  const fallback = themeEntry.defaultVersion || versionKeys[0] || "default";
  selectThemeVersion(themeKey, fallback);
}

function renderLevelButtons() {
  const levels = Object.keys(state.db.levels || {});
  if (!state.level) {
    state.level = levels[0] || null;
  }
  levelList.innerHTML = "";
  levels.forEach((levelKey) => {
    const button = renderChoiceButton(levelKey.toUpperCase(), levelKey === state.level);
    button.type = "button";
    button.addEventListener("click", () => {
      state.level = levelKey;
      state.section = "lesen";
      state.theme = null;
      state.version = null;
      renderHome();
    });
    levelList.append(button);
  });
}

function renderSectionButtons() {
  state.section = "lesen";
  sectionList.innerHTML = "";
  const button = renderChoiceButton("LESEN", true);
  button.type = "button";
  sectionList.append(button);
}

function renderThemeCards() {
  themeGrid.innerHTML = "";
  const levelEntry = state.db.levels[state.level] || {};
  let themes = levelEntry.themeOrder?.length
    ? levelEntry.themeOrder
    : Object.keys(levelEntry.themes || {});
  const query = normalize(state.search);
  if (query) {
    themes = themes.filter((themeKey) => {
      const entry = levelEntry.themes?.[themeKey];
      const title = entry?.title || themeKey;
      return normalize(title).includes(query);
    });
  }
  if (state.theme && !themes.includes(state.theme)) {
    state.theme = null;
  }
  if (!state.theme && themes.length) {
    state.theme = themes[0] || null;
  }

  themes.forEach((themeKey) => {
    const themeEntry = levelEntry.themes?.[themeKey];
    if (!themeEntry) {
      return;
    }
    const versionKeys = getVersionKeys(themeEntry);
    const defaultVersion = themeEntry.defaultVersion || versionKeys[0];
    const versionEntry = themeEntry.versions?.[defaultVersion];
    const partCount = versionEntry?.lesen?.partOrder?.length
      || versionEntry?.lesen?.counts?.parts
      || themeEntry.lesen?.partOrder?.length
      || themeEntry.lesen?.counts?.parts
      || themeEntry.counts?.parts
      || 0;
    const card = createEl(
      "button",
      classNames(
        "rounded-2xl border border-stone-300 bg-white/90 p-5 text-left shadow-panel transition-transform min-h-[140px] flex flex-col justify-between",
        themeKey === state.theme ? "ring-2 ring-azure/30" : "hover:border-stone-300 hover:-translate-y-0.5"
      )
    );
    card.type = "button";
    const header = createEl("div", "flex items-start justify-between gap-3");
    const titleWrap = createEl("div", "space-y-1");
    titleWrap.append(
      createEl("div", "text-sm font-display text-ink", themeEntry.title || themeKey),
      createEl("div", "text-xs text-slate", "Reading practice")
    );
    const actions = createEl("div", "flex items-center gap-2");
    const levelBadge = createEl(
      "span",
      "rounded-full border border-azure/40 bg-azure/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-azure font-display",
      (state.level || "").toUpperCase()
    );
    const downloadBtn = createEl(
      "button",
      "h-7 w-7 rounded-lg border border-stone-200 bg-white/80 text-slate flex items-center justify-center shadow-sm hover:border-stone-300"
    );
    downloadBtn.type = "button";
    downloadBtn.title = "Download PDF";
    downloadBtn.append(makeDownloadIcon());
    downloadBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      downloadThemePdf(themeKey, themeEntry);
    });
    actions.append(levelBadge, downloadBtn);
    header.append(titleWrap, actions);

    const meta = createEl("div", "mt-4 flex flex-wrap items-center gap-2");
    meta.append(makeMetaPill(`${partCount} parts`));
    if (versionKeys.length > 1) {
      meta.append(makeMetaPill(`${versionKeys.length} versions`));
    }

    card.append(header, meta);
    card.addEventListener("click", () => {
      handleThemeSelection(themeKey, themeEntry);
    });
    themeGrid.append(card);
  });

  if (!themes.length) {
    themeGrid.append(
      createEl(
        "div",
        "rounded-2xl border border-stone-200 bg-stone-50 p-6 text-sm text-slate",
        "No themes found."
      )
    );
  }
  refreshIcons();
}

function renderHome() {
  renderLevelButtons();
  renderSectionButtons();
  renderThemeCards();
  if (themeSearchInput) {
    themeSearchInput.value = state.search || "";
  }
}

function toggleSettingsPanel(force) {
  if (!settingsPanel) {
    return;
  }
  const show = typeof force === "boolean" ? force : settingsPanel.classList.contains("hidden");
  settingsPanel.classList.toggle("hidden", !show);
}

backBtn.addEventListener("click", () => {
  setView("home");
  renderHome();
});

if (settingsBtn && settingsPanel) {
  settingsBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSettingsPanel();
  });

  settingsPanel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", () => {
    toggleSettingsPanel(false);
  });
}

if (fontSizeInput) {
  fontSizeInput.addEventListener("input", () => {
    const value = Number.parseFloat(fontSizeInput.value);
    applyFontScale(value);
    window.localStorage.setItem("fontScale", String(value));
  });
}

if (timerToggle) {
  timerToggle.addEventListener("change", () => {
    setTimerEnabled(timerToggle.checked);
  });
}

if (themeSearchInput) {
  themeSearchInput.addEventListener("input", () => {
    state.search = themeSearchInput.value || "";
    renderThemeCards();
  });
}

if (versionCloseBtn) {
  versionCloseBtn.addEventListener("click", () => {
    closeVersionModal();
  });
}

if (versionOverlay) {
  versionOverlay.addEventListener("click", () => {
    closeVersionModal();
  });
}

prevBtn.addEventListener("click", () => {
  const themeEntry = getThemeEntry();
  const order = getActiveLesen(themeEntry)?.partOrder || [];
  const index = order.indexOf(state.part);
  if (index > 0) {
    state.part = order[index - 1];
    renderCurrentPart();
  }
});

nextBtn.addEventListener("click", () => {
  const themeEntry = getThemeEntry();
  const order = getActiveLesen(themeEntry)?.partOrder || [];
  const index = order.indexOf(state.part);
  if (index >= 0 && index < order.length - 1) {
    state.part = order[index + 1];
    renderCurrentPart();
    return;
  }
  if (index === order.length - 1) {
    setView("results");
    renderResults();
  }
});

if (resultRetryBtn) {
  resultRetryBtn.addEventListener("click", () => {
    resetCurrentTheme();
    const themeEntry = getThemeEntry();
    const order = getActiveLesen(themeEntry)?.partOrder || [];
    state.part = order[0] || null;
    setView("exam");
    startExamTimer();
    renderCurrentPart();
  });
}

if (resultHomeBtn) {
  resultHomeBtn.addEventListener("click", () => {
    setView("home");
    renderHome();
  });
}

async function init() {
  state.config = await loadConfig();
  const storedScale = getStoredFontScale();
  const scale = storedScale ?? state.config.fontScale ?? DEFAULT_CONFIG.fontScale;
  applyFontScale(scale);
  if (fontSizeInput) {
    fontSizeInput.value = String(scale);
  }
  applyAsideWidth(state.config.asideWidth);
  applyTimerConfig();

  setHomeLoaderVisible(true);
  state.db = await loadDatabase();
  setHomeLoaderVisible(false);
  if (!state.db) {
    renderMessage("database/lesen.json not found. Run scripts/build_database.py");
    return;
  }

  state.section = "lesen";
  setView("home");
  renderHome();
}

init();
