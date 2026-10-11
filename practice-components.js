(function (root) {
  "use strict";
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function attrs(node, values = {}) {
    for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== null) node.setAttribute(key, String(value));
    return node;
  }
  function icon(name) { return attrs(el("i"), { "data-lucide": name, "aria-hidden": "true" }); }
  function button(text, { variant = "secondary", icon: symbol, attributes = {}, className = "" } = {}) {
    const node = attrs(el("button", `practice-action practice-action-${variant} ${className}`.trim()), { type: "button", ...attributes });
    if (symbol) node.append(icon(symbol));
    if (text) node.append(el("span", "", text));
    return node;
  }
  function tab({ label, active = false, complete = false, attributes = {}, className = "" }) {
    const node = attrs(el("button", `practice-tab ${className}`.trim(), label), { type: "button", "aria-pressed": active, ...attributes });
    if (complete) node.append(icon("check"));
    return node;
  }
  function instruction(text) {
    if (!text) return null;
    const node = el("div", "practice-instruction");
    node.append(el("div", "practice-kicker", "Aufgabe"), el("p", "", text));
    return node;
  }
  function heading(title, subtitle = "") {
    const node = el("div", "practice-panel-heading");
    node.append(el("h2", "", title));
    if (subtitle) node.append(el("p", "practice-kicker", subtitle));
    return node;
  }
  function newBadge() {
    return attrs(el("span", "practice-new-badge", "Neu"), { title: "Neu hinzugefügt" });
  }
  function reading({ node, tag = "div", className = "", children = [] } = {}) {
    const block = node || el(tag, className);
    block.classList.add("practice-reading");
    block.append(...children);
    return block;
  }
  function option({ label, text, translation, translationInline = false, selected = false, result = "", used = false, radio = false, tag = "button", attributes = {}, className = "", children = [] } = {}) {
    const node = attrs(el(tag, `practice-option ${className}`.trim()), {
      ...(tag === "button" ? { type: "button", "data-selected": selected, "data-result": result, "data-used": used,
        ...(radio ? { role: "radio", "aria-checked": selected } : { "aria-pressed": selected }) } : {}), ...attributes
    });
    if (label !== undefined && label !== "") node.append(el("span", "practice-option-label", label));
    if (text !== undefined) {
      const content = el("span", "practice-option-text", text);
      if (translation?.text) content.append(" ", attrs(el("bdi", `practice-option-translation${translationInline ? " practice-option-translation-inline" : ""}`, translation.text), { lang: translation.lang, dir: "auto" }));
      node.append(content);
    }
    node.append(...children);
    return node;
  }
  function gap({ text, translation, active = false, selected = false, result = "", multiline = false, attributes = {} }) {
    // Sentence gaps need a wrapping inline box instead of an atomic native button.
    const node = attrs(el(multiline ? "span" : "button", `practice-gap${multiline ? " practice-gap-sentence" : ""}`, text), {
      ...(multiline ? { role: "button", tabindex: attributes.disabled !== undefined ? -1 : 0, "aria-disabled": attributes.disabled !== undefined } : { type: "button" }),
      "data-active": active, "data-selected": selected, "data-result": result, ...attributes
    });
    if (translation?.text) node.append(" ", attrs(el("bdi", "practice-gap-translation", translation.text), { lang: translation.lang, dir: "auto" }));
    return node;
  }
  function reviewBar({ submitted = false, scoreText = "", actionLabel, onAction, attributes = {} } = {}) {
    const wrapper = el("div", "exam-action-bar practice-review sticky bottom-0 left-0 right-0 pt-4");
    const row = el("div", "exam-action-bar-inner flex items-center justify-between gap-2");
    if (scoreText) wrapper.append(el("div", "practice-score", scoreText));
    const action = button(actionLabel || (submitted ? "Neu versuchen" : "Antworten prüfen"), {
      variant: submitted ? "secondary" : "primary", className: submitted ? "flex-1" : "w-full", attributes
    });
    if (onAction) action.addEventListener("click", onAction);
    row.append(action);
    wrapper.append(row);
    return wrapper;
  }
  function question({ number, prompt, attributes = {} }) {
    const node = attrs(el("div", "practice-question"), attributes);
    const row = el("div", "practice-question-heading");
    row.append(el("span", "practice-question-number", `${number}.`), el("span", "", prompt));
    node.append(row);
    return node;
  }
  function panel({ id, label, tag = "section", className = "" }) {
    return attrs(el(tag, `exam-panel practice-panel ${className}`.trim()), { id, "aria-label": label });
  }
  function editor({ value = "", attributes = {}, className = "" }) {
    const node = attrs(el("textarea", `practice-editor ${className}`.trim()), attributes);
    node.value = value || "";
    node.textContent = value || "";
    return node;
  }
  function audio({ source, title = "Aufnahme", id }) {
    const node = el("div", "horen-audio practice-audio");
    const label = el("div", "horen-audio__label");
    label.append(icon("headphones"), el("span", "", title));
    const player = attrs(el("audio", "horen-audio__player"), { id, controls: "", preload: "metadata", src: source, "aria-label": title });
    node.append(label, player);
    return node;
  }
  function themeCard({ title, subtitle = "", status = "Noch kein Versuch", statusClass = "theme-card-status-new", progress = 0, scoreLabel = "Letztes Ergebnis", scoreText, meta = [], action = "Öffnen", actions = [], onOpen, attributes = {}, isNew = false, compact = false }) {
    const card = attrs(el("article", "theme-card"), attributes);
    const header = el("div", "theme-card-header");
    const titleButton = attrs(el("button", "theme-card-title-wrap theme-card-open"), { type: "button", "aria-label": `${title} öffnen` });
    titleButton.append(el("span", "theme-card-title", title), el("span", "theme-card-subtitle", subtitle));
    const tools = el("div", "theme-card-actions");
    if (isNew) tools.append(newBadge());
    if (compact && actions.length) {
      const menu = el("details", "theme-card-menu");
      menu.append(attrs(el("summary", "theme-card-more", "⋯"), { "aria-label": `${title}: Aktionen`, title: "Weitere Aktionen" }));
      const items = el("div", "theme-card-menu-items");
      items.append(...actions); menu.append(items); tools.append(menu);
    } else tools.append(...actions);
    header.append(titleButton, tools);
    const summary = el("div", "theme-card-summary");
    if (status) summary.append(el("span", `theme-card-status ${statusClass}`, status));
    if (scoreText !== null && (!compact || progress !== null)) {
      const score = el("div", "theme-card-score");
      score.append(el("span", "theme-card-score-label", scoreLabel), el("span", "theme-card-score-value", scoreText ?? `${progress}%`));
      summary.append(score);
    }
    const track = el("div", "theme-card-progress-track");
    const fill = el("div", "theme-card-progress-fill");
    fill.style.width = `${Math.min(100, Math.max(0, Number(progress) || 0))}%`;
    track.append(fill);
    const footer = el("div", "theme-card-footer");
    const details = el("div", "theme-card-meta");
    details.append(...meta.map(text => el("span", "theme-meta-pill", text)));
    const open = attrs(el("button", "theme-card-cta", action), { type: "button", "aria-label": `${title} öffnen` });
    if (onOpen) { titleButton.addEventListener("click", onOpen); open.addEventListener("click", onOpen); }
    footer.append(details, open);
    if (compact) card.classList.add("theme-card-compact");
    card.append(header);
    if (summary.childNodes.length) card.append(summary);
    if (progress !== null) card.append(track);
    card.append(footer);
    return card;
  }
  function header({ backId = "back-btn", titleId = "theme-title", levelId = "level-pill", tabsId = "part-cards", settingsId = "settings-btn", settingsPanelId = "settings-panel", timerId = "timer-display", timerValueId = "timer-value", modeId, version = false, hearing = false, backHref, title = "", level = "B1", className = "" } = {}) {
    const node = el("header", `practice-header ${className}`.trim());
    const inner = el("div", "practice-header-inner");
    const left = attrs(el("div", "practice-header-left"), { id: "header-left" });
    const back = backHref ? attrs(el("a", "practice-icon"), { id: backId, href: backHref, "aria-label": "Zur Themenbibliothek", title: "Zur Themenbibliothek" }) : button("", { variant: "icon", attributes: { id: backId, "aria-label": "Zur Themenbibliothek", title: "Zur Themenbibliothek" } });
    back.append(icon("arrow-left"));
    left.append(back, attrs(el("span", "practice-return-label", "Bibliothek"), { id: "return-label" }), attrs(el("div", "practice-header-divider"), { id: "header-divider" }));
    const context = attrs(el("div", "practice-header-title"), { id: "header-title" });
    context.append(attrs(el("h1", "practice-title", title), { id: titleId }), attrs(el("span", "practice-level", level), { id: levelId }));
    left.append(context);
    const tabsWrap = attrs(el("div", "practice-tabs-wrap"), { id: "part-cards-wrap" });
    tabsWrap.append(attrs(el("nav", "practice-tabs"), { id: tabsId, "aria-label": "Prüfungsteile" }));
    const actions = attrs(el("div", "practice-header-actions"), { id: "header-actions" });
    if (version) {
      const versions = attrs(el("label", "hidden practice-version"), { id: "version-switcher" });
      versions.append(icon("layers-3"), attrs(el("select"), { id: "version-switch-select", "aria-label": "Version wechseln" }));
      actions.append(versions);
    }
    if (modeId) actions.append(attrs(el("span", "practice-mode"), { id: modeId, hidden: "" }));
    const timer = attrs(el("div", "practice-timer hidden"), { id: timerId, "aria-label": "Verbleibende Zeit" });
    timer.append(attrs(el("output", "", "90:00"), { id: timerValueId }));
    actions.append(timer);
    if (hearing) actions.append(button("Aussagen", { icon: "eye-off", className: "hidden", attributes: { id: "hide-aussage-shortcut" } }));
    actions.append(button("", { variant: "icon", icon: "settings", attributes: { id: settingsId, "aria-label": "Einstellungen öffnen", title: "Einstellungen", "aria-controls": settingsPanelId, "aria-expanded": "false" } }));
    inner.append(left, tabsWrap, actions);
    node.append(inner);
    return node;
  }
  root.PracticeUI = Object.freeze({ el, attrs, icon, button, tab, instruction, heading, newBadge, reading, option, gap, reviewBar, question, panel, editor, audio, themeCard, header });
  document.addEventListener("keydown", event => {
    const target = event.target.closest?.(".practice-gap-sentence");
    if (!target || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    if (target.getAttribute("aria-disabled") !== "true") target.click();
  });
  document.querySelectorAll("[data-practice-header]").forEach(placeholder => {
    const options = JSON.parse(placeholder.dataset.practiceHeader);
    const node = header(options);
    const settings = placeholder.querySelector("#settings-panel");
    if (settings) node.append(settings);
    placeholder.replaceWith(node);
    const measure = () => {
      document.documentElement.style.setProperty("--practice-header-height", `${node.offsetHeight}px`);
      const footer = document.querySelector("#footer, #horen-footer, #c1-footer");
      if (footer) document.documentElement.style.setProperty("--practice-footer-height", `${footer.offsetHeight}px`);
    };
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      const footer = document.querySelector("#footer, #horen-footer, #c1-footer");
      if (footer) observer.observe(footer);
    }
    window.addEventListener("resize", measure);
    measure();
  });
})(window);
