const themeTitle = document.getElementById("theme-title");
const levelPill = document.getElementById("level-pill");
const levelList = document.getElementById("level-list");
const sectionList = document.getElementById("section-list");
const themeGrid = document.getElementById("theme-grid");
const themeSearchInput = document.getElementById("theme-search");
const themeSearchScope = document.getElementById("theme-search-scope");
const themeSearchCount = document.getElementById("theme-search-count");
const homeLoader = document.getElementById("home-loader");
const homeLoaderStage = document.getElementById("home-loader-stage");
const homeLoaderPercent = document.getElementById("home-loader-percent");
const homeLoaderBar = document.getElementById("home-loader-bar");
const versionModal = document.getElementById("version-modal");
const versionOverlay = document.getElementById("version-overlay");
const versionTitle = document.getElementById("version-title");
const versionOptions = document.getElementById("version-options");
const versionCloseBtn = document.getElementById("version-close");
const installPromptCard = document.getElementById("install-prompt-card");
const installPromptText = document.getElementById("install-prompt-text");
const installPromptButton = document.getElementById("install-prompt-button");
const downloadAllThemesBtn = document.getElementById("download-all-themes-btn");
const homeStageBar = document.getElementById("home-stage-bar");
const homeStageBack = document.getElementById("home-stage-back");
const homeStagePath = document.getElementById("home-stage-path");
const homeLevelStage = document.getElementById("home-level-stage");
const homeSectionStage = document.getElementById("home-section-stage");
const homeThemeStage = document.getElementById("home-theme-stage");
const homeSectionStageCopy = document.getElementById("home-section-stage-copy");

const state = {
  db: null,
  config: null,
  shreibenDb: null,
  level: null,
  theme: null,
  pendingTheme: null,
  search: "",
  section: "lesen",
  parts: null,
  homeStage: "level",
  pendingScrollY: null
};

const CREATOR_SECTION_ID = "home-creator-section";
const CREATOR_PROFILE = Object.freeze({
  name: "ZDeutsch Community",
  image: "logo.svg",
  description: "Community-maintained TELC Deutsch practice library.",
  welcome: "Welcome to ZDeutsch, and thank you for being part of this community.",
  contactUrl: "correction.html",
  contactLabel: "Community Corrections"
});

const SECTION_KEYS = ["lesen", "horen", "shreiben"];
const SECTION_LABELS = {
  lesen: "LESEN",
  horen: "HÖREN",
  shreiben: "SHREIBEN"
};
const homeLoaderState = {
  progress: 0,
  intervalId: null
};
const BUNDLE_PDF_THEME_CHUNK_SIZE = 3;
const SUGGEST_THEME_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfbWVEy2slAc-ytKK9h6ZOnwcaDlCoHmEZSo4N9xpiuF6RI8Q/viewform?usp=header";
const HOME_STAGE_LEVEL = "level";
const HOME_STAGE_SECTION = "section";
const HOME_STAGE_THEMES = "themes";
const HOME_STATE_STORAGE_KEY = "zdeutsch.home-state.v2";
const HOME_RESTORE_QUERY_KEY = "restoreHome";

const MAIN_DEFAULT_CONFIG = (typeof DEFAULT_CONFIG === "object" && DEFAULT_CONFIG)
  ? DEFAULT_CONFIG
  : {
      fontScale: 1,
      asideWidth: "40%",
      homepagePromo: { enabled: true },
      ads: {
        top: {
          enabled: false,
          desktopImage: "",
          mobileImage: "",
          clickUrl: ""
        },
        bottom: {
          enabled: false,
          desktopImage: "",
          mobileImage: "",
          clickUrl: "",
          displayIntervalHours: 3
        }
      },
      modules: [
        {
          name: "lesen",
          dataFile: "lesen.json",
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
        }
      ],
      defaultModule: "lesen",
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
      },
      dataFile: "lesen.json"
    };

const MAIN_SCRIPT_BASE_URL = (() => {
  if (document.currentScript?.src) {
    try {
      return new URL(".", document.currentScript.src);
    } catch (error) {
      // fall through
    }
  }

  const linkedScript = document.querySelector('script[src*="main.js"]');
  if (linkedScript?.src) {
    try {
      return new URL(".", linkedScript.src);
    } catch (error) {
      // fall through
    }
  }

  return new URL(".", window.location.href);
})();

function buildConfigFallbackPaths() {
  const paths = [
    new URL("database/config.json", MAIN_SCRIPT_BASE_URL).toString(),
    "database/config.json",
    "../database/config.json"
  ];

  const seen = new Set();
  return paths.filter((path) => {
    const key = String(path || "").trim();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

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

async function loadConfigSafe() {
  if (typeof window.loadConfig === "function") {
    return window.loadConfig();
  }
  const paths = buildConfigFallbackPaths();
  for (const path of paths) {
    try {
      const config = await loadFreshJson(path);
      return { ...MAIN_DEFAULT_CONFIG, ...config };
    } catch (error) {
      // ignore and try next path
    }
  }
  return { ...MAIN_DEFAULT_CONFIG };
}

let deferredInstallPrompt = null;

function getSectionFromHash() {
  const raw = String(window.location.hash || "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
  if (!raw) {
    return null;
  }
  return SECTION_KEYS.includes(raw) ? raw : null;
}

function syncSectionHash(section, options = {}) {
  const target = String(section || "").trim().toLowerCase();
  if (!target || !SECTION_KEYS.includes(target)) {
    return;
  }
  const current = String(window.location.hash || "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();
  if (current === target) {
    return;
  }
  const nextUrl = `${window.location.pathname}${window.location.search}#${target}`;
  if (options.replace) {
    window.history.replaceState(null, "", nextUrl);
    return;
  }
  window.location.hash = target;
}

function sanitizeHomeStage(value) {
  const stage = String(value || "").trim().toLowerCase();
  if (stage === HOME_STAGE_LEVEL || stage === HOME_STAGE_SECTION || stage === HOME_STAGE_THEMES) {
    return stage;
  }
  return HOME_STAGE_LEVEL;
}

function buildHomeStateSnapshot(options = {}) {
  const scrollY = Number.isFinite(options.scrollY)
    ? Math.max(0, Math.round(options.scrollY))
    : Math.max(0, Math.round(window.scrollY || 0));
  return {
    level: state.level || "",
    section: state.section || "lesen",
    search: state.search || "",
    homeStage: sanitizeHomeStage(state.homeStage),
    scrollY
  };
}

function saveHomeState(options = {}) {
  try {
    window.localStorage.setItem(HOME_STATE_STORAGE_KEY, JSON.stringify(buildHomeStateSnapshot(options)));
  } catch (error) {
    // ignore storage failures
  }
}

function loadSavedHomeState() {
  try {
    const raw = window.localStorage.getItem(HOME_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return {
      level: String(parsed.level || "").trim().toLowerCase(),
      section: String(parsed.section || "lesen").trim().toLowerCase(),
      search: String(parsed.search || ""),
      homeStage: sanitizeHomeStage(parsed.homeStage),
      scrollY: Number.isFinite(parsed.scrollY) ? parsed.scrollY : null
    };
  } catch (error) {
    return null;
  }
}

function restoreHomeScrollIfNeeded() {
  if (!Number.isFinite(state.pendingScrollY)) {
    return;
  }
  const target = Math.max(0, Math.round(state.pendingScrollY));
  state.pendingScrollY = null;
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: target, left: 0, behavior: "auto" });
      saveHomeState({ scrollY: target });
    });
  });
}

function setHomeLoaderVisible(show) {
  if (!homeLoader) {
    return;
  }
  homeLoader.classList.toggle("hidden", !show);
  document.body.classList.toggle("home-loader-active", show);
  if (!show && homeLoaderState.intervalId) {
    window.clearInterval(homeLoaderState.intervalId);
    homeLoaderState.intervalId = null;
  }
}

function clampHomeLoaderProgress(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function renderHomeLoaderProgress() {
  const progress = clampHomeLoaderProgress(homeLoaderState.progress);
  if (homeLoaderPercent) {
    homeLoaderPercent.textContent = `${progress}%`;
  }
  if (homeLoaderBar) {
    homeLoaderBar.style.width = `${progress}%`;
  }
}

function setHomeLoaderStage(text) {
  if (homeLoaderStage && text) {
    homeLoaderStage.textContent = text;
  }
}

function setHomeLoaderProgress(value, options = {}) {
  const target = clampHomeLoaderProgress(value);
  const animate = options.animate !== false;

  if (homeLoaderState.intervalId) {
    window.clearInterval(homeLoaderState.intervalId);
    homeLoaderState.intervalId = null;
  }

  if (!animate) {
    homeLoaderState.progress = target;
    renderHomeLoaderProgress();
    return;
  }

  if (target === homeLoaderState.progress) {
    renderHomeLoaderProgress();
    return;
  }

  const direction = target > homeLoaderState.progress ? 1 : -1;
  homeLoaderState.intervalId = window.setInterval(() => {
    const remaining = Math.abs(target - homeLoaderState.progress);
    const step = Math.max(1, Math.ceil(remaining / 7));
    homeLoaderState.progress += step * direction;

    if ((direction > 0 && homeLoaderState.progress >= target) || (direction < 0 && homeLoaderState.progress <= target)) {
      homeLoaderState.progress = target;
      window.clearInterval(homeLoaderState.intervalId);
      homeLoaderState.intervalId = null;
    }

    renderHomeLoaderProgress();
  }, 36);
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function runHomeLoaderStep(meta, task) {
  setHomeLoaderStage(meta.label);
  setHomeLoaderProgress(meta.holdPercent);
  const result = await task();
  setHomeLoaderStage(meta.completeLabel || meta.label);
  setHomeLoaderProgress(meta.completePercent);
  return result;
}

function updateHeader() {
  if (themeTitle) {
    if (state.homeStage === HOME_STAGE_LEVEL) {
      themeTitle.textContent = "Select level";
    } else if (state.homeStage === HOME_STAGE_SECTION) {
      themeTitle.textContent = "Select exam part";
    } else {
      themeTitle.textContent = "Select a theme";
    }
  }
  if (levelPill) {
    levelPill.textContent = state.level ? (state.level || "").toUpperCase() : "B1/B2";
  }
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice() {
  const ua = window.navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

function isIosSafari() {
  const ua = window.navigator.userAgent || "";
  return isIosDevice() && /safari/i.test(ua) && !/crios|fxios|edgios|optios|opios/i.test(ua);
}

function updateInstallPromptUi() {
  if (!installPromptCard || !installPromptButton || !installPromptText) {
    return;
  }

  const canShowOnMobile = window.matchMedia("(max-width: 767px)").matches;
  const installed = isStandaloneMode();
  const showPrompt = canShowOnMobile && !installed && (Boolean(deferredInstallPrompt) || isIosSafari());
  installPromptCard.classList.toggle("hidden", !showPrompt);

  if (!showPrompt) {
    return;
  }

  if (deferredInstallPrompt) {
    installPromptText.textContent = "Install ZDeutsch on your phone for faster access and a cleaner app-like experience.";
    installPromptButton.textContent = "Install";
    return;
  }

  installPromptText.textContent = "On iPhone or iPad, open Safari's Share menu and choose Add to Home Screen.";
  installPromptButton.textContent = "How to Install";
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

function renderStageChoiceButton({ label, description = "", active = false, variant = "section" }) {
  const button = createEl(
    "button",
    classNames(
      "home-stage-choice",
      variant === "level" ? "home-stage-choice-level" : "home-stage-choice-section",
      active ? "home-stage-choice-active" : ""
    )
  );
  button.type = "button";
  button.append(
    createEl("span", "home-stage-choice-label", label),
    createEl("span", "home-stage-choice-description", description)
  );
  return button;
}

function getSectionLabel(sectionKey) {
  const key = normalize(sectionKey);
  return SECTION_LABELS[key] || String(sectionKey || "").toUpperCase();
}

function clearThemeSearch() {
  state.search = "";
  if (themeSearchInput) {
    themeSearchInput.value = "";
  }
}

function getSearchPlaceholder() {
  const levelLabel = (state.level || "").toUpperCase();
  if (state.section === "shreiben") {
    return `Search ${levelLabel} Schreiben tasks...`;
  }
  if (state.section === "horen") {
    return `Search ${levelLabel} Hören practice...`;
  }
  return `Search ${levelLabel} Lesen themes...`;
}

function updateSearchInputContext() {
  const levelLabel = (state.level || "").toUpperCase();
  const sectionLabel = getSectionLabel(state.section);
  if (themeSearchScope) {
    themeSearchScope.textContent = [levelLabel, sectionLabel].filter(Boolean).join(" · ");
  }
  if (themeSearchInput) {
    const placeholder = getSearchPlaceholder();
    themeSearchInput.placeholder = placeholder;
    themeSearchInput.setAttribute("aria-label", placeholder);
    themeSearchInput.value = state.search || "";
  }
}

function getHomeStagePathLabel() {
  const parts = [];
  if (state.level) {
    parts.push((state.level || "").toUpperCase());
  }
  if (state.homeStage === HOME_STAGE_THEMES && state.section) {
    parts.push(getSectionLabel(state.section));
  } else if (state.homeStage === HOME_STAGE_SECTION) {
    parts.push("Choose module");
  } else {
    parts.push("Choose level");
  }
  return parts.join(" / ");
}

function updateHomeStageUi() {
  if (homeLevelStage) {
    homeLevelStage.classList.toggle("hidden", state.homeStage !== HOME_STAGE_LEVEL);
  }
  if (homeSectionStage) {
    homeSectionStage.classList.toggle("hidden", state.homeStage !== HOME_STAGE_SECTION);
  }
  if (homeThemeStage) {
    homeThemeStage.classList.toggle("hidden", state.homeStage !== HOME_STAGE_THEMES);
  }
  if (homeStageBar) {
    homeStageBar.classList.toggle("hidden", state.homeStage === HOME_STAGE_LEVEL);
  }
  if (homeStageBack) {
    homeStageBack.disabled = state.homeStage === HOME_STAGE_LEVEL;
  }
  if (homeStagePath) {
    homeStagePath.textContent = getHomeStagePathLabel();
  }
  if (homeSectionStageCopy) {
    const levelLabel = state.level ? (state.level || "").toUpperCase() : "B1/B2";
    homeSectionStageCopy.textContent = `You selected ${levelLabel}. Continue with Lesen, Hören, or Schreiben.`;
  }
}

function updateSearchResultCount(count, query = state.search) {
  if (!themeSearchCount) {
    return;
  }
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
  const normalizedQuery = normalize(query);
  if (normalizedQuery) {
    themeSearchCount.textContent = `${safeCount} result${safeCount === 1 ? "" : "s"} found`;
    return;
  }
  themeSearchCount.textContent = `${safeCount} item${safeCount === 1 ? "" : "s"} listed`;
}

function matchesSearchQuery(query, ...values) {
  if (!query) {
    return true;
  }
  return values.some((value) => normalize(value).includes(query));
}

function renderThemeEmptyState(message) {
  themeGrid.append(
    createEl(
      "div",
      "rounded-2xl border border-stone-200 bg-stone-50 p-6 text-sm text-slate",
      message
    )
  );
}

function makeMetaPill(label) {
  return createEl(
    "span",
    "theme-meta-pill",
    label
  );
}

function clampPercent(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatPassedExamsLabel(value) {
  const passedExams = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  if (passedExams === 0) {
    return "No exams passed yet";
  }
  if (passedExams === 1) {
    return "1 exam passed";
  }
  return `${passedExams} exams passed`;
}

function getThemeStatus(progressSummary) {
  const passMark = Number.isFinite(state.config?.scoreConfig?.passPercent)
    ? state.config.scoreConfig.passPercent
    : MAIN_DEFAULT_CONFIG.scoreConfig.passPercent;
  if (!progressSummary) {
    return {
      label: "New",
      className: "theme-card-status-new"
    };
  }
  if (progressSummary.passedExams > 0 || progressSummary.lastPercent >= passMark) {
    return {
      label: "Passed",
      className: "theme-card-status-passed"
    };
  }
  return {
    label: "In progress",
    className: "theme-card-status-progress"
  };
}

function getThemeProgressSummary(levelKey, themeKey, versionKeys) {
  if (typeof loadLesenProgressStore !== "function") {
    return null;
  }
  const store = loadLesenProgressStore();
  const keys = versionKeys?.length ? versionKeys : ["default"];
  const entries = keys
    .map((versionKey) => store[makeLesenProgressEntryKey(levelKey, themeKey, versionKey)])
    .filter((entry) => entry && typeof entry === "object");
  if (!entries.length) {
    return null;
  }
  const latest = entries.reduce((current, item) => {
    if (!current) {
      return item;
    }
    const currentTime = Number.isFinite(current.lastAttemptAt) ? current.lastAttemptAt : 0;
    const itemTime = Number.isFinite(item.lastAttemptAt) ? item.lastAttemptAt : 0;
    return itemTime > currentTime ? item : current;
  }, null);
  const passedExams = entries.reduce((sum, item) => {
    const value = Number.isFinite(item.passedAttempts) ? item.passedAttempts : 0;
    return sum + value;
  }, 0);
  const passedVersions = entries.reduce((sum, item) => sum + (item.lastPassed ? 1 : 0), 0);
  const lastPercent = Number.isFinite(latest?.lastPercent) ? latest.lastPercent : 0;
  return {
    lastPercent,
    passedExams,
    passedVersions,
    versionCount: keys.length
  };
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

function makeShareIcon() {
  return makeLucideIcon("share-2", "h-4 w-4");
}

function makeDownloadIcon() {
  return makeLucideIcon("download", "h-4 w-4");
}

async function loadParts() {
  const paths = ["database/parts.json", "../database/parts.json"];
  for (const path of paths) {
    try {
      return await loadFreshJson(path);
    } catch (error) {
      // ignore
    }
  }
  return null;
}

function getPartConfig(levelKey, module) {
  if (!state.parts) {
    return null;
  }
  const levelEntry = state.parts.levels?.[levelKey] || {};
  const parts = Array.isArray(levelEntry) ? levelEntry : levelEntry.parts || [];
  return parts.find((part) => part.module === module) || null;
}

function getPdfFilename(levelKey, themeKey, versionKey) {
  const version = versionKey || "default";
  return `${levelKey}-${themeKey}-${version}.pdf`;
}

function slugifyAnchor(value, fallback = "theme") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function resolveAbsoluteAssetUrl(path) {
  const value = String(path || "").trim();
  if (!value) {
    return "";
  }
  try {
    return new URL(value, window.location.href).href;
  } catch (error) {
    return value;
  }
}

function getOrderedThemeKeys(levelEntry) {
  const configured = Array.isArray(levelEntry?.themeOrder) ? levelEntry.themeOrder : [];
  const available = Object.keys(levelEntry?.themes || {});
  const ordered = configured.filter((themeKey) => Boolean(levelEntry?.themes?.[themeKey]));
  const extras = available.filter((themeKey) => !ordered.includes(themeKey));
  return [...ordered, ...extras];
}

function getOrderedThemesForLevel(levelKey) {
  const levelEntry = state.db?.levels?.[levelKey] || {};
  const themeKeys = getOrderedThemeKeys(levelEntry);
  return themeKeys
    .map((themeKey) => [themeKey, levelEntry.themes?.[themeKey]])
    .filter((item) => Boolean(item[0] && item[1]));
}

function estimateVersionPageCount(lesenEntry, includeCorrections) {
  const partCount = ["teil-1", "teil-2", "teil-3", "sprachbausteine-1", "sprachbausteine-2"]
    .filter((partKey) => Boolean(lesenEntry?.parts?.[partKey]))
    .length;
  const basePages = Math.max(1, partCount);
  return includeCorrections ? basePages + 1 : basePages;
}

async function loadNamedDatabase(fileName) {
  if (!fileName) {
    return null;
  }
  const paths = [`database/${fileName}`, `../database/${fileName}`];
  for (const path of paths) {
    try {
      return await loadFreshJson(path);
    } catch (error) {
      // ignore and try next
    }
  }
  return null;
}

function getShreibenTasks(levelKey) {
  const levelEntry = state.shreibenDb?.levels?.[levelKey];
  if (!levelEntry) {
    return [];
  }

  const normalizeTitle = (value) => {
    return String(value || "")
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[\-*+]\s+/, "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .trim();
  };

  const markdownTitle = (markdown, index) => {
    const lines = String(markdown || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const heading = lines.find((line) => /^#{1,6}\s+/.test(line));
    if (heading) {
      const value = normalizeTitle(heading);
      if (value) {
        return value;
      }
    }
    if (lines.length) {
      const value = normalizeTitle(lines[0]);
      if (value) {
        return value;
      }
    }
    return `Task ${index + 1}`;
  };

  if (Array.isArray(levelEntry.tasks)) {
    return levelEntry.tasks.map((task, index) => {
      const id = String(task?.id || `task-${index + 1}`).trim() || `task-${index + 1}`;
      const istructions = String(task?.istructions ?? task?.instructions ?? "").trim();
      const fallbackTitle = String(task?.title || "").trim();
      const title = fallbackTitle || markdownTitle(istructions, index);
      return {
        id,
        title,
        prompt: String(task?.content || "").trim(),
        partKey: "teil-1",
        partLabel: "Schreiben"
      };
    });
  }

  const order = levelEntry.partOrder || Object.keys(levelEntry.parts || {});
  const tasks = [];
  order.forEach((partKey) => {
    const partEntry = levelEntry.parts?.[partKey];
    const partTasks = partEntry?.content?.tasks || [];
    partTasks.forEach((task, index) => {
      const id = String(task?.id || `task-${index + 1}`).trim() || `task-${index + 1}`;
      const istructions = String(task?.istructions ?? task?.instructions ?? "").trim();
      const fallbackTitle = String(task?.title || "").trim();
      const title = fallbackTitle || markdownTitle(istructions, index);
      const prompt = String(task?.content || task?.prompt || "").trim();
      tasks.push({
        id,
        title,
        prompt,
        partKey,
        partLabel: partEntry?.meta?.partLabel || partKey
      });
    });
  });
  return tasks;
}

function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function getShreibenWordCount(levelKey, taskId, partKey = "teil-1") {
  if (!levelKey || !taskId) {
    return 0;
  }
  const storageKey = `zdeutsch.shreiben.${levelKey}.${taskId}`;
  const current = window.localStorage.getItem(storageKey);
  if (current) {
    return countWords(current);
  }

  const legacyStorageKey = `zdeutsch.shreiben.${levelKey}.${partKey}.${taskId}`;
  const legacyText = window.localStorage.getItem(legacyStorageKey) || "";
  return countWords(legacyText);
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
    page-break-after: avoid;
    break-after: avoid-page;
  }
  .pdf-export h3 {
    font-size: 14px;
    margin: 12px 0 8px;
    page-break-after: avoid;
    break-after: avoid-page;
  }
  .pdf-export p {
    margin: 0 0 8px;
    line-height: 1.5;
    orphans: 3;
    widows: 3;
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
  .pdf-export .translation-ar,
  .pdf-export .blank-lines,
  .pdf-export .blank-row,
  .pdf-export .word-bank,
  .pdf-export .anzeige-list,
  .pdf-export .answer-line,
  .pdf-export .section,
  .pdf-export .columns,
  .pdf-export .grid-two,
  .pdf-export .grid-two > .item,
  .pdf-export .list li {
    page-break-inside: avoid;
    break-inside: avoid-page;
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
    orphans: 2;
    widows: 2;
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
  .pdf-export .translation-ar {
    margin-top: 8px;
    border-radius: 10px;
    border-right: 3px solid #0f766e;
    background: #eef7f6;
    padding: 8px 10px;
    font-size: 11px;
    line-height: 1.6;
    text-align: right;
    font-family: "Tajawal", "Helvetica Neue", Arial, sans-serif;
    color: #111827;
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
  .pdf-export .cover-page,
  .pdf-export .toc-page,
  .pdf-export .closing-page {
    min-height: 255mm;
    padding: 6mm 0 10mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .pdf-export .cover-shell {
    position: relative;
    overflow: hidden;
    border-radius: 22px;
    border: 1px solid #dce3f2;
    background:
      radial-gradient(circle at 15% 18%, rgba(15, 118, 110, 0.2), transparent 48%),
      radial-gradient(circle at 85% 12%, rgba(59, 130, 246, 0.22), transparent 44%),
      linear-gradient(140deg, #f9fbff 0%, #eef5ff 44%, #f1fff9 100%);
    padding: 18mm 16mm;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
  }
  .pdf-export .cover-top {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20mm;
  }
  .pdf-export .cover-logo {
    width: 56px;
    height: 56px;
    object-fit: contain;
    border-radius: 14px;
    border: 1px solid rgba(15, 118, 110, 0.2);
    background: #ffffff;
    padding: 8px;
  }
  .pdf-export .cover-brand {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pdf-export .cover-kicker {
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #476b9d;
    font-weight: 700;
  }
  .pdf-export .cover-brand-name {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #0f2a4a;
  }
  .pdf-export .cover-title {
    font-size: 34px;
    line-height: 1.1;
    color: #0f172a;
    margin: 0;
    font-weight: 800;
    max-width: 70%;
  }
  .pdf-export .cover-subtitle {
    margin-top: 10px;
    font-size: 15px;
    color: #334155;
    max-width: 76%;
    line-height: 1.6;
  }
  .pdf-export .cover-meta {
    margin-top: 14mm;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .pdf-export .cover-meta-item {
    border: 1px solid rgba(15, 118, 110, 0.2);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.82);
    padding: 10px 12px;
  }
  .pdf-export .cover-meta-label {
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #64748b;
    margin-bottom: 4px;
  }
  .pdf-export .cover-meta-value {
    font-size: 13px;
    color: #0f172a;
    font-weight: 600;
  }
  .pdf-export .toc-shell {
    border: 1px solid #e2e8f0;
    border-radius: 18px;
    padding: 14mm 12mm 10mm;
    background: #ffffff;
    box-shadow: 0 18px 46px rgba(15, 23, 42, 0.06);
  }
  .pdf-export .toc-title {
    font-size: 26px;
    font-weight: 800;
    color: #0f172a;
    margin-bottom: 2px;
  }
  .pdf-export .toc-subtitle {
    font-size: 12px;
    color: #475569;
    margin-bottom: 10mm;
  }
  .pdf-export .toc-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
  }
  .pdf-export .toc-entry {
    margin-bottom: 8px;
  }
  .pdf-export .toc-link {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #0f172a;
    text-decoration: none;
    font-size: 12px;
    line-height: 1.3;
  }
  .pdf-export .toc-link:hover {
    color: #0f766e;
  }
  .pdf-export .toc-name {
    flex: 0 1 auto;
    min-width: 0;
  }
  .pdf-export .toc-dots {
    flex: 1;
    border-bottom: 1px dotted #94a3b8;
    transform: translateY(-1px);
  }
  .pdf-export .toc-page-number {
    flex: 0 0 auto;
    font-weight: 700;
    color: #0f766e;
  }
  .pdf-export .closing-shell {
    border-radius: 22px;
    border: 1px solid #dbe3ee;
    background:
      radial-gradient(circle at 88% 10%, rgba(59, 130, 246, 0.15), transparent 38%),
      linear-gradient(170deg, #f8fbff 0%, #ffffff 66%, #f4f8ff 100%);
    padding: 14mm;
  }
  .pdf-export .closing-eyebrow {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: #64748b;
    margin-bottom: 8px;
  }
  .pdf-export .closing-card {
    display: grid;
    grid-template-columns: 70px 1fr;
    gap: 12px;
    align-items: start;
  }
  .pdf-export .closing-avatar {
    width: 70px;
    height: 70px;
    border-radius: 16px;
    object-fit: cover;
    border: 1px solid #d8cdbb;
    background: #f1f5f9;
  }
  .pdf-export .closing-name {
    font-size: 22px;
    color: #0f172a;
    font-weight: 800;
    margin-bottom: 8px;
  }
  .pdf-export .closing-description {
    color: #334155;
    font-size: 13px;
    line-height: 1.6;
    margin-bottom: 7px;
  }
  .pdf-export .closing-welcome {
    color: #0f766e;
    font-size: 13px;
    line-height: 1.6;
    font-weight: 600;
    margin-bottom: 12px;
  }
  .pdf-export .closing-contact {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid rgba(15, 118, 110, 0.35);
    border-radius: 999px;
    padding: 5px 10px;
    color: #0f766e;
    text-decoration: none;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    background: rgba(255, 255, 255, 0.84);
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
  return escapeHtml(value);
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

function getTranslatedText(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return "";
  }
  const candidates = [
    source.translated,
    source.translation,
    source.translationAr,
    source.textAr,
    source.promptAr,
    source.titleAr,
    source.instructionAr
  ];
  const value = candidates.find((item) => typeof item === "string" && item.trim());
  return value ? String(value).trim() : "";
}

function renderArabicTranslation(text) {
  const safeText = String(text || "").trim();
  if (!safeText) {
    return "";
  }
  return `<div class="translation-ar" dir="rtl" lang="ar">${wrapWords(safeText)}</div>`;
}

function normalizeExportOptions(options = {}) {
  return {
    includeArabicTranslation: Boolean(options.includeArabicTranslation),
    includeCorrections: options.includeCorrections !== false
  };
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
  const includeArabicTranslation = Boolean(options.includeArabicTranslation);
  return (items || [])
    .map((item) => {
      const translated = includeArabicTranslation ? getTranslatedText(item) : "";
      return `
        <div class="item">
          <div class="item-id">${wrapWords(item.id)}</div>
          <div class="item-text">${wrapWords(item.text)}</div>
          ${translated ? renderArabicTranslation(translated) : ""}
          ${answerLabel ? renderAnswerLine(answerLabel) : ""}
        </div>
      `;
    })
    .join("");
}

function renderTextGrid(items, options = {}) {
  const answerLabel = options.answerLabel;
  const includeArabicTranslation = Boolean(options.includeArabicTranslation);
  return `
    <div class="grid-two">
      ${(items || [])
        .map((item) => {
          const translated = includeArabicTranslation ? getTranslatedText(item) : "";
          return `
            <div class="item">
              <div class="item-id">${wrapWords(item.id)}</div>
              <div class="item-text">${wrapWords(item.text)}</div>
              ${translated ? renderArabicTranslation(translated) : ""}
              ${answerLabel ? renderAnswerLine(answerLabel) : ""}
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderHeadlines(items, options = {}) {
  const includeArabicTranslation = Boolean(options.includeArabicTranslation);
  return `
    <ul class="list">
      ${(items || []).map((item) => {
        const translated = includeArabicTranslation ? getTranslatedText(item) : "";
        return `
          <li>
            <strong>${wrapWords(item.id)}.</strong> ${wrapWords(item.text)}
            ${translated ? renderArabicTranslation(translated) : ""}
          </li>
        `;
      }).join("")}
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

function renderQuestion(question, options = {}) {
  const includeArabicTranslation = Boolean(options.includeArabicTranslation);
  const optionList = (question.options || [])
    .map((option) => {
      const optionTranslated = includeArabicTranslation ? getTranslatedText(option) : "";
      return `
        <li>
          <strong>${wrapWords(option.id.toUpperCase())})</strong> ${wrapWords(option.text)}
          ${optionTranslated ? renderArabicTranslation(optionTranslated) : ""}
        </li>
      `;
    })
    .join("");
  const questionTranslated = includeArabicTranslation ? getTranslatedText(question) : "";
  return `
    <div class="question">
      <div class="question-title">${wrapWords(question.id)}. ${wrapWords(question.prompt)}</div>
      ${questionTranslated ? renderArabicTranslation(questionTranslated) : ""}
      <ul class="list">${optionList}</ul>
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

function renderTeil1(content, exportOptions = {}) {
  const includeArabicTranslation = Boolean(exportOptions.includeArabicTranslation);
  return `
    <section class="page">
      ${renderHeaderBlock("Lesen Teil 1", content.instruction || "")}
      <div class="section">
        <h3>${wrapWords("Überschriften")}</h3>
        ${renderHeadlines(content.headlines || [], { includeArabicTranslation })}
      </div>
      <div class="section">
        <h3>${wrapWords("Texte")}</h3>
        ${renderTextList(content.texts || [], { answerLabel: "Antwort", includeArabicTranslation })}
      </div>
    </section>
  `;
}

function renderTeil2(content, exportOptions = {}) {
  const includeArabicTranslation = Boolean(exportOptions.includeArabicTranslation);
  const paragraphList = content.passage?.paragraphs || [];
  const translatedParagraphs = includeArabicTranslation ? (content.passage?.translated || []) : [];
  let paragraphCursor = 0;
  const textBlocks = splitParagraphs(paragraphList)
    .map((block) => block.map((para) => {
      const translated = translatedParagraphs[paragraphCursor] || "";
      paragraphCursor += 1;
      return `<p>${wrapWords(para)}</p>${translated ? renderArabicTranslation(translated) : ""}`;
    }).join(""))
    .map((block) => `<div class="text-block">${block || ""}</div>`)
    .join("");
  const passageTranslatedTitle = includeArabicTranslation ? getTranslatedText(content.passage) : "";
  const questions = (content.questions || [])
    .map((question) => renderQuestion(question, { includeArabicTranslation }))
    .join("");
  return `
    <section class="page">
      ${renderHeaderBlock("Lesen Teil 2", content.instruction || "")}
      <h3>${wrapWords(content.passage?.title || "")}</h3>
      ${passageTranslatedTitle ? renderArabicTranslation(passageTranslatedTitle) : ""}
      ${textBlocks}
      <h3>${wrapWords("Aufgaben")}</h3>
      ${questions}
    </section>
  `;
}

function renderTeil3(content, exportOptions = {}) {
  const includeArabicTranslation = Boolean(exportOptions.includeArabicTranslation);
  return `
    <section class="page">
      ${renderHeaderBlock("Lesen Teil 3", "Ordnen Sie die Situationen den Anzeigen zu.")}
      <h3>${wrapWords("Situationen")}</h3>
      ${renderTextGrid(content.situations || [], { answerLabel: "Antwort", includeArabicTranslation })}
      <h3>${wrapWords("Anzeigen")}</h3>
      ${renderTextGrid(content.ads || [], { includeArabicTranslation })}
    </section>
  `;
}

function renderSprach1(content, exportOptions = {}) {
  const includeArabicTranslation = Boolean(exportOptions.includeArabicTranslation);
  const blanks = content.blanks || [];
  const blankIds = getBlankIds(content);
  const translatedText = includeArabicTranslation ? getTranslatedText(content) : "";
  return `
    <section class="page">
      ${renderHeaderBlock("Sprachbausteine 1", content.instruction || "")}
      <div class="text-block">${renderSegments(content.segments || [])}</div>
      ${translatedText ? renderArabicTranslation(translatedText) : ""}
      ${renderBlankLines(blankIds)}
      <h3>${wrapWords("Optionen")}</h3>
      ${renderOptionsPerBlank(blanks)}
    </section>
  `;
}

function renderSprach2(content, exportOptions = {}) {
  const includeArabicTranslation = Boolean(exportOptions.includeArabicTranslation);
  const blankIds = getBlankIds(content);
  const wordBank = (content.wordBank && content.wordBank.length)
    ? content.wordBank.map((item) => item.text || item.answer || item)
    : (content.options || []).length
      ? content.options
      : (content.blanks || []).map((item) => item.answer).filter(Boolean);
  const translatedText = includeArabicTranslation ? getTranslatedText(content) : "";
  return `
    <section class="page">
      ${renderHeaderBlock("Sprachbausteine 2", content.instruction || "")}
      <div class="text-block">${renderSegments(content.segments || [])}</div>
      ${translatedText ? renderArabicTranslation(translatedText) : ""}
      ${renderBlankLines(blankIds)}
      <h3>${wrapWords("Wortliste")}</h3>
      ${renderWordBank(wordBank)}
    </section>
  `;
}

function renderCorrections(lesenEntry, label) {
  const parts = lesenEntry.parts || {};
  const blocks = ["teil-1", "teil-2", "teil-3", "sprachbausteine-1", "sprachbausteine-2"]
    .filter((key) => parts[key])
    .map((partKey) => {
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

function renderVersionBlock(version, levelLabel, exportOptions = {}) {
  const lesenEntry = version.lesenEntry || {};
  const parts = lesenEntry.parts || {};
  const orderedParts = ["teil-1", "teil-2", "teil-3", "sprachbausteine-1", "sprachbausteine-2"]
    .filter((key) => parts[key])
    .map((partKey) => {
      const content = parts[partKey].content || {};
      if (partKey === "teil-1") {
        return renderTeil1(content, exportOptions);
      }
      if (partKey === "teil-2") {
        return renderTeil2(content, exportOptions);
      }
      if (partKey === "teil-3") {
        return renderTeil3(content, exportOptions);
      }
      if (partKey === "sprachbausteine-1") {
        return renderSprach1(content, exportOptions);
      }
      if (partKey === "sprachbausteine-2") {
        return renderSprach2(content, exportOptions);
      }
      return "";
    });

  const anchorAttr = version.anchorId ? ` id="${escapeHtml(version.anchorId)}"` : "";
  const versionLabel = version.versionLabel || "Default";
  return `
    <div class="version-block"${anchorAttr}>
      <div class="doc-title">${wrapWords(version.examTitle || "")}</div>
      <div class="doc-subtitle">${wrapWords(levelLabel)} · ${wrapWords(versionLabel)}</div>
      ${orderedParts.join("")}
      ${exportOptions.includeCorrections ? renderCorrections(lesenEntry, version.versionLabel) : ""}
    </div>
  `;
}

function splitTocEntries(entries, columnCount = 2) {
  const items = Array.isArray(entries) ? entries : [];
  if (!items.length) {
    return Array.from({ length: columnCount }, () => []);
  }
  const safeColumns = Math.max(1, columnCount);
  const columnSize = Math.ceil(items.length / safeColumns);
  return Array.from({ length: safeColumns }, (_, columnIndex) => {
    const start = columnIndex * columnSize;
    return items.slice(start, start + columnSize);
  });
}

function renderBundleCoverPage(bundleMeta, levelLabel) {
  const themeCount = Number(bundleMeta.totalThemes || 0);
  const themeLabel = themeCount === 1 ? "1 Theme" : `${themeCount} Themes`;
  const generatedLabel = bundleMeta.generatedOn || "";
  const logoUrl = bundleMeta.logoUrl ? escapeHtml(bundleMeta.logoUrl) : "";
  return `
    <section class="page cover-page">
      <div class="cover-shell">
        <div class="cover-top">
          ${logoUrl ? `<img class="cover-logo" src="${logoUrl}" alt="${wrapWords(bundleMeta.title || "ZDeutsch")}">` : ""}
          <div class="cover-brand">
            <div class="cover-kicker">${wrapWords(bundleMeta.kicker || "ZDeutsch Exam Library")}</div>
            <div class="cover-brand-name">${wrapWords(bundleMeta.title || "ZDeutsch")}</div>
          </div>
        </div>
        <h1 class="cover-title">${wrapWords(bundleMeta.coverTitle || "Lesen Master Collection")}</h1>
        <p class="cover-subtitle">${wrapWords(bundleMeta.coverSubtitle || `Structured ${levelLabel} reading practice library`)}</p>
        <div class="cover-meta">
          <div class="cover-meta-item">
            <div class="cover-meta-label">${wrapWords("Level")}</div>
            <div class="cover-meta-value">${wrapWords(levelLabel)}</div>
          </div>
          <div class="cover-meta-item">
            <div class="cover-meta-label">${wrapWords("Collection")}</div>
            <div class="cover-meta-value">${wrapWords(themeLabel)}</div>
          </div>
          <div class="cover-meta-item">
            <div class="cover-meta-label">${wrapWords("Generated")}</div>
            <div class="cover-meta-value">${wrapWords(generatedLabel)}</div>
          </div>
          <div class="cover-meta-item">
            <div class="cover-meta-label">${wrapWords("Platform")}</div>
            <div class="cover-meta-value">${wrapWords("example.com/ZDeutsch")}</div>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderBundleTocPage(bundleMeta) {
  const entries = Array.isArray(bundleMeta.tocEntries) ? bundleMeta.tocEntries : [];
  const columns = splitTocEntries(entries, 2);
  const rows = columns
    .map((column) => `
      <div>
        ${column
          .map((entry) => {
            const href = entry.anchorId ? `#${escapeHtml(entry.anchorId)}` : "#";
            return `
              <div class="toc-entry">
                <a class="toc-link" href="${href}">
                  <span class="toc-name">${wrapWords(entry.title || "")}</span>
                  <span class="toc-dots"></span>
                  <span class="toc-page-number">${wrapWords(entry.page)}</span>
                </a>
              </div>
            `;
          })
          .join("")}
      </div>
    `)
    .join("");
  return `
    <section class="page toc-page">
      <div class="toc-shell">
        <div class="toc-title">${wrapWords("Pagination")}</div>
        <div class="toc-subtitle">${wrapWords(bundleMeta.tocSubtitle || "Click a theme name to jump directly to its page")}</div>
        <div class="toc-grid">
          ${rows}
        </div>
      </div>
    </section>
  `;
}

function renderBundleClosingPage(bundleMeta) {
  const creator = bundleMeta.creator || {};
  const creatorName = creator.name || CREATOR_PROFILE.name;
  const creatorDescription = creator.description || CREATOR_PROFILE.description;
  const creatorWelcome = creator.welcome || CREATOR_PROFILE.welcome;
  const creatorImageUrl = creator.image ? escapeHtml(creator.image) : "";
  const contactUrl = creator.contactUrl ? escapeHtml(creator.contactUrl) : "";
  const contactLabel = creator.contactLabel || CREATOR_PROFILE.contactLabel;
  return `
    <section class="page closing-page">
      <div class="closing-shell">
        <div class="closing-eyebrow">${wrapWords("Maintained by")}</div>
        <div class="closing-card">
          ${creatorImageUrl ? `<img class="closing-avatar" src="${creatorImageUrl}" alt="${wrapWords(creatorName)}">` : ""}
          <div>
            <div class="closing-name">${wrapWords(creatorName)}</div>
            <p class="closing-description">${wrapWords(creatorDescription)}</p>
            <p class="closing-welcome">${wrapWords(creatorWelcome)}</p>
            ${contactUrl ? `<a class="closing-contact" href="${contactUrl}">${wrapWords(contactLabel)}</a>` : ""}
          </div>
        </div>
      </div>
    </section>
  `;
}

function buildPdfMarkup({ levelLabel, versions, exportOptions = {} }) {
  const options = normalizeExportOptions(exportOptions);
  const bundleMeta = exportOptions?.bundleMeta?.enabled ? exportOptions.bundleMeta : null;
  const versionBlocks = (versions || [])
    .map((version) => renderVersionBlock(version, levelLabel, options))
    .join("");

  if (!bundleMeta) {
    return versionBlocks;
  }

  return [
    renderBundleCoverPage(bundleMeta, levelLabel),
    renderBundleTocPage(bundleMeta),
    versionBlocks,
    renderBundleClosingPage(bundleMeta)
  ].join("");
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

let exportLoaderElement = null;
let exportLoaderMessageElement = null;
let exportLoaderProgressFillElement = null;
let exportLoaderProgressTextElement = null;
let exportLoaderDepth = 0;

function ensureExportLoader() {
  if (exportLoaderElement) {
    return exportLoaderElement;
  }
  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "1400";
  overlay.style.display = "none";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "16px";
  overlay.style.background = "rgba(15, 23, 42, 0.45)";
  overlay.style.backdropFilter = "blur(2px)";

  const panel = document.createElement("div");
  panel.style.width = "min(420px, 95vw)";
  panel.style.border = "1px solid #d8cdbb";
  panel.style.borderRadius = "18px";
  panel.style.background = "#ffffff";
  panel.style.boxShadow = "0 28px 70px rgba(15, 23, 42, 0.24)";
  panel.style.padding = "20px 18px";
  panel.style.display = "grid";
  panel.style.gap = "12px";
  panel.setAttribute("role", "status");
  panel.setAttribute("aria-live", "polite");

  const label = document.createElement("div");
  label.style.fontFamily = "\"Space Grotesk\", sans-serif";
  label.style.fontSize = "12px";
  label.style.textTransform = "uppercase";
  label.style.letterSpacing = "0.18em";
  label.style.color = "#5f6165";
  label.textContent = "Exporting";

  const message = document.createElement("div");
  message.style.fontFamily = "\"Newsreader\", serif";
  message.style.fontSize = "22px";
  message.style.fontWeight = "600";
  message.style.color = "#1f2933";
  message.textContent = "Extracting your file...";

  const spinnerWrap = document.createElement("div");
  spinnerWrap.style.display = "flex";
  spinnerWrap.style.alignItems = "center";
  spinnerWrap.style.gap = "10px";

  const spinner = document.createElement("span");
  spinner.style.width = "18px";
  spinner.style.height = "18px";
  spinner.style.borderRadius = "999px";
  spinner.style.border = "2px solid rgba(15, 118, 110, 0.2)";
  spinner.style.borderTopColor = "#0f766e";
  spinner.style.animation = "zdeutsch-export-spin 0.8s linear infinite";

  const spinnerText = document.createElement("span");
  spinnerText.style.fontSize = "12px";
  spinnerText.style.color = "#64748b";
  spinnerText.textContent = "Please wait, this can take a little time.";

  const progressWrap = document.createElement("div");
  progressWrap.style.display = "grid";
  progressWrap.style.gap = "6px";

  const progressHeader = document.createElement("div");
  progressHeader.style.display = "flex";
  progressHeader.style.alignItems = "center";
  progressHeader.style.justifyContent = "space-between";
  progressHeader.style.gap = "8px";

  const progressLabel = document.createElement("span");
  progressLabel.style.fontSize = "11px";
  progressLabel.style.color = "#64748b";
  progressLabel.textContent = "Progress";

  const progressText = document.createElement("span");
  progressText.style.fontSize = "11px";
  progressText.style.color = "#0f766e";
  progressText.style.fontWeight = "600";
  progressText.textContent = "0%";

  const progressTrack = document.createElement("div");
  progressTrack.style.height = "8px";
  progressTrack.style.borderRadius = "999px";
  progressTrack.style.background = "rgba(15, 118, 110, 0.14)";
  progressTrack.style.overflow = "hidden";

  const progressFill = document.createElement("span");
  progressFill.style.display = "block";
  progressFill.style.width = "0%";
  progressFill.style.height = "100%";
  progressFill.style.borderRadius = "999px";
  progressFill.style.background = "linear-gradient(90deg, #0f766e, #22c55e)";
  progressFill.style.transition = "width 180ms ease";

  progressTrack.append(progressFill);
  progressHeader.append(progressLabel, progressText);
  progressWrap.append(progressHeader, progressTrack);

  spinnerWrap.append(spinner, spinnerText);
  panel.append(label, message, spinnerWrap, progressWrap);
  overlay.append(panel);
  document.body.append(overlay);

  const styleId = "zdeutsch-export-loader-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes zdeutsch-export-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `;
    document.head.append(style);
  }

  exportLoaderElement = overlay;
  exportLoaderMessageElement = message;
  exportLoaderProgressFillElement = progressFill;
  exportLoaderProgressTextElement = progressText;
  return overlay;
}

function setExportLoaderVisible(visible, message = "Extracting your file...") {
  const overlay = ensureExportLoader();
  if (exportLoaderMessageElement) {
    exportLoaderMessageElement.textContent = message;
  }
  overlay.style.display = visible ? "flex" : "none";
}

function setExportLoaderProgress(value, details = "") {
  ensureExportLoader();
  const percent = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  if (exportLoaderProgressFillElement) {
    exportLoaderProgressFillElement.style.width = `${percent}%`;
  }
  if (exportLoaderProgressTextElement) {
    exportLoaderProgressTextElement.textContent = details
      ? `${details} · ${percent}%`
      : `${percent}%`;
  }
}

async function runWithExportLoader(task, message) {
  exportLoaderDepth += 1;
  setExportLoaderVisible(true, message);
  setExportLoaderProgress(0);
  try {
    return await task();
  } finally {
    exportLoaderDepth = Math.max(0, exportLoaderDepth - 1);
    if (!exportLoaderDepth) {
      setExportLoaderProgress(0);
      setExportLoaderVisible(false);
    }
  }
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

function getJsPdfConstructor() {
  if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
    return window.jspdf.jsPDF;
  }
  if (typeof window.jsPDF === "function") {
    return window.jsPDF;
  }
  return null;
}

function chunkArray(items, chunkSize) {
  const list = Array.isArray(items) ? items : [];
  const safeChunkSize = Math.max(1, Number(chunkSize) || 1);
  const chunks = [];
  for (let index = 0; index < list.length; index += safeChunkSize) {
    chunks.push(list.slice(index, index + safeChunkSize));
  }
  return chunks;
}

function createBundleChunkContainer(markup) {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.left = "-200vw";
  root.style.top = "0";
  root.style.width = "210mm";
  root.style.maxWidth = "210mm";
  root.style.background = "#ffffff";
  root.style.pointerEvents = "none";
  root.style.zIndex = "-1";
  root.innerHTML = markup;
  document.body.append(root);
  return root;
}

function getBundleChunkTargets(container) {
  if (!container) {
    return [];
  }
  const targets = [];
  [".cover-page", ".toc-page", ".version-block", ".closing-page"].forEach((selector) => {
    container.querySelectorAll(selector).forEach((element) => {
      targets.push(element);
    });
  });
  if (!targets.length) {
    const fallback = container.querySelector(".pdf-export") || container;
    targets.push(fallback);
  }
  return targets;
}

async function renderTargetToCanvas(target, targetWidth, targetHeight) {
  const html2canvasOptions = {
    scale: 1.4,
    useCORS: true,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    width: targetWidth,
    height: targetHeight,
    windowWidth: targetWidth,
    windowHeight: targetHeight
  };
  if (typeof window.html2canvas === "function") {
    return window.html2canvas(target, html2canvasOptions);
  }
  if (window.html2pdf) {
    const worker = window.html2pdf().set({
      margin: [0, 0, 0, 0],
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: html2canvasOptions,
      jsPDF: { unit: "pt", format: "a4", orientation: "portrait" }
    }).from(target);
    return worker.toCanvas().get("canvas");
  }
  return null;
}

async function appendTargetCanvasPages({ pdf, target, layout, pageState }) {
  const targetWidth = Math.max(target.scrollWidth, target.offsetWidth, target.clientWidth, 1);
  const targetHeight = Math.max(target.scrollHeight, target.offsetHeight, target.clientHeight, 1);
  const canvas = await renderTargetToCanvas(target, targetWidth, targetHeight);
  if (!canvas) {
    return;
  }

  const canvasWidth = Number(canvas.width || 0);
  const canvasHeight = Number(canvas.height || 0);
  if (!canvasWidth || !canvasHeight) {
    return;
  }

  const pageHeightPx = Math.max(
    1,
    Math.floor((layout.contentHeight * canvasWidth) / layout.contentWidth)
  );

  for (let sourceY = 0; sourceY < canvasHeight; sourceY += pageHeightPx) {
    const sliceHeightPx = Math.min(pageHeightPx, canvasHeight - sourceY);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvasWidth;
    sliceCanvas.height = sliceHeightPx;
    const sliceContext = sliceCanvas.getContext("2d");
    if (!sliceContext) {
      continue;
    }
    sliceContext.drawImage(
      canvas,
      0,
      sourceY,
      canvasWidth,
      sliceHeightPx,
      0,
      0,
      canvasWidth,
      sliceHeightPx
    );

    const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.95);
    const renderedHeight = (sliceHeightPx * layout.contentWidth) / canvasWidth;
    if (pageState.hasRenderedPage) {
      pdf.addPage();
    }
    pdf.addImage(
      sliceData,
      "JPEG",
      layout.contentX,
      layout.contentY,
      layout.contentWidth,
      renderedHeight,
      undefined,
      "FAST"
    );
    pageState.hasRenderedPage = true;
    sliceCanvas.width = 0;
    sliceCanvas.height = 0;
  }
}

function buildBundleChunkMarkup({
  levelLabel,
  versions,
  exportOptions,
  bundleMeta,
  includeIntroPages,
  includeClosingPage
}) {
  const sections = [];
  if (includeIntroPages) {
    sections.push(renderBundleCoverPage(bundleMeta, levelLabel));
    sections.push(renderBundleTocPage(bundleMeta));
  }
  sections.push((versions || []).map((version) => renderVersionBlock(version, levelLabel, exportOptions)).join(""));
  if (includeClosingPage) {
    sections.push(renderBundleClosingPage(bundleMeta));
  }
  return `<div class="pdf-export">${sections.join("")}</div>`;
}

async function generateBundlePdfByChunks({ levelLabel, versions, fileName, headerTitle, exportOptions = {} }) {
  const JsPdfConstructor = getJsPdfConstructor();
  const hasCanvasRenderer = (typeof window.html2canvas === "function") || Boolean(window.html2pdf);
  if (!JsPdfConstructor || !hasCanvasRenderer) {
    throw new Error("Canvas PDF tools are not available.");
  }

  const bundleMeta = exportOptions?.bundleMeta || {};
  const normalizedOptions = normalizeExportOptions(exportOptions);
  const versionChunks = chunkArray(versions, BUNDLE_PDF_THEME_CHUNK_SIZE);
  if (!versionChunks.length) {
    throw new Error("No chunk data found for bundle export.");
  }

  const pdf = new JsPdfConstructor({ unit: "pt", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const layout = {
    contentX: 12,
    contentY: 60,
    contentWidth: pageWidth - 24,
    contentHeight: pageHeight - 110
  };
  const pageState = { hasRenderedPage: false };
  const totalChunks = versionChunks.length;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    const currentChunkNumber = chunkIndex + 1;
    const progressBefore = Math.round((chunkIndex / totalChunks) * 100);
    setExportLoaderProgress(progressBefore, `Chunk ${currentChunkNumber}/${totalChunks}`);

    const chunkMarkup = buildBundleChunkMarkup({
      levelLabel,
      versions: versionChunks[chunkIndex],
      exportOptions: normalizedOptions,
      bundleMeta,
      includeIntroPages: chunkIndex === 0,
      includeClosingPage: chunkIndex === totalChunks - 1
    });
    const chunkContainer = createBundleChunkContainer(chunkMarkup);
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const renderTargets = getBundleChunkTargets(chunkContainer);
      for (const target of renderTargets) {
        await appendTargetCanvasPages({ pdf, target, layout, pageState });
      }
    } finally {
      chunkContainer.remove();
    }

    const progressAfter = Math.round((currentChunkNumber / totalChunks) * 100);
    setExportLoaderProgress(progressAfter, `Chunk ${currentChunkNumber}/${totalChunks}`);
  }

  if (!pageState.hasRenderedPage) {
    throw new Error("Bundle render produced no pages.");
  }

  setExportLoaderProgress(98, "Merging chunks");
  const logoData = await getLogoData();
  addPdfHeaderFooter(pdf, {
    headerTitle,
    footerText: "ZDeutsch community",
    logoData
  });
  setExportLoaderProgress(100, "Finalizing file");
  pdf.save(fileName);
}

async function generatePdfFromData({ levelLabel, versions, fileName, headerTitle, exportOptions = {} }) {
  if (!window.html2pdf) {
    throw new Error("html2pdf is not available.");
  }
  const styleTag = document.createElement("style");
  styleTag.textContent = PDF_STYLES;
  document.head.append(styleTag);
  let overlay = null;
  let container = null;

  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    const isBundleExport = Boolean(exportOptions?.bundleMeta?.enabled);

    if (isBundleExport) {
      try {
        await generateBundlePdfByChunks({
          levelLabel,
          versions,
          fileName,
          headerTitle,
          exportOptions
        });
        return;
      } catch (bundleError) {
        console.warn("Chunked bundle render failed, retrying with default renderer.", bundleError);
      }
    }

    overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.overflow = "auto";
    overlay.style.background = "rgba(255, 255, 255, 0.92)";
    overlay.style.zIndex = "9999";

    container = document.createElement("div");
    container.className = "pdf-export";
    container.style.width = "210mm";
    container.style.margin = "0";
    container.style.background = "#ffffff";
    container.style.boxSizing = "border-box";
    container.innerHTML = buildPdfMarkup({
      levelLabel,
      versions,
      exportOptions
    });

    overlay.append(container);
    document.body.append(overlay);

    const createWorkerOptions = ({ enableLinks, canvasScale, relaxedPagebreak }) => ({
      margin: relaxedPagebreak ? [44, 12, 42, 12] : [60, 0, 50, 0],
      filename: fileName,
      image: { type: "jpeg", quality: 0.98 },
      enableLinks: Boolean(enableLinks),
      html2canvas: {
        scale: canvasScale,
        useCORS: true,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0
      },
      pagebreak: relaxedPagebreak
        ? {
            mode: ["css", "legacy"]
          }
        : {
            mode: ["avoid-all", "css", "legacy"],
            avoid: [
              ".meta",
              ".section",
              ".columns",
              ".grid-two",
              ".grid-two > .item",
              ".item",
              ".question",
              ".text-block",
              ".translation-ar",
              ".correction-block",
              ".blank-lines",
              ".blank-row",
              ".answer-line",
              ".word-bank",
              ".list li",
              "h3"
            ]
          },
      jsPDF: { unit: "pt", format: "a4", orientation: "portrait" }
    });

    const renderPdfWithOptions = async (options) => {
      const worker = window.html2pdf().set(options).from(container);
      return worker.toPdf().get("pdf");
    };
    const pdf = await renderPdfWithOptions(
      createWorkerOptions({
        enableLinks: true,
        canvasScale: 2,
        relaxedPagebreak: false
      })
    );
    const finalPageCount = Number(pdf?.internal?.getNumberOfPages?.() || 0);
    if (!finalPageCount) {
      throw new Error("Generated PDF appears empty. Please try again.");
    }

    const logoData = await getLogoData();
    addPdfHeaderFooter(pdf, {
      headerTitle,
      footerText: "ZDeutsch community",
      logoData
    });
    pdf.save(fileName);
  } finally {
    if (overlay) {
      overlay.remove();
    }
    styleTag.remove();
  }
}

function prepareThemeExport(themeKey, themeEntry, exportOptions = {}) {
  if (!themeEntry || !themeKey) {
    return null;
  }
  const resolvedExportOptions = normalizeExportOptions(exportOptions);
  const versionKeys = getVersionKeys(themeEntry);
  const defaultVersion = themeEntry.defaultVersion || versionKeys[0] || "default";
  const hasMultipleVersions = versionKeys.length > 1;
  const resolvedVersionKeys = hasMultipleVersions ? versionKeys : [defaultVersion];
  const levelKey = state.level || "b1";
  const pdfFileName = hasMultipleVersions
    ? getPdfFilename(levelKey, themeKey, "all")
    : getPdfFilename(levelKey, themeKey, defaultVersion);
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
  const versions = resolvedVersionKeys
    .map(buildVersionData)
    .filter(Boolean);

  return {
    levelKey,
    versions,
    pdfFileName,
    headerTitle: themeEntry.title || themeKey,
    exportOptions: resolvedExportOptions
  };
}

function prepareAllThemesExport(levelKey, exportOptions = {}) {
  const resolvedLevelKey = levelKey || state.level || "b1";
  const resolvedExportOptions = normalizeExportOptions(exportOptions);
  const orderedThemes = getOrderedThemesForLevel(resolvedLevelKey);
  const versions = [];
  const tocEntries = [];
  let pageCursor = 3;

  orderedThemes.forEach(([themeKey, themeEntry], index) => {
    const versionKeys = getVersionKeys(themeEntry);
    const selectedVersionKey = themeEntry?.defaultVersion || versionKeys[0] || "default";
    const versionEntry = themeEntry?.versions?.[selectedVersionKey]
      || themeEntry?.versions?.default
      || themeEntry?.versions?.[versionKeys[0]];
    const lesenEntry = versionEntry?.lesen || themeEntry?.lesen;
    if (!lesenEntry) {
      return;
    }

    const anchorId = `theme-${index + 1}-${slugifyAnchor(themeKey, "entry")}`;
    const themeTitle = themeEntry?.title || versionEntry?.title || themeKey;
    versions.push({
      versionKey: selectedVersionKey,
      versionLabel: versionEntry?.label || selectedVersionKey,
      examTitle: themeTitle,
      lesenEntry,
      anchorId
    });
    tocEntries.push({
      title: themeTitle,
      page: pageCursor,
      anchorId
    });
    pageCursor += estimateVersionPageCount(lesenEntry, resolvedExportOptions.includeCorrections);
  });

  if (!versions.length) {
    return null;
  }

  const levelLabel = resolvedLevelKey.toUpperCase();
  const generatedOn = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date());
  const bundleMeta = {
    enabled: true,
    title: "ZDeutsch",
    kicker: "ZDeutsch Exam Library",
    coverTitle: "Lesen Collection",
    coverSubtitle: `All ${levelLabel} themes in one file`,
    tocSubtitle: "Click any theme title to jump directly to it",
    logoUrl: resolveAbsoluteAssetUrl("logo.svg"),
    generatedOn,
    totalThemes: versions.length,
    tocEntries,
    creator: {
      ...CREATOR_PROFILE,
      image: resolveAbsoluteAssetUrl(CREATOR_PROFILE.image)
    }
  };

  return {
    levelKey: resolvedLevelKey,
    versions,
    pdfFileName: `${resolvedLevelKey}-lesen-all-themes.pdf`,
    headerTitle: `All Lesen Themes · ${levelLabel}`,
    exportOptions: {
      ...resolvedExportOptions,
      bundleMeta
    }
  };
}

function buildHtmlExportDocument({ levelLabel, versions, headerTitle, exportOptions = {} }) {
  const title = escapeHtml(`${headerTitle || "Lesen"} - ${levelLabel}`);
  const markup = buildPdfMarkup({ levelLabel, versions, exportOptions });
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>
      ${PDF_STYLES}
      body {
        margin: 0;
        padding: 24px;
        background: #f3f4f6;
      }
      .pdf-export {
        margin: 0 auto;
        box-shadow: 0 20px 50px rgba(15, 23, 42, 0.14);
      }
    </style>
  </head>
  <body>
    <div class="pdf-export">${markup}</div>
  </body>
</html>`;
}

function openDownloadOptionsModal(themeLabel) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.background = "rgba(15, 23, 42, 0.45)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.padding = "16px";
    overlay.style.zIndex = "1300";

    const panel = document.createElement("div");
    panel.style.width = "min(440px, 96vw)";
    panel.style.background = "#ffffff";
    panel.style.border = "1px solid #d8cdbb";
    panel.style.borderRadius = "18px";
    panel.style.boxShadow = "0 28px 70px rgba(15, 23, 42, 0.24)";
    panel.style.padding = "18px";
    panel.style.display = "grid";
    panel.style.gap = "14px";

    const title = document.createElement("div");
    title.style.fontFamily = "\"Space Grotesk\", sans-serif";
    title.style.fontSize = "14px";
    title.style.letterSpacing = "0.14em";
    title.style.textTransform = "uppercase";
    title.style.color = "#5f6165";
    title.textContent = "Download Options";

    const subtitle = document.createElement("div");
    subtitle.style.fontFamily = "\"Newsreader\", serif";
    subtitle.style.fontSize = "20px";
    subtitle.style.fontWeight = "600";
    subtitle.style.color = "#1f2933";
    subtitle.textContent = themeLabel ? `Export "${themeLabel}"` : "Export this theme";

    const optionsWrap = document.createElement("div");
    optionsWrap.style.display = "grid";
    optionsWrap.style.gap = "10px";
    optionsWrap.style.padding = "10px 12px";
    optionsWrap.style.border = "1px solid #e8e2d6";
    optionsWrap.style.borderRadius = "12px";
    optionsWrap.style.background = "#faf9f6";

    const arabicLabel = document.createElement("label");
    arabicLabel.style.display = "flex";
    arabicLabel.style.alignItems = "center";
    arabicLabel.style.gap = "10px";
    arabicLabel.style.cursor = "pointer";
    const arabicCheckbox = document.createElement("input");
    arabicCheckbox.type = "checkbox";
    arabicCheckbox.checked = false;
    const arabicText = document.createElement("span");
    arabicText.style.fontSize = "14px";
    arabicText.style.color = "#1f2933";
    arabicText.textContent = "with arabic translation";
    arabicLabel.append(arabicCheckbox, arabicText);

    const correctionLabel = document.createElement("label");
    correctionLabel.style.display = "flex";
    correctionLabel.style.alignItems = "center";
    correctionLabel.style.gap = "10px";
    correctionLabel.style.cursor = "pointer";
    const correctionCheckbox = document.createElement("input");
    correctionCheckbox.type = "checkbox";
    correctionCheckbox.checked = true;
    const correctionText = document.createElement("span");
    correctionText.style.fontSize = "14px";
    correctionText.style.color = "#1f2933";
    correctionText.textContent = "with correction";
    correctionLabel.append(correctionCheckbox, correctionText);

    optionsWrap.append(arabicLabel, correctionLabel);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "10px";
    actions.style.justifyContent = "flex-end";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.border = "1px solid #d8cdbb";
    cancelBtn.style.background = "#ffffff";
    cancelBtn.style.color = "#1f2933";
    cancelBtn.style.borderRadius = "999px";
    cancelBtn.style.padding = "8px 14px";
    cancelBtn.style.fontSize = "12px";
    cancelBtn.style.textTransform = "uppercase";
    cancelBtn.style.letterSpacing = "0.14em";
    cancelBtn.style.fontFamily = "\"Space Grotesk\", sans-serif";

    const htmlBtn = document.createElement("button");
    htmlBtn.type = "button";
    htmlBtn.textContent = "HTML";
    htmlBtn.style.border = "1px solid #d8cdbb";
    htmlBtn.style.background = "#ffffff";
    htmlBtn.style.color = "#1f2933";
    htmlBtn.style.borderRadius = "999px";
    htmlBtn.style.padding = "8px 14px";
    htmlBtn.style.fontSize = "12px";
    htmlBtn.style.textTransform = "uppercase";
    htmlBtn.style.letterSpacing = "0.14em";
    htmlBtn.style.fontFamily = "\"Space Grotesk\", sans-serif";

    const pdfBtn = document.createElement("button");
    pdfBtn.type = "button";
    pdfBtn.textContent = "PDF";
    pdfBtn.style.border = "1px solid #0f766e";
    pdfBtn.style.background = "#0f766e";
    pdfBtn.style.color = "#ffffff";
    pdfBtn.style.borderRadius = "999px";
    pdfBtn.style.padding = "8px 14px";
    pdfBtn.style.fontSize = "12px";
    pdfBtn.style.textTransform = "uppercase";
    pdfBtn.style.letterSpacing = "0.14em";
    pdfBtn.style.fontFamily = "\"Space Grotesk\", sans-serif";

    actions.append(cancelBtn, htmlBtn, pdfBtn);
    panel.append(title, subtitle, optionsWrap, actions);
    overlay.append(panel);

    const finish = (value) => {
      window.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(value);
    };

    const buildOptions = (format) => ({
      format,
      includeArabicTranslation: arabicCheckbox.checked,
      includeCorrections: correctionCheckbox.checked
    });

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        finish(null);
      }
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(null);
      }
    });
    cancelBtn.addEventListener("click", () => finish(null));
    pdfBtn.addEventListener("click", () => finish(buildOptions("pdf")));
    htmlBtn.addEventListener("click", () => finish(buildOptions("html")));

    window.addEventListener("keydown", onKeyDown);
    document.body.append(overlay);
    pdfBtn.focus();
  });
}

async function downloadThemePdf(themeKey, themeEntry, exportOptions = {}) {
  const prepared = prepareThemeExport(themeKey, themeEntry, exportOptions);
  if (!prepared) {
    return;
  }
  const {
    levelKey,
    versions,
    pdfFileName: fileName,
    headerTitle,
    exportOptions: resolvedExportOptions
  } = prepared;
  const canUsePrebuiltPdf = !resolvedExportOptions.includeArabicTranslation && resolvedExportOptions.includeCorrections;

  await runWithExportLoader(async () => {
    if (canUsePrebuiltPdf) {
      const url = new URL(`exports/${fileName}`, window.location.href).href;
      const existingBlob = await fetchPdfBlob(url);
      if (existingBlob) {
        downloadBlob(existingBlob, fileName);
        return;
      }
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
        headerTitle,
        exportOptions: resolvedExportOptions
      });
    } catch (error) {
      console.error(error);
      window.alert("Failed to generate the PDF in the browser.");
    }
  }, "Extracting PDF file...");
}

async function downloadThemeHtml(themeKey, themeEntry, exportOptions = {}) {
  const prepared = prepareThemeExport(themeKey, themeEntry, exportOptions);
  if (!prepared) {
    return;
  }
  const {
    levelKey,
    versions,
    pdfFileName,
    headerTitle,
    exportOptions: resolvedExportOptions
  } = prepared;

  if (!versions.length) {
    window.alert("HTML data is missing for this theme.");
    return;
  }

  await runWithExportLoader(async () => {
    const fileName = pdfFileName.replace(/\.pdf$/i, ".html");
    const html = buildHtmlExportDocument({
      levelLabel: levelKey.toUpperCase(),
      versions,
      headerTitle,
      exportOptions: resolvedExportOptions
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    downloadBlob(blob, fileName);
  }, "Extracting HTML file...");
}

async function downloadThemeWithFormat(themeKey, themeEntry) {
  const options = await openDownloadOptionsModal(themeEntry?.title || themeKey);
  if (!options) {
    return;
  }
  if (options.format === "html") {
    await downloadThemeHtml(themeKey, themeEntry, options);
    return;
  }
  await downloadThemePdf(themeKey, themeEntry, options);
}

async function downloadAllThemesPdf(levelKey, exportOptions = {}) {
  const prepared = prepareAllThemesExport(levelKey, exportOptions);
  if (!prepared) {
    window.alert("No Lesen themes found for this level.");
    return;
  }
  const {
    levelKey: resolvedLevelKey,
    versions,
    pdfFileName: fileName,
    headerTitle,
    exportOptions: resolvedExportOptions
  } = prepared;

  await runWithExportLoader(async () => {
    try {
      await generatePdfFromData({
        levelLabel: resolvedLevelKey.toUpperCase(),
        versions,
        fileName,
        headerTitle,
        exportOptions: resolvedExportOptions
      });
    } catch (error) {
      console.error(error);
      window.alert("Failed to generate the combined PDF in the browser.");
    }
  }, "Extracting all themes PDF in chunks...");
}

async function downloadAllThemesHtml(levelKey, exportOptions = {}) {
  const prepared = prepareAllThemesExport(levelKey, exportOptions);
  if (!prepared) {
    window.alert("No Lesen themes found for this level.");
    return;
  }
  const {
    levelKey: resolvedLevelKey,
    versions,
    pdfFileName,
    headerTitle,
    exportOptions: resolvedExportOptions
  } = prepared;

  await runWithExportLoader(async () => {
    const fileName = pdfFileName.replace(/\.pdf$/i, ".html");
    const html = buildHtmlExportDocument({
      levelLabel: resolvedLevelKey.toUpperCase(),
      versions,
      headerTitle,
      exportOptions: resolvedExportOptions
    });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    downloadBlob(blob, fileName);
  }, "Extracting all themes HTML...");
}

async function downloadAllThemesWithFormat() {
  if (state.section !== "lesen") {
    return;
  }
  const levelKey = state.level || "b1";
  const options = await openDownloadOptionsModal(`All Lesen Themes (${levelKey.toUpperCase()})`);
  if (!options) {
    return;
  }
  if (options.format === "html") {
    await downloadAllThemesHtml(levelKey, options);
    return;
  }
  await downloadAllThemesPdf(levelKey, options);
}

function closeVersionModal() {
  if (!versionModal) {
    return;
  }
  versionModal.classList.add("hidden");
  state.pendingTheme = null;
}

function buildLesenUrl(themeKey, versionKey) {
  const params = new URLSearchParams();
  if (state.level) {
    params.set("level", state.level);
  }
  if (themeKey) {
    params.set("theme", themeKey);
  }
  if (versionKey) {
    params.set("version", versionKey);
  }
  const query = params.toString();
  return `lesen.html${query ? `?${query}` : ""}`;
}

function buildThemeShareUrl(themeKey, themeEntry) {
  if (!themeKey || !themeEntry) {
    return window.location.href;
  }
  const versionKeys = getVersionKeys(themeEntry);
  const defaultVersion = themeEntry.defaultVersion || versionKeys[0] || "default";
  const relativeUrl = buildLesenUrl(themeKey, defaultVersion);
  return new URL(relativeUrl, window.location.href).toString();
}

async function copyTextToClipboard(text) {
  const value = String(text || "");
  if (!value) {
    return false;
  }
  if (window.navigator.clipboard && typeof window.navigator.clipboard.writeText === "function") {
    try {
      await window.navigator.clipboard.writeText(value);
      return true;
    } catch (error) {
      // try legacy fallback
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    const copied = Boolean(document.execCommand("copy"));
    textarea.remove();
    return copied;
  } catch (error) {
    return false;
  }
}

async function shareThemePage(themeKey, themeEntry) {
  if (!themeKey || !themeEntry) {
    return;
  }
  const shareUrl = buildThemeShareUrl(themeKey, themeEntry);
  const title = themeEntry.title || themeKey;
  const level = String(state.level || "").toUpperCase();
  const shareData = {
    title: `ZDeutsch · ${title}`,
    text: level ? `${title} (${level})` : title,
    url: shareUrl
  };

  if (window.navigator.share && typeof window.navigator.share === "function") {
    try {
      await window.navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }
  }

  const copied = await copyTextToClipboard(shareUrl);
  if (copied) {
    window.alert("Theme link copied. Share it with your community.");
    return;
  }
  window.prompt("Copy and share this theme link:", shareUrl);
}

function selectThemeVersion(themeKey, versionKey) {
  closeVersionModal();
  window.location.href = buildLesenUrl(themeKey, versionKey);
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
  saveHomeState();
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
  levelList.innerHTML = "";
  levels.forEach((levelKey) => {
    const button = renderStageChoiceButton({
      label: levelKey.toUpperCase(),
      description: levelKey === "b1" ? "TELC B1 practice library" : "TELC B2 practice library",
      active: levelKey === state.level,
      variant: "level"
    });
    button.type = "button";
    button.addEventListener("click", () => {
      state.level = levelKey;
      state.theme = null;
      clearThemeSearch();
      window.localStorage.setItem("lastLevel", levelKey);
      state.homeStage = HOME_STAGE_SECTION;
      saveHomeState({ scrollY: 0 });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      renderHome();
    });
    levelList.append(button);
  });
}

function renderSectionButtons() {
  sectionList.innerHTML = "";
  if (!state.level) {
    return;
  }
  const levelKey = state.level || "b1";
  const levelEntry = state.parts?.levels?.[levelKey];
  const partConfigs = Array.isArray(levelEntry) ? levelEntry : (levelEntry?.parts || []);
  const availableSections = partConfigs.length
    ? Array.from(new Set(partConfigs.map((entry) => normalize(entry.module)).filter(Boolean)))
    : ["lesen", "horen"];

  if (!availableSections.includes(state.section)) {
    state.section = availableSections[0] || "lesen";
  }
  syncSectionHash(state.section, { replace: true });

  availableSections.forEach((value) => {
    const label = getSectionLabel(value);
    const description = value === "lesen"
      ? "Read and solve themed exams"
      : value === "horen"
        ? "Listen and mark true or false"
        : "Write guided exam responses";
    const button = renderStageChoiceButton({
      label,
      description,
      active: state.section === value,
      variant: "section"
    });
    button.type = "button";
    button.addEventListener("click", () => {
      state.section = value;
      clearThemeSearch();
      syncSectionHash(state.section);
      state.homeStage = HOME_STAGE_THEMES;
      saveHomeState({ scrollY: 0 });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      renderHome();
    });
    sectionList.append(button);
  });
}

function updateDownloadAllThemesButton(themeCount = 0) {
  if (!downloadAllThemesBtn) {
    return;
  }
  const showButton = state.homeStage === HOME_STAGE_THEMES && state.section === "lesen" && themeCount > 0;
  downloadAllThemesBtn.classList.toggle("hidden", !showButton);
  downloadAllThemesBtn.disabled = !showButton;
}

function renderThemeCards() {
  themeGrid.innerHTML = "";
  updateDownloadAllThemesButton(0);
  if (!state.level) {
    updateSearchResultCount(0, state.search);
    return;
  }
  const levelKey = state.level || "b1";
  const query = normalize(state.search);
  updateSearchResultCount(0, query);
  if (state.section === "horen") {
    const partConfig = getPartConfig(levelKey, "horen");
    const hasMatch = partConfig && matchesSearchQuery(
      query,
      partConfig?.name,
      partConfig?.description,
      partConfig?.module
    );
    updateSearchResultCount(hasMatch ? 1 : 0, query);
    if (hasMatch) {
      // themeGrid.append(
      //   createEl(
      //     "div",
      //     "rounded-3xl border border-stone-200 bg-white/90 p-6 text-sm text-slate",
      //     "Hören-Codes öffnen eine separate Übung, bei der Sie Aussagen als richtig oder falsch markieren."
      //   )
      // );
      themeGrid.append(buildHorenCard(levelKey, partConfig));
    } else if (query) {
      renderThemeEmptyState(`No ${getSectionLabel(state.section)} results found in ${(state.level || "").toUpperCase()}.`);
    } else {
      themeGrid.append(
        createEl(
          "div",
          "rounded-2xl border border-rose/30 bg-rose/10 p-4 text-sm text-rose",
          "Für diese Ebene sind noch keine Hören-Codes verfügbar."
        )
      );
    }
    return;
  }
  if (state.section === "shreiben") {
    const partConfig = getPartConfig(levelKey, "shreiben");
    const tasks = getShreibenTasks(levelKey).filter((task) => {
      return matchesSearchQuery(query, task?.title, task?.prompt, task?.partLabel);
    });
    updateSearchResultCount(partConfig ? tasks.length : 0, query);
    if (partConfig && tasks.length) {
      tasks.forEach((task) => {
        themeGrid.append(buildShreibenCard(levelKey, task));
      });
    } else if (query) {
      renderThemeEmptyState(`No ${getSectionLabel(state.section)} results found in ${(state.level || "").toUpperCase()}.`);
    } else {
      themeGrid.append(
        createEl(
          "div",
          "rounded-2xl border border-rose/30 bg-rose/10 p-4 text-sm text-rose",
          "Für diese Ebene sind noch keine Schreiben-Aufgaben verfügbar."
        )
      );
    }
    return;
  }
  const levelEntry = state.db.levels[levelKey] || {};
  updateDownloadAllThemesButton(getOrderedThemesForLevel(levelKey).length);
  let themes = getOrderedThemeKeys(levelEntry);
  if (query) {
    themes = themes.filter((themeKey) => {
      const entry = levelEntry.themes?.[themeKey];
      const title = entry?.title || themeKey;
      return normalize(title).includes(query);
    });
  }
  updateSearchResultCount(themes.length, query);
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
      classNames("theme-card", themeKey === state.theme ? "theme-card-active" : "")
    );
    card.type = "button";
    const header = createEl("div", "theme-card-header");
    const titleWrap = createEl("div", "theme-card-title-wrap");
    titleWrap.append(
      createEl("div", "theme-card-title", themeEntry.title || themeKey),
      createEl("div", "theme-card-subtitle", "Reading practice")
    );
    const actions = createEl("div", "theme-card-actions");
    const downloadBtn = createEl(
      "button",
      "theme-card-download"
    );
    downloadBtn.type = "button";
    downloadBtn.title = "Download file";
    downloadBtn.setAttribute("aria-label", "Download file");
    downloadBtn.append(makeDownloadIcon());
    downloadBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await downloadThemeWithFormat(themeKey, themeEntry);
    });
    const shareBtn = createEl(
      "button",
      "theme-card-download"
    );
    shareBtn.type = "button";
    shareBtn.title = "Share theme";
    shareBtn.setAttribute("aria-label", "Share theme");
    shareBtn.append(makeShareIcon());
    shareBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await shareThemePage(themeKey, themeEntry);
    });
    actions.append(downloadBtn, shareBtn);
    header.append(titleWrap, actions);

    const progressSummary = getThemeProgressSummary(levelKey, themeKey, versionKeys);
    const status = getThemeStatus(progressSummary);
    const lastPercent = clampPercent(progressSummary?.lastPercent || 0);

    const summaryRow = createEl("div", "theme-card-summary");
    const statusBadge = createEl("span", classNames("theme-card-status", status.className), status.label);
    const scoreBox = createEl("div", "theme-card-score");
    scoreBox.append(
      createEl("span", "theme-card-score-label", "Last score"),
      createEl("span", "theme-card-score-value", `${lastPercent}%`)
    );
    summaryRow.append(statusBadge, scoreBox);

    const progressBar = createEl("div", "theme-card-progress-track");
    const progressFill = createEl("div", "theme-card-progress-fill");
    progressFill.style.width = `${lastPercent}%`;
    progressBar.append(progressFill);

    const meta = createEl("div", "theme-card-meta");
    meta.append(makeMetaPill(`${partCount} parts`));
    if (versionKeys.length > 1) {
      meta.append(makeMetaPill(`${versionKeys.length} versions`));
    }
    if (progressSummary) {
      meta.append(makeMetaPill(formatPassedExamsLabel(progressSummary.passedExams)));
      if (progressSummary.versionCount > 1) {
        meta.append(makeMetaPill(`Passed versions: ${progressSummary.passedVersions}/${progressSummary.versionCount}`));
      }
    } else {
      meta.append(makeMetaPill("No attempts yet"));
    }

    card.append(header, summaryRow, progressBar, meta);
    card.addEventListener("click", () => {
      handleThemeSelection(themeKey, themeEntry);
    });
    themeGrid.append(card);
  });

  const suggestCardMatches = shouldShowSuggestThemeCard(levelKey)
    && (!query || normalize("اقتراح موضوع جديد Suggest new thema Google Form Lesen B1 B2").includes(query));
  if (suggestCardMatches) {
    themeGrid.append(buildSuggestThemeCard());
  }

  if (!themes.length) {
    if (!suggestCardMatches) {
      renderThemeEmptyState(query
        ? `No ${getSectionLabel(state.section)} results found in ${(state.level || "").toUpperCase()}.`
        : "No themes found.");
    }
  }
  refreshIcons();
}

function buildHorenCard(levelKey, partConfig) {
  const title = partConfig?.name || "Hören Codes";
  const subtitle = partConfig?.description || "Markieren Sie jede Aussage als richtig oder falsch.";
  const file = partConfig?.file || "horen-codes.json";
  const card = createEl(
    "a",
    classNames(
      "rounded-2xl border border-stone-300 bg-white/90 p-5 text-left shadow-panel transition-transform hover:-translate-y-0.5 hover:border-azure/40 min-h-[140px] flex flex-col justify-between",
      "ring-2 ring-mint/10"
    )
  );
  card.href = `horen.html?level=${levelKey}`;
  card.append(
    createEl("div", "text-sm font-display text-ink", title),
    createEl("div", "mt-2 text-xs text-slate", subtitle)
  );
  return card;
}

function buildShreibenCard(levelKey, task) {
  const title = task?.title || "Schreiben";
  const wordCount = getShreibenWordCount(levelKey, task?.id, task?.partKey);
  const progressTarget = 150;
  const progressPercent = Math.max(0, Math.min(100, Math.round((wordCount / progressTarget) * 100)));
  const statusLabel = wordCount > 0 ? "In progress" : "Not started";
  const href = `shreiben.html?level=${encodeURIComponent(levelKey)}&task=${encodeURIComponent(task?.id || "")}`;
  const card = createEl("a", "theme-card");
  card.href = href;

  const topRow = createEl("div", "theme-card-header");
  const titleWrap = createEl("div", "theme-card-title-wrap");
  titleWrap.append(
    createEl("div", "theme-card-title", title),
    createEl("div", "theme-card-subtitle", "Writing practice")
  );

  const levelBadge = createEl(
    "span",
    "theme-card-level",
    levelKey.toUpperCase()
  );
  const actions = createEl("div", "theme-card-actions");
  actions.append(levelBadge);
  topRow.append(titleWrap, actions);

  const summaryRow = createEl("div", "theme-card-summary");
  const scoreBox = createEl("div", "theme-card-score");
  scoreBox.append(
    createEl("span", "theme-card-score-label", "Words"),
    createEl("span", "theme-card-score-value", `${wordCount}`)
  );
  summaryRow.append(
    createEl("span", "theme-card-status theme-card-status-progress", statusLabel),
    scoreBox
  );

  const progressBar = createEl("div", "theme-card-progress-track");
  const progressFill = createEl("div", "theme-card-progress-fill");
  progressFill.style.width = `${progressPercent}%`;
  progressBar.append(progressFill);

  card.append(topRow, summaryRow, progressBar);
  return card;
}

function shouldShowSuggestThemeCard(levelKey) {
  return state.section === "lesen" && (levelKey === "b1" || levelKey === "b2");
}

function buildSuggestThemeCard() {
  const card = createEl("a", "theme-card");
  card.href = SUGGEST_THEME_FORM_URL;
  card.target = "_blank";
  card.rel = "noopener noreferrer";

  const topRow = createEl("div", "theme-card-header");
  const titleWrap = createEl("div", "theme-card-title-wrap");
  titleWrap.append(
    createEl("div", "theme-card-title", "اقتراح موضوع جديد"),
    createEl("div", "theme-card-subtitle", "Suggest new thema")
  );

  const actions = createEl("div", "theme-card-actions");
  actions.append(createEl("span", "theme-card-level", "FORM"));
  topRow.append(titleWrap, actions);

  const summaryRow = createEl("div", "theme-card-summary");
  const statusBadge = createEl("span", "theme-card-status theme-card-status-progress", "Google Form");
  const scoreBox = createEl("div", "theme-card-score");
  scoreBox.append(
    createEl("span", "theme-card-score-label", "Open"),
    createEl("span", "theme-card-score-value", "↗")
  );
  summaryRow.append(statusBadge, scoreBox);

  const meta = createEl("div", "theme-card-meta");
  meta.append(
    makeMetaPill("B1"),
    makeMetaPill("B2"),
    makeMetaPill("Lesen")
  );

  card.append(topRow, summaryRow, meta);
  return card;
}

function renderHome() {
  if (!state.level && state.homeStage !== HOME_STAGE_LEVEL) {
    state.homeStage = HOME_STAGE_LEVEL;
  }
  updateHomeStageUi();
  renderLevelButtons();
  renderSectionButtons();
  updateSearchInputContext();
  renderThemeCards();
  updateHeader();
  updateInstallPromptUi();
  restoreHomeScrollIfNeeded();
  saveHomeState();
}

function createHomeCreatorSection() {
  const existing = document.getElementById(CREATOR_SECTION_ID);
  if (existing) {
    return existing;
  }

  const section = createEl("a", "home-creator-card home-creator-footer-section");
  section.id = CREATOR_SECTION_ID;
  section.href = CREATOR_PROFILE.contactUrl;
  section.target = "_blank";
  section.rel = "noopener noreferrer";
  section.setAttribute("aria-label", "Maintained by");

  const avatarWrap = createEl("div", "home-creator-avatar-wrap");
  const avatar = createEl("img", "home-creator-avatar");
  avatar.src = CREATOR_PROFILE.image;
  avatar.alt = CREATOR_PROFILE.name;
  avatar.loading = "lazy";
  avatar.decoding = "async";
  avatarWrap.append(avatar);

  const copy = createEl("div", "home-creator-copy");
  const eyebrow = createEl("p", "home-creator-eyebrow font-display uppercase tracking-[0.2em]", "Maintained by");
  const name = createEl("h3", "home-creator-name font-display", CREATOR_PROFILE.name);
  const description = createEl("p", "home-creator-description", CREATOR_PROFILE.description);
  const welcome = createEl("p", "home-creator-welcome", CREATOR_PROFILE.welcome);
  const contact = createEl(
    "span",
    "home-creator-contact inline-flex rounded-full border px-4 py-2 text-[10px] font-display uppercase tracking-[0.2em] shadow-sm",
    CREATOR_PROFILE.contactLabel
  );
  copy.append(eyebrow, name, description, welcome, contact);

  section.append(avatarWrap, copy);
  return section;
}

function placeHomeCreatorSection() {
  const section = createHomeCreatorSection();
  const target = document.querySelector("#home-view .w-full");
  if (target) {
    if (!target.contains(section)) {
      target.append(section);
    }
    return;
  }
  document.body.append(section);
}

function setupHomeCreatorSection() {
  placeHomeCreatorSection();
}

function resolveInitialLevel(preferredLevel) {
  const levels = Object.keys(state.db.levels || {});
  if (!levels.length) {
    return null;
  }
  if (preferredLevel && levels.includes(preferredLevel)) {
    return preferredLevel;
  }
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("level");
  if (fromUrl && levels.includes(fromUrl)) {
    return fromUrl;
  }
  const stored = window.localStorage.getItem("lastLevel");
  if (stored && levels.includes(stored)) {
    return stored;
  }
  return levels[0];
}

function resolveInitialHomeState() {
  const saved = loadSavedHomeState();
  const params = new URLSearchParams(window.location.search);
  const fromUrlLevel = String(params.get("level") || "").trim().toLowerCase();
  const fromHashSection = getSectionFromHash();
  const shouldRestoreSaved = params.get(HOME_RESTORE_QUERY_KEY) === "1";

  if (shouldRestoreSaved && saved) {
    const level = resolveInitialLevel(saved.level || fromUrlLevel || null);
    const section = SECTION_KEYS.includes(saved.section)
      ? saved.section
      : (SECTION_KEYS.includes(fromHashSection) ? fromHashSection : "lesen");
    const hasLevel = Boolean(level);
    return {
      level: hasLevel ? level : null,
      section,
      search: saved.search || "",
      homeStage: hasLevel ? sanitizeHomeStage(saved.homeStage) : HOME_STAGE_LEVEL,
      scrollY: saved.scrollY
    };
  }

  if (fromUrlLevel || fromHashSection) {
    const level = resolveInitialLevel(fromUrlLevel || saved?.level || null);
    const section = SECTION_KEYS.includes(fromHashSection) ? fromHashSection : (saved?.section || "lesen");
    return {
      level,
      section: SECTION_KEYS.includes(section) ? section : "lesen",
      search: "",
      homeStage: level ? HOME_STAGE_THEMES : HOME_STAGE_LEVEL,
      scrollY: 0
    };
  }

  if (saved) {
    const level = saved.level ? resolveInitialLevel(saved.level) : null;
    const hasLevel = Boolean(level);
    return {
      level: hasLevel ? level : null,
      section: SECTION_KEYS.includes(saved.section) ? saved.section : "lesen",
      search: saved.search || "",
      homeStage: hasLevel ? sanitizeHomeStage(saved.homeStage) : HOME_STAGE_LEVEL,
      scrollY: saved.scrollY
    };
  }

  return {
    level: null,
    section: "lesen",
    search: "",
    homeStage: HOME_STAGE_LEVEL,
    scrollY: 0
  };
}

if (themeSearchInput) {
  themeSearchInput.addEventListener("input", () => {
    state.search = themeSearchInput.value || "";
    saveHomeState();
    renderThemeCards();
  });
}

if (homeStageBack) {
  homeStageBack.addEventListener("click", () => {
    if (state.homeStage === HOME_STAGE_THEMES) {
      state.homeStage = HOME_STAGE_SECTION;
    } else if (state.homeStage === HOME_STAGE_SECTION) {
      state.homeStage = HOME_STAGE_LEVEL;
    } else {
      return;
    }
    saveHomeState({ scrollY: 0 });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    renderHome();
  });
}

if (downloadAllThemesBtn) {
  downloadAllThemesBtn.addEventListener("click", async () => {
    if (downloadAllThemesBtn.disabled) {
      return;
    }
    const originalLabel = downloadAllThemesBtn.textContent;
    downloadAllThemesBtn.disabled = true;
    downloadAllThemesBtn.textContent = "Preparing...";
    try {
      await downloadAllThemesWithFormat();
    } finally {
      downloadAllThemesBtn.textContent = originalLabel;
      renderThemeCards();
    }
  });
}

if (installPromptButton) {
  installPromptButton.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        await deferredInstallPrompt.userChoice;
      } catch (error) {
        // ignore dismissed prompts
      }
      deferredInstallPrompt = null;
      updateInstallPromptUi();
      return;
    }

    if (isIosSafari()) {
      window.alert("To install ZDeutsch on iPhone or iPad:\n1. Open the Share menu in Safari.\n2. Tap 'Add to Home Screen'.\n3. Tap 'Add'.");
    }
  });
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallPromptUi();
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallPromptUi();
});

window.addEventListener("resize", () => {
  updateInstallPromptUi();
});

window.addEventListener("hashchange", () => {
  if (!state.db) {
    return;
  }
  const hashSection = getSectionFromHash();
  if (!hashSection) {
    return;
  }
  if (hashSection === state.section && state.homeStage === HOME_STAGE_THEMES) {
    return;
  }
  state.section = hashSection;
  if (state.level) {
    state.homeStage = HOME_STAGE_THEMES;
  }
  clearThemeSearch();
  renderHome();
});

window.addEventListener("pagehide", () => {
  saveHomeState();
});

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

async function init() {
  setHomeLoaderVisible(true);
  setHomeLoaderStage("Preparing library...");
  setHomeLoaderProgress(4, { animate: false });

  state.config = await runHomeLoaderStep(
    {
      label: "Loading settings...",
      holdPercent: 12,
      completePercent: 20,
      completeLabel: "Settings ready"
    },
    () => loadConfigSafe()
  );


  state.db = await runHomeLoaderStep(
    {
      label: "Loading Lesen exams...",
      holdPercent: 46,
      completePercent: 70,
      completeLabel: "Lesen exams ready"
    },
    () => loadDatabase(state.config)
  );

  state.shreibenDb = await runHomeLoaderStep(
    {
      label: "Loading Schreiben tasks...",
      holdPercent: 80,
      completePercent: 88,
      completeLabel: "Schreiben tasks ready"
    },
    () => loadNamedDatabase("shreiben.json")
  );

  state.parts = await runHomeLoaderStep(
    {
      label: "Loading part structure...",
      holdPercent: 94,
      completePercent: 98,
      completeLabel: "Finalizing library..."
    },
    () => loadParts()
  );

  if (!state.db) {
    themeGrid.innerHTML = "";
    themeGrid.append(
      createEl(
        "div",
        "rounded-2xl border border-stone-200 bg-stone-50 p-6 text-sm text-slate",
        "database/lesen.json not found. Run scripts/build_database.py"
      )
    );
    updateHeader();
    setHomeLoaderStage("Library unavailable");
    setHomeLoaderProgress(100);
    await delay(220);
    setHomeLoaderVisible(false);
    return;
  }

  const initialHomeState = resolveInitialHomeState();
  state.level = initialHomeState.level;
  state.section = initialHomeState.section;
  state.search = initialHomeState.search;
  state.homeStage = initialHomeState.homeStage;
  state.pendingScrollY = initialHomeState.scrollY;
  renderHome();
  setupHomeCreatorSection();
  setHomeLoaderStage("Library ready");
  setHomeLoaderProgress(100);
  await delay(220);
  setHomeLoaderVisible(false);
}

init();
