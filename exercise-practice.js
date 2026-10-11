(async function () {
  "use strict";
  const C = window.ZDeutschExercises, UI = window.PracticeUI;
  const root = document.getElementById("exercise-main"), saveStatus = document.getElementById("exercise-save-status");
  const id = new URLSearchParams(location.search).get("exercise");
  let item, saved = { responses: {}, draft: "" }, showSolutions = false;
  const storageKey = () => `zdeutsch.exercise-additions.v1:${item.id}`;
  function notice(text) { root.replaceChildren(UI.el("p", "exercise-note", text)); }
  function persist() {
    try { localStorage.setItem(storageKey(), JSON.stringify(saved)); saveStatus.textContent = "Gespeichert"; }
    catch (_) { saveStatus.textContent = "Speichern nicht möglich. Bitte sichern Sie Ihren Text vor dem Schließen."; }
  }
  function canCheck() { return C.hasAnswerKey(item); }
  function answer(number) {
    if (item.module === "horen") return item.payload.statements.find(s => String(s.id) === String(number))?.correct;
    return item.payload.answers.find(a => String(a.id) === String(number))?.answer;
  }
  function renderChoice(q, value, label, text) {
    const correct = answer(q), selected = saved.responses[q] === value;
    const result = canCheck() && showSolutions ? (value === correct ? "correct" : selected ? "incorrect" : "") : "";
    const button = UI.option({ label, text, selected, result, radio: true });
    button.dataset.question = String(q); button.dataset.choice = String(value);
    button.addEventListener("click", () => {
      saved.responses[q] = value; persist(); render();
      [...root.querySelectorAll(".practice-option")].find(node => node.dataset.question === String(q) && node.dataset.choice === String(value))?.focus({ preventScroll: true });
    });
    return button;
  }
  function names() {
    const labels = [...new Set([item.title, ...(item.names || [])])];
    if (labels.length < 2) return null;
    const details = UI.el("details", "exercise-name-details");
    details.append(UI.el("summary", "", "Auch bekannt als"), UI.el("p", "", labels.join(" · ")));
    return details;
  }
  function renderGrammar(grid) {
    const left = UI.panel({ label: "Lückentext", className: "exercise-source-panel" }), right = UI.panel({ label: "Antworten" });
    left.append(UI.heading("Lückentext"), UI.reading({ children: [UI.el("p", "", item.payload.text.replace(/\[\[(\d+)\]\]/g, "($1) _____"))] }));
    right.append(UI.heading("Antworten"));
    for (const blank of item.payload.blanks) {
      const q = UI.question({ number: blank.id, prompt: `Lücke ${blank.id}` }), options = UI.el("div", "exercise-options");
      options.setAttribute("role", "radiogroup"); options.setAttribute("aria-label", `Lücke ${blank.id}`);
      blank.options.forEach((text, index) => options.append(renderChoice(String(blank.id), text, String.fromCharCode(65 + index), text)));
      q.append(options); right.append(q);
    }
    grid.append(left, right);
  }
  function renderListening(grid) {
    const panel = UI.panel({ label: "Aussagen" }); panel.style.gridColumn = "1 / -1";
    panel.append(UI.heading("Aussagen"));
    if (item.audio?.status === "verified" && /^assets\/audio\/[^?#]+\.(mp3|m4a|wav|ogg)$/i.test(item.audio.src)) panel.append(UI.audio({ source: item.audio.src, title: item.title }));
    else panel.append(UI.el("p", "exercise-context", "Aussagenübung ohne geprüfte Aufnahme"));
    for (const statement of item.payload.statements) {
      const q = UI.question({ number: statement.number, prompt: statement.text });
      const options = UI.el("div", "exercise-options"); options.setAttribute("role", "radiogroup"); options.setAttribute("aria-label", `Aussage ${statement.number}`);
      options.append(renderChoice(statement.id, true, "", "Richtig"), renderChoice(statement.id, false, "", "Falsch"));
      q.append(options); panel.append(q);
    }
    grid.append(panel);
  }
  function renderWriting(grid) {
    const left = UI.panel({ label: "Schreibaufgabe", className: "exercise-source-panel" }), right = UI.panel({ label: "Ihr Entwurf" });
    left.append(UI.heading("Schreibaufgabe"), UI.reading({ children: [UI.el("div", "exercise-preserve-lines", item.payload.content), UI.el("p", "exercise-preserve-lines", item.payload.tasks)] }));
    right.append(UI.heading("Ihr Entwurf"));
    const editor = UI.editor({ value: saved.draft, attributes: { "aria-label": "Ihr Entwurf", spellcheck: "true", lang: "de" } });
    const count = UI.el("p", "exercise-context");
    const update = () => { count.textContent = `${editor.value.trim().split(/\s+/).filter(Boolean).length} Wörter · mindestens ${item.payload.minimumWords || 150}`; };
    editor.addEventListener("input", () => { saved.draft = editor.value; persist(); update(); });
    update(); right.append(editor, count); grid.append(left, right);
  }
  function render() {
    const context = item.target?.file === "lesen.json" ? `Im Thema „${item.contextTitle}“ · ${item.versionLabel}` : item.target ? item.contextTitle : "Einzelübung";
    root.replaceChildren(UI.el("h1", "", item.title), UI.el("p", "exercise-context", `${item.level.toUpperCase()} · ${C.partLabel(item)} · ${context}`));
    const knownNames = names(); if (knownNames) root.append(knownNames);
    if (!canCheck() && item.module !== "shreiben") root.append(UI.el("p", "exercise-note", "Für diese Übung fehlen Lösungen. Es wird kein Prüfungsergebnis berechnet."));
    const instruction = UI.instruction(item.payload.instruction || item.payload.istructions); if (instruction) root.append(instruction);
    const grid = UI.el("div", "exercise-grid");
    if (item.module === "horen") renderListening(grid);
    else if (item.module === "shreiben") renderWriting(grid);
    else renderGrammar(grid);
    root.append(grid);
    if (item.module !== "shreiben") {
      const actions = UI.el("div", "exercise-actions");
      const reveal = UI.button(showSolutions ? "Lösungen ausblenden" : "Antworten prüfen", { variant: "primary", attributes: { "aria-pressed": showSolutions, ...(!canCheck() ? { disabled: true } : {}) } });
      reveal.addEventListener("click", () => { showSolutions = !showSolutions; render(); root.querySelector(".exercise-actions button")?.focus({ preventScroll: true }); });
      actions.append(reveal);
      if (canCheck() && showSolutions) {
        const questions = item.module === "horen" ? item.payload.statements.map(s => s.id) : item.payload.blanks.map(b => String(b.id));
        const correct = questions.filter(q => saved.responses[q] === answer(q)).length;
        actions.append(UI.el("p", "exercise-source-status", `${correct} von ${questions.length} richtig`));
      }
      root.append(actions);
    }
    const source = UI.el("p", "exercise-source-status", "Aus dem alten Bestand · ");
    const link = UI.el("a", "", "Originalaufgabe"); link.href = `https://telc.site/quiz/${encodeURIComponent(item.provenance.quizId)}`; link.target = "_blank"; link.rel = "noopener"; source.append(link); root.append(source);
    if (window.lucide) window.lucide.createIcons();
  }
  try {
    const { additions, errors } = await C.loadAll();
    const merged = await C.loadMergedExercises();
    item = merged.find(exercise => exercise.id === id && exercise.enabled !== false) || additions.exercises.find(exercise => exercise.id === id && exercise.enabled !== false);
    if (!item) { notice(errors.length ? "Die zusätzlichen Übungen konnten nicht geladen werden. Bitte versuchen Sie es erneut." : "Diese Einzelübung wurde nicht gefunden."); return; }
    if (item.target?.file === "lesen.json") {
      location.replace(C.targetUrl(item.target));
      return;
    }
    try { const parsed = JSON.parse(localStorage.getItem(storageKey()) || "null"); if (parsed && typeof parsed.responses === "object" && parsed.responses) saved = { responses: parsed.responses, draft: typeof parsed.draft === "string" ? parsed.draft : "" }; } catch (_) {}
    document.getElementById("level-pill").textContent = item.level.toUpperCase();
    document.title = `${item.title} | ZDeutsch`;
    document.getElementById("exercise-title").textContent = item.title;
    document.getElementById("exercise-title").parentElement.append(UI.newBadge());
    document.getElementById("exercise-back").href = `index.html?level=${item.level}&collection=exercises&section=${item.module}&part=${encodeURIComponent(item.partKey)}`;
    document.getElementById("exercise-settings").hidden = true;
    document.getElementById("part-cards-wrap").hidden = true;
    render();
  } catch (error) { console.error(error); notice("Die Übung konnte nicht geladen werden. Bitte versuchen Sie es erneut."); }
})();
