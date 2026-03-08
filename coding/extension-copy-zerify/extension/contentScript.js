const TEXT_NODE = 3;
const ELEMENT_NODE = 1;
const GREEN_MARKER_SELECTOR =
  "[class*='border-green'], [class*='bg-green'], [class*='text-green'], [class*='border-emerald'], [class*='bg-emerald'], [class*='text-emerald']";

function normalizeText(text) {
  if (!text) {
    return "";
  }
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeKey(text) {
  return normalizeText(text).toLowerCase();
}

function slugify(value) {
  if (!value) {
    return "exam";
  }
  const ascii = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return ascii.toLowerCase() || "exam";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shuffleArray(values) {
  const list = Array.isArray(values) ? [...values] : [];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[randomIndex]] = [list[randomIndex], list[index]];
  }
  return list;
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function hasClassPrefix(el, prefix) {
  if (!el || !el.classList) {
    return false;
  }
  return Array.from(el.classList).some((item) => item.startsWith(prefix));
}

function isGreenAnswerElement(el) {
  if (!el) {
    return false;
  }
  if (
    hasClassPrefix(el, "border-green") ||
    hasClassPrefix(el, "bg-green") ||
    hasClassPrefix(el, "text-green") ||
    hasClassPrefix(el, "border-emerald") ||
    hasClassPrefix(el, "bg-emerald") ||
    hasClassPrefix(el, "text-emerald")
  ) {
    return true;
  }
  return Boolean(el.querySelector && el.querySelector(GREEN_MARKER_SELECTOR));
}

function stripAnswerText(text) {
  return normalizeText(text.replace(/[\u2713\u2715]/g, "").replace(/\(\d+\)/g, ""));
}

function hasAnswerMarkers() {
  return Boolean(document.querySelector(GREEN_MARKER_SELECTOR));
}

function countAnswerMarkers() {
  return document.querySelectorAll(GREEN_MARKER_SELECTOR).length;
}

function isRetryLikeLabel(label) {
  if (!label) {
    return false;
  }
  const lower = label.toLowerCase();
  const asciiLower = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    lower.includes("retry") ||
    lower.includes("try again") ||
    lower.includes("reset") ||
    lower.includes("restart") ||
    lower.includes("wiederholen") ||
    lower.includes("erneut") ||
    lower.includes("neustart") ||
    label.includes("\u0625\u0639\u0627\u062f\u0629") ||
    label.includes("\u0623\u0639\u0627\u062f")
  );
}

function isCheckAnswersLikeLabel(label) {
  if (!label) {
    return false;
  }
  const lower = label.toLowerCase();
  const asciiLower = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    lower.includes("check answers") ||
    lower.includes("check answer") ||
    lower.includes("show answers") ||
    lower.includes("reveal answers") ||
    lower.includes("submit answers") ||
    lower.includes("antworten") ||
    lower.includes("losung") ||
    lower.includes("l\u00f6sung") ||
    asciiLower.includes("pruf") ||
    lower.includes("solution") ||
    lower.includes("solutions") ||
    label.includes("\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0625\u062c\u0627\u0628\u0627\u062a") ||
    label.includes("\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0627\u062c\u0627\u0628\u0627\u062a") ||
    label.includes("\u0625\u062c\u0627\u0628\u0627\u062a")
  );
}

function findCheckAnswersButton() {
  const exactArabicButton = Array.from(document.querySelectorAll("button")).find((button) => {
    if (!button || button.disabled) {
      return false;
    }
    const label = normalizeText(button.textContent);
    return (
      label.includes("\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0625\u062c\u0627\u0628\u0627\u062a") ||
      label.includes("\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0627\u062c\u0627\u0628\u0627\u062a")
    );
  });
  if (exactArabicButton) {
    return exactArabicButton;
  }

  const footerButtons = Array.from(document.querySelectorAll("footer button"));
  const allButtons = Array.from(document.querySelectorAll("button"));
  const candidates = footerButtons.length ? [...footerButtons, ...allButtons] : allButtons;

  return (
    candidates.find((button) => {
      if (!button || button.disabled) {
        return false;
      }
      const label = normalizeText(button.textContent);
      if (!label || isRetryLikeLabel(label)) {
        return false;
      }
      return isCheckAnswersLikeLabel(label);
    }) || null
  );
}

function findRetryButton() {
  const buttons = Array.from(document.querySelectorAll("footer button, button"));
  return (
    buttons.find((button) => {
      if (!button || button.disabled) {
        return false;
      }
      const label = normalizeText(button.textContent);
      return isRetryLikeLabel(label);
    }) || null
  );
}

function hasInlineBlankCorrections() {
  const textContainer = document.querySelector("div.leading-loose");
  if (!textContainer) {
    return false;
  }
  return Boolean(textContainer.querySelector(GREEN_MARKER_SELECTOR));
}

function extractPartInfoFromText(text) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/(lesen|sprachbausteine)\s*(?:teil\s*)?(\d+)/i);
  if (!match) {
    return null;
  }

  const rawSection = match[1].toLowerCase();
  const section = rawSection === "sprachbausteine" ? "sprachbausteine" : "lesen";
  const partNumber = Number.parseInt(match[2], 10);
  if (!Number.isFinite(partNumber)) {
    return null;
  }

  const sectionLabel = section === "sprachbausteine" ? "Sprachbausteine" : "Lesen";
  return {
    partLabel: `${sectionLabel} Teil ${partNumber}`,
    section,
    partNumber
  };
}

function findActivePartTabButton() {
  const header = document.querySelector("header");
  if (!header) {
    return null;
  }

  const buttons = Array.from(header.querySelectorAll("button"));
  return (
    buttons.find((button) => {
      const label = normalizeText(button.textContent);
      if (!/(lesen|sprachbausteine)/i.test(label) || !/teil\s*\d+/i.test(label)) {
        return false;
      }
      const className = button.className || "";
      return (
        button.getAttribute("aria-selected") === "true" ||
        button.getAttribute("aria-pressed") === "true" ||
        className.includes("text-white") ||
        className.includes("bg-primary")
      );
    }) || null
  );
}

function getPartInfo() {
  const activeButton = findActivePartTabButton();
  if (activeButton) {
    const activeInfo = extractPartInfoFromText(activeButton.textContent);
    if (activeInfo) {
      return activeInfo;
    }
  }

  const header = document.querySelector("header");
  const headerHasExamTitle = Boolean(header?.querySelector("h1"));
  if (header && headerHasExamTitle) {
    const infoRow = header.querySelector("div.text-slate-500");
    if (infoRow) {
      const spans = infoRow.querySelectorAll("span");
      for (const span of spans) {
        const info = extractPartInfoFromText(span.textContent);
        if (info) {
          return info;
        }
      }
    }
  }

  return null;
}

function getLevelText() {
  const header = document.querySelector("header");
  if (!header) {
    return "";
  }

  const spans = Array.from(header.querySelectorAll("span"));
  const level = spans
    .map((span) => normalizeText(span.textContent))
    .find((text) => /^(a1|a2|b1|b2|c1|c2)$/i.test(text));

  return level ? level.toUpperCase() : "";
}

function getPartLabelText() {
  return getPartInfo()?.partLabel || "";
}

function findWeiterButton() {
  const footerButtons = Array.from(document.querySelectorAll("footer button"));
  const footerNext = footerButtons.find((button) => {
    if (!button || button.disabled) {
      return false;
    }
    const label = normalizeText(button.textContent);
    const lower = label.toLowerCase();
    if (lower.startsWith("weiter")) {
      return true;
    }
    if (/(lesen|sprachbausteine)\s*teil\s*\d+/i.test(label)) {
      return true;
    }
    return (
      /\bteil\s*\d+\b/i.test(label) &&
      (button.className.includes("bg-primary") || Boolean(button.querySelector("svg")))
    );
  });
  if (footerNext) {
    return footerNext;
  }

  const buttons = Array.from(document.querySelectorAll("button"));
  return (
    buttons.find((button) => {
      const label = normalizeText(button.textContent).toLowerCase();
      return label.startsWith("weiter");
    }) || null
  );
}

async function waitForPartChange(previousLabel, timeoutMs) {
  const previousKey = normalizeKey(previousLabel);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const currentLabel = getPartLabelText();
    const currentKey = normalizeKey(currentLabel);
    if (currentKey && currentKey !== previousKey) {
      return true;
    }
    await sleep(60);
  }
  return false;
}

async function goToNextPart(previousLabel) {
  const button = findWeiterButton();
  if (!button || button.disabled) {
    return false;
  }
  button.click();
  const changed = await waitForPartChange(previousLabel, 3000);
  return changed;
}

async function waitForAnswerMarkers(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (hasAnswerMarkers()) {
      return true;
    }
    await sleep(50);
  }
  return false;
}

function getThemeCards() {
  const cards = Array.from(document.querySelectorAll("article.cursor-pointer"));
  if (cards.length) {
    return cards;
  }
  return Array.from(document.querySelectorAll("article")).filter((card) =>
    card.classList.contains("cursor-pointer") || card.querySelector("h3")
  );
}

function getThemeTitle(card) {
  const heading = card?.querySelector("h3, h2, h4");
  if (heading) {
    return normalizeText(heading.textContent);
  }
  return normalizeText(card?.textContent || "").split("\n")[0] || "";
}

function findThemeCardByTitle(title, fallbackIndex) {
  const cards = getThemeCards();
  if (!title) {
    return cards[fallbackIndex] || null;
  }
  const normalized = normalizeKey(title);
  const match = cards.find((card) => normalizeKey(getThemeTitle(card)) === normalized);
  return match || cards[fallbackIndex] || null;
}

function findVersionModal() {
  const headers = Array.from(document.querySelectorAll("h2, h3, h4"));
  const header = headers.find((node) =>
    /select|choose|version|model/i.test(normalizeText(node.textContent)) ||
    normalizeText(node.textContent).includes("\u0627\u062e\u062a\u0631 \u0627\u0644\u0646\u0645\u0648\u0630\u062c")
  );
  if (!header) {
    const overlayCandidates = Array.from(
      document.querySelectorAll("div.fixed.inset-0, [role='dialog'], [aria-modal='true']")
    );
    const overlay = overlayCandidates.find((candidate) => isVersionModalElement(candidate));
    return overlay || null;
  }
  const candidate =
    header.closest("[role='dialog'], [aria-modal='true'], .fixed, .absolute") ||
    header.parentElement;
  if (candidate && isVersionModalElement(candidate)) {
    return candidate;
  }

  const overlayCandidates = Array.from(
    document.querySelectorAll("div.fixed.inset-0, [role='dialog'], [aria-modal='true']")
  );
  const overlay = overlayCandidates.find((item) => isVersionModalElement(item));
  return overlay || candidate || null;
}

function findVersionContainer() {
  const buttons = getVersionOptionButtons(document);
  const candidate = buttons.find((button) =>
    Boolean(button.closest("[role='dialog'], [aria-modal='true'], .fixed, .absolute"))
  );
  if (!candidate) {
    return null;
  }
  return (
    candidate.closest("[role='dialog'], [aria-modal='true'], .fixed, .absolute") ||
    candidate.parentElement
  );
}

function isVersionModalElement(element) {
  if (!element) {
    return false;
  }
  const key = normalizeKey(element.textContent);
  const hasVersionOptions = getVersionOptionButtons(element).length > 0;
  if (!hasVersionOptions) {
    return false;
  }
  if (
    key.includes("\u0627\u062e\u062a\u0631 \u0627\u0644\u0646\u0645\u0648\u0630\u062c") ||
    key.includes("select version") ||
    key.includes("choose version")
  ) {
    return true;
  }
  if (element.querySelector(".lucide-layers") && element.querySelector(".space-y-3")) {
    return true;
  }
  return Boolean(element.querySelector(".space-y-3"));
}

function isVersionOptionButton(button) {
  if (!button || button.disabled) {
    return false;
  }
  const text = normalizeText(button.textContent);
  if (!text) {
    return false;
  }

  const key = normalizeKey(text);
  if (
    key === "x" ||
    key === "close" ||
    key === "cancel" ||
    key.includes("zuruck")
  ) {
    return false;
  }

  const hasPlay = Boolean(button.querySelector(".lucide-play"));
  const hasScore = /\d+\s*\/\s*\d+/.test(text);
  const inVersionList = Boolean(button.closest(".space-y-3"));
  if (hasPlay && (hasScore || inVersionList)) {
    return true;
  }
  if (hasScore && (inVersionList || /version\s*\d+/i.test(text))) {
    return true;
  }
  if (/version\s*\d+/i.test(text)) {
    return true;
  }

  return false;
}

function getVersionOptionButtons(scope) {
  const root = scope || document;
  return Array.from(root.querySelectorAll("button, [role='button'], a")).filter((button) =>
    isVersionOptionButton(button)
  );
}

function getVersionEntryLabel(button, fallbackIndex) {
  const titleCandidate = button.querySelector(
    "div.text-sm.font-bold, span.text-sm.font-bold, h3, h4, h5"
  );
  if (titleCandidate) {
    const title = normalizeText(titleCandidate.textContent);
    if (title) {
      return title;
    }
  }

  const raw = normalizeText(button.textContent);
  if (!raw) {
    return `version-${fallbackIndex + 1}`;
  }

  const withoutScore = normalizeText(
    raw
      .replace(/\d+\s*\/\s*\d+/g, " ")
      .replace(/\bpoints?\b/gi, " ")
      .replace(/\bpunkte?\b/gi, " ")
  );
  if (withoutScore) {
    return withoutScore;
  }

  return `version-${fallbackIndex + 1}`;
}

function getVersionEntries(container) {
  const scope = container || findVersionModal() || document;
  const buttons = getVersionOptionButtons(scope);
  const entries = [];
  const seen = new Set();

  buttons.forEach((button, index) => {
    const label = getVersionEntryLabel(button, index);
    const key = normalizeKey(label);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    entries.push({ label, key, element: button });
  });

  if (entries.length) {
    return entries;
  }

  const textMatches = Array.from(scope.querySelectorAll("*")).filter((node) =>
    /version\s*\d+/i.test(normalizeText(node.textContent))
  );
  textMatches.forEach((node) => {
    const text = normalizeText(node.textContent);
    const match = text.match(/version\s*\d+/i);
    if (!match) {
      return;
    }
    const label = match[0];
    const key = normalizeKey(label);
    if (seen.has(key)) {
      return;
    }
    const target =
      node.closest("button, [role='button'], a, .cursor-pointer") || node;
    seen.add(key);
    entries.push({ label, key, element: target });
  });

  if (entries.length) {
    return entries;
  }

  const fallback = buttons.find((button) => {
    const label = normalizeKey(button.textContent);
    const aria = normalizeKey(button.getAttribute("aria-label") || "");
    return label.includes("start") || label.includes("begin") || label.includes("play") ||
      aria.includes("start") || aria.includes("play");
  });
  if (fallback) {
    return [{ label: "Version", key: "version", element: fallback }];
  }

  return [];
}

function findBackButton() {
  const buttons = Array.from(document.querySelectorAll("button, a"));
  const classMatch = buttons.find((button) =>
    button.classList?.contains("p-2") &&
    button.classList?.contains("-ml-2") &&
    button.classList?.contains("text-slate-400") &&
    button.classList?.contains("hover:text-white") &&
    button.classList?.contains("hover:bg-white/5") &&
    button.classList?.contains("rounded-full")
  );
  if (classMatch) {
    return classMatch;
  }

  const labeled = buttons.find((button) => {
    const label = normalizeKey(button.textContent);
    const aria = normalizeKey(button.getAttribute("aria-label") || "");
    const title = normalizeKey(button.getAttribute("title") || "");
    return (
      label.includes("return") ||
      label.includes("zur\u00fcck") ||
      label.includes("back") ||
      aria.includes("return") ||
      aria.includes("back") ||
      title.includes("return") ||
      title.includes("back")
    );
  });
  if (labeled) {
    return labeled;
  }

  const header = document.querySelector("header");
  if (header) {
    const headerButtons = Array.from(header.querySelectorAll("button, a"));
    const iconButton = headerButtons.find((button) => {
      const text = normalizeText(button.textContent);
      if (text) {
        return false;
      }
      if (button.classList.contains("-ml-2")) {
        return true;
      }
      return Boolean(button.querySelector("svg"));
    });
    if (iconButton) {
      return iconButton;
    }
  }

  return null;
}

async function waitForExamPage(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (isExamPageLoaded()) {
      return true;
    }
    await sleep(80);
  }
  return false;
}

async function waitForThemesPage(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const hasThemes = getThemeCards().length > 0;
    const hasModal = Boolean(findVersionModal() || findVersionContainer());
    if (hasThemes && !hasModal) {
      return true;
    }
    await sleep(80);
  }
  return false;
}

function isExamPageLoaded() {
  const partLabel = getPartLabelText();
  if (!partLabel) {
    return false;
  }
  if (getThemeCards().length > 0) {
    return false;
  }
  if (findVersionModal() || findVersionContainer()) {
    return false;
  }
  return true;
}

async function waitForThemeOpen(timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const modal = findVersionModal() || findVersionContainer();
    if (modal) {
      return { type: "modal", modal };
    }
    if (isExamPageLoaded()) {
      return { type: "exam" };
    }
    await sleep(80);
  }
  return null;
}

async function goBackToThemes() {
  const backButton = findBackButton();
  if (backButton) {
    backButton.click();
  } else {
    window.history.back();
  }
  return waitForThemesPage(8000);
}

function clickVersionEntry(element) {
  if (!element) {
    return false;
  }
  element.scrollIntoView({ block: "center", inline: "center" });
  element.click();
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return true;
}

async function ensureAnswersRevealed() {
  const beforeMarkerCount = countAnswerMarkers();
  const button = findCheckAnswersButton();
  if (button && !button.disabled) {
    button.scrollIntoView({ block: "center", inline: "center" });
    button.click();
    button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await sleep(250);
    await waitForAnswerMarkers(5000);
    if (countAnswerMarkers() <= beforeMarkerCount) {
      await sleep(600);
      await nextFrame();
    }
    await nextFrame();
    return;
  }

  if (hasAnswerMarkers()) {
    return;
  }
}

function getOptionFromButton(button) {
  const spans = button.querySelectorAll("span");
  const labelRaw = spans[0]?.textContent.trim() || "";
  const id = labelRaw.replace(/[^a-zA-Z]/g, "").toLowerCase();
  let text = "";
  if (spans.length >= 2) {
    text = spans[1].textContent.trim();
  } else {
    text = normalizeText(button.textContent.replace(labelRaw, ""));
  }
  return { id, text };
}

function getHeadlineFromButton(button) {
  const spans = button.querySelectorAll("span");
  const id = spans[0]?.textContent.trim() || "";
  const text = spans[1]?.textContent.trim() || normalizeText(button.textContent);
  return { id, text };
}

function getAdFromButton(button) {
  const letter = button.querySelector("span")?.textContent.trim() || "";
  const text = normalizeText(button.querySelector("p")?.textContent || button.textContent);
  return { id: letter, text };
}

function getWordFromBankNode(node) {
  if (!node) {
    return "";
  }
  const clone = node.cloneNode(true);
  if (clone.querySelectorAll) {
    clone.querySelectorAll("svg").forEach((svg) => svg.remove());
  }

  const labelEl = node.querySelector("span");
  let text = normalizeText(clone.textContent || "");
  if (labelEl) {
    const label = normalizeText(labelEl.textContent || "");
    if (/^[a-z]$/i.test(label)) {
      text = normalizeText(text.replace(label, ""));
    }
  }

  text = stripAnswerText(text)
    .replace(/^[a-z]\s*[.)\-:]\s*/i, "")
    .replace(/^l(?:u|\u00fc)cke\s*\d+/i, "")
    .trim();

  if (!text) {
    return "";
  }
  if (text.length > 40) {
    return "";
  }
  if (isCheckAnswersLikeLabel(text) || isRetryLikeLabel(text)) {
    return "";
  }
  return text;
}

function getWordBankEntryFromButton(button) {
  if (!button) {
    return null;
  }
  const text = getWordFromBankNode(button);
  if (!text) {
    return null;
  }
  const firstSpan = button.querySelector("span");
  const label = normalizeText(firstSpan?.textContent || "");
  const id = /^[a-z]$/i.test(label) ? label.toUpperCase() : "";
  return { id, text };
}

function collectSprachbausteine2WordBank() {
  const strictButtons = Array.from(
    document.querySelectorAll("main div.grid.grid-cols-2 > button")
  ).filter((button) =>
    !button.closest("header") &&
    !button.closest("footer") &&
    !button.closest("div.space-y-6")
  );
  if (strictButtons.length) {
    const strictSeen = new Set();
    const strictWords = [];
    strictButtons.forEach((button) => {
      const entry = getWordBankEntryFromButton(button);
      if (!entry?.text) {
        return;
      }
      const key = normalizeKey(entry.text);
      if (!key || strictSeen.has(key)) {
        return;
      }
      strictSeen.add(key);
      strictWords.push(entry.text);
    });
    if (strictWords.length) {
      return strictWords;
    }
  }

  const seen = new Set();
  const words = [];
  const addWord = (text) => {
    const normalized = normalizeKey(text);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    words.push(text);
  };

  const selectors = [
    "main div.grid.grid-cols-2 > button",
    "main div.grid.grid-cols-3 > button",
    "main div.grid.grid-cols-4 > button",
    "main div.grid.grid-cols-2 > div",
    "main div.grid.grid-cols-3 > div",
    "main div.grid.grid-cols-4 > div",
    "main div.grid.grid-cols-2 button",
    "main div.grid.grid-cols-3 button",
    "main div.grid.grid-cols-4 button",
    "main div.grid.grid-cols-2 span",
    "main div.grid.grid-cols-3 span",
    "main div.grid.grid-cols-4 span"
  ];

  selectors.forEach((selector) => {
    const nodes = Array.from(document.querySelectorAll(selector));
    nodes.forEach((node) => {
      if (node.closest("header") || node.closest("footer")) {
        return;
      }
      const word = getWordFromBankNode(node);
      if (word) {
        addWord(word);
      }
    });
  });

  return words;
}

function clickElementLikeUser(element) {
  if (!element) {
    return false;
  }
  element.scrollIntoView({ block: "center", inline: "center" });
  element.click();
  element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  return true;
}

async function collectSprachbausteine2WordBankBeforeReveal() {
  const seen = new Set();
  const words = [];
  const addWords = (items) => {
    items.forEach((item) => {
      const text = stripAnswerText(item || "");
      const key = normalizeKey(text);
      if (!key || seen.has(key)) {
        return;
      }
      seen.add(key);
      words.push(text);
    });
  };

  if (hasInlineBlankCorrections()) {
    const retryButton = findRetryButton();
    if (retryButton) {
      clickElementLikeUser(retryButton);
      await sleep(350);
      await nextFrame();
      await nextFrame();
    }
  }

  const collectFromBlankClicks = async () => {
    const textContainer = document.querySelector("div.leading-loose");
    if (!textContainer) {
      return;
    }
    const blanks = Array.from(textContainer.querySelectorAll(".inline-block")).filter((node) =>
      isBlankContainer(node)
    );
    for (const blank of blanks) {
      const target = blank.querySelector("button, span") || blank;
      clickElementLikeUser(target);
      await sleep(90);
      await nextFrame();
      addWords(collectSprachbausteine2WordBank());
    }
  };

  addWords(collectSprachbausteine2WordBank());
  await collectFromBlankClicks();

  if (words.length <= 10) {
    addWords(collectSprachbausteine2WordBank());
  }

  return words;
}

function extractSprachbausteine2CorrectionAnswers() {
  const groups = Array.from(document.querySelectorAll("div.space-y-6 > div"));
  const answers = [];
  const seenIds = new Set();

  groups.forEach((group) => {
    const header = group.querySelector("div.text-sm.font-bold");
    const headerText = normalizeText(header?.textContent || group.textContent || "");
    const match = headerText.match(/l(?:u|\u00fc)cke\s*(\d+)/i);
    const id = match ? Number.parseInt(match[1], 10) : null;
    if (!Number.isFinite(id) || seenIds.has(id)) {
      return;
    }

    const rows = Array.from(group.querySelectorAll(".grid > div, .grid > button"));
    const row =
      rows.find((entry) => isGreenAnswerElement(entry)) ||
      rows.find((entry) => entry.querySelector(".font-medium, .tracking-tight")) ||
      rows[0];
    if (!row) {
      return;
    }

    const answerNode =
      row.querySelector(".font-medium, .tracking-tight") ||
      row.querySelector("span, p, div");
    const answer = stripAnswerText(answerNode ? answerNode.textContent : row.textContent);
    if (!answer || answer.length > 40) {
      return;
    }

    seenIds.add(id);
    answers.push({ id, answer });
  });

  return answers;
}

async function extractSprachbausteine2WithRevealFlow() {
  await nextFrame();
  await sleep(120);
  const preRevealWords = await collectSprachbausteine2WordBankBeforeReveal();
  await ensureAnswersRevealed();
  await nextFrame();
  await sleep(120);
  const correctionAnswers = extractSprachbausteine2CorrectionAnswers();
  return extractSprachbausteine2(preRevealWords, correctionAnswers);
}

function extractInlineBlankAnswers(textContainer) {
  if (!textContainer) {
    return [];
  }
  const containers = Array.from(textContainer.querySelectorAll(".inline-block")).filter(
    (node) => isBlankContainer(node)
  );
  return containers
    .map((container) => {
      const labelEl = container.querySelector("span, button");
      const labelText = labelEl?.textContent || "";
      const match = labelText.match(/\((\d+)\)/);
      const id = match ? Number.parseInt(match[1], 10) : null;
      const greenEl = Array.from(container.querySelectorAll("span, button")).find(
        (el) => isGreenAnswerElement(el)
      );
      const rawAnswer = greenEl ? greenEl.textContent : labelText;
      const answer = stripAnswerText(rawAnswer);
      return { id, answer: answer || "" };
    })
    .filter((item) => Number.isFinite(item.id));
}

function getMeta() {
  const header = document.querySelector("header");
  const title = header?.querySelector("h1")?.textContent.trim() || document.title.trim();
  const level = getLevelText();
  const partInfo = getPartInfo();
  const partLabel = partInfo?.partLabel || "";
  const section = partInfo?.section || "";
  const partNumber = Number.isFinite(partInfo?.partNumber) ? partInfo.partNumber : null;

  return {
    title,
    level,
    partLabel,
    section,
    partNumber,
    sourceUrl: window.location.href,
    extractedAt: new Date().toISOString()
  };
}

function findInstruction(label) {
  const target = normalizeKey(label);
  const headers = Array.from(document.querySelectorAll("h2, h3, h4"));
  const header = headers.find((node) => normalizeKey(node.textContent) === target);
  if (!header) {
    return "";
  }
  const paragraph = header.parentElement?.querySelector("p");
  return paragraph ? normalizeText(paragraph.textContent) : "";
}

async function extractLesenTeil1() {
  const instruction = findInstruction("Aufgabe");
  const texts = [];
  const textCards = [];

  const cardCandidates = Array.from(
    document.querySelectorAll(
      "div.max-w-3xl > div, div.max-w-5xl div.cursor-pointer, main div.cursor-pointer"
    )
  );
  cardCandidates.forEach((card) => {
    const numberEl = Array.from(card.querySelectorAll("span")).find((node) =>
      /^\d+$/.test(node.textContent.trim())
    );
    const textEl =
      card.querySelector("p.text-slate-300") ||
      card.querySelector("p.leading-relaxed");
    if (!numberEl || !textEl) {
      return;
    }
    if (/situation/i.test(normalizeText(card.textContent))) {
      return;
    }

    const id = Number.parseInt(numberEl.textContent.trim(), 10);
    if (!Number.isFinite(id)) {
      return;
    }

    const text = normalizeText(textEl.textContent);
    texts.push({ id, text });
    textCards.push({ id, element: card });
  });

  const headlineButtons = Array.from(
    document.querySelectorAll("button[id^='headline-btn-']")
  );
  const headlines = headlineButtons.map((button) => getHeadlineFromButton(button));

  const answers = [];
  for (const card of textCards) {
    card.element.click();
    await nextFrame();
    const currentButtons = Array.from(document.querySelectorAll("button[id^='headline-btn-']"));
    const greenButton = currentButtons.find((button) => isGreenAnswerElement(button));
    const answer = greenButton ? getHeadlineFromButton(greenButton).id : "";
    answers.push({ textId: card.id, headlineId: answer || "" });
  }

  return {
    instruction,
    texts,
    headlines,
    answers
  };
}

function extractLesenTeil2() {
  const instruction = findInstruction("Aufgaben");
  const passageTitle = document.querySelector("h2")?.textContent.trim() || "";
  const passageEl = document.querySelector("div.prose") || document.querySelector("div.leading-relaxed");
  const passageText = passageEl ? normalizeText(passageEl.textContent) : "";
  const paragraphs = passageText ? passageText.split(/\n{2,}/) : [];

  const questionBlocks = Array.from(document.querySelectorAll("div.space-y-3")).filter(
    (block) => block.querySelector("span.text-primary") && block.querySelector("button")
  );

  const questions = questionBlocks.map((block) => {
    const numberEl = block.querySelector("span.text-primary");
    const promptEl = block.querySelector("p");
    const number = numberEl
      ? Number.parseInt(numberEl.textContent.replace(/\D+/g, ""), 10)
      : null;

    const optionButtons = Array.from(block.querySelectorAll("button"));
    const options = optionButtons.map((button) => getOptionFromButton(button));
    const answerButton = optionButtons.find((button) => isGreenAnswerElement(button));
    const answer = answerButton ? getOptionFromButton(answerButton) : null;

    return {
      id: number,
      prompt: promptEl ? normalizeText(promptEl.textContent) : "",
      options,
      answerId: answer?.id || "",
      answerText: answer?.text || ""
    };
  });

  return {
    instruction,
    passage: {
      title: passageTitle,
      text: passageText,
      paragraphs
    },
    questions
  };
}

async function extractLesenTeil3() {
  const situations = [];
  const situationCards = Array.from(document.querySelectorAll("div.p-5")).filter((card) => {
    const label = card.querySelector("span");
    return label && label.textContent.trim().toLowerCase().startsWith("situation");
  });

  situationCards.forEach((card) => {
    const label = card.querySelector("span")?.textContent.trim() || "";
    const id = Number.parseInt(label.replace(/\D+/g, ""), 10);
    let text = normalizeText(card.querySelector("p")?.textContent || "");
    if (!text) {
      const raw = normalizeText(card.textContent || "");
      text = normalizeText(raw.replace(label, "").replace(/^situation\s*\d+/i, ""));
    }
    situations.push({ id, text, element: card });
  });

  const adButtons = Array.from(document.querySelectorAll("button[id^='ad-btn-']"));
  const ads = adButtons.map((button) => getAdFromButton(button));

  const answers = [];
  for (const situation of situations) {
    situation.element.click();
    await nextFrame();
    const currentButtons = Array.from(document.querySelectorAll("button[id^='ad-btn-']"));
    const greenButton = currentButtons.find((button) => isGreenAnswerElement(button));
    const answer = greenButton ? getAdFromButton(greenButton).id : "";
    answers.push({ situationId: situation.id, adId: answer || "" });
  }

  return {
    situations: situations.map(({ id, text }) => ({ id, text })),
    ads,
    answers
  };
}

function isBlankContainer(node) {
  if (!node || node.nodeType !== ELEMENT_NODE) {
    return false;
  }
  if (!node.classList.contains("inline-block")) {
    return false;
  }
  const labelEl = node.querySelector("span, button");
  if (!labelEl) {
    return false;
  }
  return /\(\d+\)/.test(labelEl.textContent);
}

function extractSegments(container) {
  const segments = [];
  if (!container) {
    return segments;
  }

  container.childNodes.forEach((node) => {
    if (node.nodeType === TEXT_NODE) {
      segments.push({ type: "text", value: node.textContent });
      return;
    }

    if (node.nodeType === ELEMENT_NODE && isBlankContainer(node)) {
      const labelEl = node.querySelector("span, button");
      const labelText = labelEl?.textContent || "";
      const match = labelText.match(/\((\d+)\)/);
      if (!match) {
        segments.push({ type: "text", value: node.textContent });
        return;
      }
      const id = Number.parseInt(match[1], 10);
      const greenEl = Array.from(node.querySelectorAll("span, button")).find((el) =>
        isGreenAnswerElement(el)
      );
      const rawAnswer = greenEl ? greenEl.textContent : labelText;
      const answer = stripAnswerText(rawAnswer);
      segments.push({ type: "luecke", id, answer });
      return;
    }

    if (node.nodeType === ELEMENT_NODE) {
      segments.push({ type: "text", value: node.textContent });
    }
  });

  return segments;
}

function segmentsToText(segments) {
  return segments
    .map((segment) => {
      if (segment.type === "text") {
        return segment.value;
      }
      return `[[${segment.id}]]`;
    })
    .join("");
}

function extractSprachbausteine1() {
  const titleEl = document.querySelector("h3.text-white");
  const instructionEl = titleEl?.parentElement?.querySelector("p");
  const textContainer = document.querySelector("div.leading-loose");

  const segments = extractSegments(textContainer);
  const inlineAnswers = extractInlineBlankAnswers(textContainer);
  const answerMap = new Map(
    inlineAnswers.filter((answer) => Number.isFinite(answer.id)).map((answer) => [answer.id, answer.answer])
  );
  const segmentsWithAnswers = segments.map((segment) => {
    if (segment.type === "text") {
      return segment;
    }
    return {
      ...segment,
      answer: segment.answer || answerMap.get(segment.id) || ""
    };
  });
  const text = normalizeText(segmentsToText(segmentsWithAnswers));

  const blanks = [];
  const blankGroups = Array.from(document.querySelectorAll("div.space-y-6 > div"));
  blankGroups.forEach((group) => {
    const header = group.querySelector("div.text-sm.font-bold");
    if (!header || !header.textContent.includes("L\u00fccke")) {
      return;
    }

    const idEl = header.querySelector("span");
    const id = idEl ? Number.parseInt(idEl.textContent.trim(), 10) : null;
    if (!Number.isFinite(id)) {
      return;
    }
    const options = Array.from(group.querySelectorAll("button")).map((button) =>
      stripAnswerText(button.textContent)
    );

    blanks.push({ id, options });
  });

  return {
    title: titleEl ? normalizeText(titleEl.textContent) : "",
    instruction: instructionEl ? normalizeText(instructionEl.textContent) : "",
    text,
    segments: segmentsWithAnswers,
    blanks,
    answers: inlineAnswers
  };
}

function extractSprachbausteine2(preRevealWords = [], correctionAnswers = []) {
  const titleEl = document.querySelector("h3.text-white, h3.text-slate-800, h3");
  const instructionEl = titleEl?.parentElement?.querySelector("p");
  const textContainer = document.querySelector("div.leading-loose");

  const segments = extractSegments(textContainer);
  const inlineAnswers = extractInlineBlankAnswers(textContainer);
  const panelAnswers = extractSprachbausteine2CorrectionAnswers();
  const knownWordKeys = new Set(
    preRevealWords
      .map((word) => normalizeKey(stripAnswerText(word || "")))
      .filter(Boolean)
  );
  const isStatusLikeAnswer = (text) =>
    /^(korrekt|richtig|falsch|correct|incorrect|wrong)$/i.test(normalizeKey(text));

  const answerMap = new Map();
  const addAnswer = (item, options = {}) => {
    const id = Number.parseInt(item?.id, 10);
    if (!Number.isFinite(id)) {
      return;
    }
    if (answerMap.has(id)) {
      return;
    }
    const answer = stripAnswerText(item?.answer || "");
    if (!answer) {
      return;
    }
    if (!options.allowStatusFallback && isStatusLikeAnswer(answer) && !knownWordKeys.has(normalizeKey(answer))) {
      return;
    }
    answerMap.set(id, answer);
  };

  correctionAnswers.forEach((answer) => addAnswer(answer, { allowStatusFallback: true }));
  panelAnswers.forEach((answer) => addAnswer(answer, { allowStatusFallback: true }));
  inlineAnswers.forEach((answer) => addAnswer(answer));

  const segmentsWithAnswers = segments.map((segment) => {
    if (segment.type === "text") {
      return segment;
    }
    const resolvedAnswer = answerMap.get(segment.id) || segment.answer || "";
    return {
      ...segment,
      answer: resolvedAnswer
    };
  });
  const text = normalizeText(segmentsToText(segmentsWithAnswers));

  const wordBank = [];
  const seenWordKeys = new Set();
  const addWordEntry = (entry) => {
    const text = stripAnswerText(entry?.text || "");
    if (!text) {
      return;
    }
    const key = normalizeKey(text);
    if (!key || seenWordKeys.has(key)) {
      return;
    }
    seenWordKeys.add(key);
    wordBank.push({ id: entry?.id || "", text });
  };

  preRevealWords.forEach((word) => addWordEntry({ id: "", text: word }));

  if (!wordBank.length) {
    collectSprachbausteine2WordBank().forEach((word) => addWordEntry({ id: "", text: word }));
  }
  if (!wordBank.length) {
    Array.from(answerMap.values()).forEach((answer) => addWordEntry({ id: "", text: answer }));
  }

  const shuffledWordBank = shuffleArray(wordBank);

  const blankIds = Array.from(
    new Set(
      [
        ...segmentsWithAnswers
        .filter((segment) => segment.type !== "text")
        .map((segment) => segment.id)
        .filter((id) => Number.isFinite(id)),
        ...Array.from(answerMap.keys())
      ]
    )
  ).sort((a, b) => a - b);
  const blanks = blankIds.map((id) => ({ id, answer: answerMap.get(id) || "" }));
  const answers = Array.from(answerMap.entries())
    .map(([id, answer]) => ({ id, answer }))
    .sort((a, b) => a.id - b.id);

  return {
    title: titleEl ? normalizeText(titleEl.textContent) : "",
    instruction: instructionEl ? normalizeText(instructionEl.textContent) : "",
    text,
    segments: segmentsWithAnswers,
    wordBank: shuffledWordBank,
    options: shuffledWordBank.map((word) => word.text),
    blanks,
    answers
  };
}

function buildFilename(meta) {
  const level = meta.level ? meta.level.toLowerCase() : "unknown";
  const theme = slugify(meta.title || "exam");
  const section =
    meta.section === "sprachbausteine"
      ? "lesen"
      : meta.section || "unknown";

  let part = "teil";
  if (meta.section === "lesen" && meta.partNumber) {
    part = `teil-${meta.partNumber}`;
  } else if (meta.section === "sprachbausteine" && meta.partNumber) {
    part = `sprachbausteine-${meta.partNumber}`;
  } else if (meta.partNumber) {
    part = `teil-${meta.partNumber}`;
  }

  return `db/${level}/${section}/${theme}/${part}.json`;
}

async function extractCurrentPart() {
  const meta = getMeta();
  if (!meta.partLabel) {
    return { error: "Unsupported page: missing part label." };
  }

  let content = null;
  if (meta.section === "sprachbausteine" && meta.partNumber === 2) {
    content = await extractSprachbausteine2WithRevealFlow();
  } else {
    await ensureAnswersRevealed();
    if (meta.section === "lesen" && meta.partNumber === 1) {
    content = await extractLesenTeil1();
    } else if (meta.section === "lesen" && meta.partNumber === 2) {
      content = extractLesenTeil2();
    } else if (meta.section === "lesen" && meta.partNumber === 3) {
      content = await extractLesenTeil3();
    } else if (meta.section === "sprachbausteine" && meta.partNumber === 1) {
      content = extractSprachbausteine1();
    } else {
      return { error: "Unsupported part: " + meta.partLabel };
    }
  }

  const filename = buildFilename(meta);
  return {
    data: {
      meta,
      content
    },
    filename
  };
}

function sendBackgroundMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      resolve(response || { ok: false, error: "No response from background." });
    });
  });
}

async function saveExtractedItem(item) {
  if (!item?.data) {
    return { ok: false, error: "No data to save." };
  }
  return sendBackgroundMessage({
    type: "DOWNLOAD_EXAM",
    payload: item
  });
}

async function extractAllParts(options = {}) {
  const collectResults = options.collectResults !== false;
  const downloadEach = Boolean(options.downloadEach);
  const results = [];
  const downloadErrors = [];
  let savedCount = 0;
  const visited = new Set();

  for (let index = 0; index < 10; index += 1) {
    const current = await extractCurrentPart();
    if (current.error) {
      return current;
    }

    const label = current.data?.meta?.partLabel || "";
    if (label && visited.has(label)) {
      break;
    }
    if (label) {
      visited.add(label);
    }

    if (collectResults) {
      results.push(current);
    }
    if (downloadEach) {
      const downloadResponse = await saveExtractedItem(current);
      if (downloadResponse?.ok) {
        savedCount += 1;
      } else {
        downloadErrors.push({
          filename: current.filename,
          error: downloadResponse?.error || "Download failed."
        });
      }
    }

    const moved = await goToNextPart(label);
    if (!moved) {
      break;
    }
    await nextFrame();
  }

  return {
    results,
    savedCount,
    downloadErrors,
    downloadedInContent: downloadEach
  };
}

async function extractAllThemes(options = {}) {
  const collectResults = options.collectResults !== false;
  const downloadEach = Boolean(options.downloadEach);
  const results = [];
  const downloadErrors = [];
  let savedCount = 0;
  const themes = getThemeCards().map((card, index) => ({
    title: getThemeTitle(card),
    index
  }));
  if (!themes.length) {
    return { error: "No themes found. Open the Lesen themes page first." };
  }

  for (let themeIndex = 0; themeIndex < themes.length; themeIndex += 1) {
    const theme = themes[themeIndex];
    const card = findThemeCardByTitle(theme.title, theme.index);
    if (!card) {
      continue;
    }

    const themeName = theme.title || getThemeTitle(card);
    card.scrollIntoView({ block: "center" });
    card.click();
    await nextFrame();

    const opened = await waitForThemeOpen(12000);
    if (!opened) {
      return { error: `Timeout opening theme ${themeName || themeIndex + 1}.` };
    }

    if (opened.type === "exam") {
      const extracted = await extractAllParts({
        collectResults,
        downloadEach
      });
      if (extracted.error) {
        return extracted;
      }
      if (collectResults) {
        results.push(...(extracted.results || []));
      }
      savedCount += extracted.savedCount || 0;
      downloadErrors.push(...(extracted.downloadErrors || []));
      const backOk = await goBackToThemes();
      if (!backOk) {
        return { error: `Failed to return after ${themeName || "theme"}.` };
      }
      continue;
    }

    const versions = getVersionEntries(opened.modal);
    if (!versions.length) {
      return { error: `No versions found for ${themeName || "theme"}.` };
    }

    const versionKeys = versions.map((version) => ({
      key: version.key,
      label: version.label
    }));

    for (let versionIndex = 0; versionIndex < versionKeys.length; versionIndex += 1) {
      if (versionIndex === 0) {
        clickVersionEntry(versions[0].element);
      } else {
        const again = findThemeCardByTitle(theme.title, theme.index);
        if (!again) {
          return { error: `Theme not found after return for ${themeName || "theme"}.` };
        }
        again.scrollIntoView({ block: "center" });
        again.click();
        await nextFrame();
        const reopened = await waitForThemeOpen(12000);
        if (!reopened || reopened.type !== "modal") {
          return { error: `Expected versions for ${themeName || "theme"}.` };
        }
        const refreshed = getVersionEntries(reopened.modal);
        const nextVersion =
          refreshed.find((entry) => entry.key === versionKeys[versionIndex].key) ||
          refreshed[versionIndex];
        if (!nextVersion) {
          return { error: `Version not found for ${themeName || "theme"}.` };
        }
        clickVersionEntry(nextVersion.element);
      }

      await nextFrame();
      let examReady = await waitForExamPage(12000);
      if (!examReady) {
        const stillOpenModal = findVersionModal() || findVersionContainer();
        if (stillOpenModal) {
          const retryEntries = getVersionEntries(stillOpenModal);
          const retry = retryEntries.find(
            (entry) => entry.key === versionKeys[versionIndex].key
          );
          if (retry) {
            clickVersionEntry(retry.element);
            await nextFrame();
            examReady = await waitForExamPage(12000);
          }
        }
      }
      if (!examReady) {
        return {
          error: `Exam did not load for ${themeName || "theme"} ${versionKeys[versionIndex].label || ""}.`
        };
      }

      const extracted = await extractAllParts({
        collectResults,
        downloadEach
      });
      if (extracted.error) {
        return extracted;
      }
      if (collectResults) {
        results.push(...(extracted.results || []));
      }
      savedCount += extracted.savedCount || 0;
      downloadErrors.push(...(extracted.downloadErrors || []));
      const backOk = await goBackToThemes();
      if (!backOk) {
        return {
          error: `Failed to return after ${themeName || "theme"} ${versionKeys[versionIndex].label || ""}.`
        };
      }
    }
  }

  return {
    results,
    savedCount,
    downloadErrors,
    downloadedInContent: downloadEach
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return;
  }

  const handler =
    message.type === "EXTRACT_EXAM"
      ? () => extractCurrentPart()
      : message.type === "EXTRACT_ALL"
        ? () =>
            extractAllParts({
              collectResults: message.collectResults !== false,
              downloadEach: Boolean(message.downloadEach)
            })
        : message.type === "EXTRACT_THEMES"
          ? () =>
              extractAllThemes({
                collectResults: message.collectResults !== false,
                downloadEach: Boolean(message.downloadEach)
              })
          : null;

  if (!handler) {
    return;
  }

  handler()
    .then((result) => sendResponse(result))
    .catch((error) =>
      sendResponse({ error: error?.message || "Failed to extract exam." })
    );
  return true;
});
