const {
  readJsonByKey,
  readJsonSnapshotByKey,
  writeJsonByKey,
  mutateJsonByKey
} = require("../repositories/jsonRepository");
const AppError = require("../utils/appError");
const { assertString, isPlainObject } = require("../utils/validators");

const LESEN_PART_ORDER = [
  "teil-1",
  "teil-2",
  "teil-3",
  "sprachbausteine-1",
  "sprachbausteine-2"
];

function ensureLevel(db, level) {
  if (!db.levels || typeof db.levels !== "object") {
    db.levels = {};
  }
  if (!db.levels[level] || typeof db.levels[level] !== "object") {
    db.levels[level] = {
      themes: {},
      themeOrder: []
    };
  }

  const levelEntry = db.levels[level];
  if (!levelEntry.themes || typeof levelEntry.themes !== "object") {
    levelEntry.themes = {};
  }
  if (!Array.isArray(levelEntry.themeOrder)) {
    levelEntry.themeOrder = Object.keys(levelEntry.themes);
  }

  return levelEntry;
}

function createEmptyPart(level, partKey, title) {
  const upperLevel = String(level || "").toUpperCase();
  const extractedAt = new Date().toISOString();

  if (partKey === "teil-1") {
    return {
      meta: {
        title,
        level: upperLevel,
        partLabel: "Lesen Teil 1",
        section: "lesen",
        partNumber: 1,
        sourceUrl: "",
        extractedAt
      },
      content: {
        instruction: "",
        texts: [],
        headlines: [],
        answers: []
      }
    };
  }

  if (partKey === "teil-2") {
    return {
      meta: {
        title,
        level: upperLevel,
        partLabel: "Lesen Teil 2",
        section: "lesen",
        partNumber: 2,
        sourceUrl: "",
        extractedAt
      },
      content: {
        instruction: "",
        passage: {
          title: "",
          paragraphs: []
        },
        questions: []
      }
    };
  }

  if (partKey === "teil-3") {
    return {
      meta: {
        title,
        level: upperLevel,
        partLabel: "Lesen Teil 3",
        section: "lesen",
        partNumber: 3,
        sourceUrl: "",
        extractedAt
      },
      content: {
        instruction: "",
        situations: [],
        ads: [],
        answers: []
      }
    };
  }

  const partNumber = partKey === "sprachbausteine-1" ? 1 : 2;
  const isSprachOne = partKey === "sprachbausteine-1";
  return {
    meta: {
      title,
      level: upperLevel,
      partLabel: `Sprachbausteine Teil ${partNumber}`,
      section: "sprachbausteine",
      partNumber,
      sourceUrl: "",
      extractedAt
    },
    content: {
      title: "Sprachbausteine",
      instruction: "",
      text: "",
      ...(isSprachOne
        ? {
            blanks: [],
            answers: []
          }
        : {
            options: [],
            answers: []
          })
    }
  };
}

function createEmptyTheme(level, themeKey, title) {
  const parts = {};
  LESEN_PART_ORDER.forEach((partKey) => {
    parts[partKey] = createEmptyPart(level, partKey, title);
  });

  return {
    id: themeKey,
    title,
    versions: {
      default: {
        key: "default",
        label: "Default",
        title,
        lesen: {
          partOrder: LESEN_PART_ORDER,
          parts
        }
      }
    },
    versionOrder: ["default"]
  };
}

async function getLesenDb() {
  return readJsonByKey("lesen");
}

async function getLesenSnapshot() {
  return readJsonSnapshotByKey("lesen");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function orderedThemeKeys(levelEntry) {
  return Array.isArray(levelEntry?.themeOrder) && levelEntry.themeOrder.length
    ? levelEntry.themeOrder
    : Object.keys(levelEntry?.themes || {});
}

function summarizeThemes(levelEntry) {
  return orderedThemeKeys(levelEntry)
    .map((themeKey) => {
      const theme = levelEntry?.themes?.[themeKey];
      if (!theme) {
        return null;
      }
      return {
        key: themeKey,
        id: theme.id || themeKey,
        title: theme.title || themeKey,
        versionCount: Object.keys(theme.versions || {}).length
      };
    })
    .filter(Boolean);
}

function summarizeVersions(theme) {
  const versionKeys = Array.isArray(theme?.versionOrder) && theme.versionOrder.length
    ? theme.versionOrder
    : Object.keys(theme?.versions || {});

  return versionKeys
    .map((versionKey) => {
      const version = theme?.versions?.[versionKey];
      if (!version) {
        return null;
      }
      return {
        key: versionKey,
        label: version.label || versionKey,
        title: version.title || theme.title || versionKey
      };
    })
    .filter(Boolean);
}

async function listThemes(level) {
  assertString(level, "level is required");
  const { data: db } = await getLesenSnapshot();
  const levelEntry = db?.levels?.[level] || null;
  if (!levelEntry) {
    return [];
  }
  return summarizeThemes(levelEntry);
}

async function getTheme(level, themeKey) {
  assertString(level, "level is required");
  assertString(themeKey, "themeKey is required");

  const { data: db } = await getLesenSnapshot();
  const theme = db?.levels?.[level]?.themes?.[themeKey] || null;
  if (!theme) {
    throw new AppError("Theme not found", 404);
  }

  return clone(theme);
}

function resolveTheme(levelEntry, themeKey) {
  const theme = levelEntry?.themes?.[themeKey] || null;
  if (!theme) {
    throw new AppError("Theme not found", 404);
  }
  return theme;
}

function resolveVersion(theme, versionKeyRaw) {
  const versionKey = String(versionKeyRaw || "default").trim() || "default";
  const version = theme?.versions?.[versionKey] || null;
  if (!version) {
    throw new AppError("Version not found", 404);
  }
  return {
    versionKey,
    version
  };
}

function assertPartKey(partKeyRaw) {
  const partKey = String(partKeyRaw || "").trim();
  assertString(partKey, "partKey is required");
  if (!LESEN_PART_ORDER.includes(partKey)) {
    throw new AppError(`partKey must be one of: ${LESEN_PART_ORDER.join(", ")}`, 400);
  }
  return partKey;
}

async function listVersions(payload) {
  const level = String(payload.level || "").trim().toLowerCase();
  const themeKey = String(payload.themeKey || "").trim();

  assertString(level, "level is required");
  assertString(themeKey, "themeKey is required");

  const { data: db } = await getLesenSnapshot();
  const levelEntry = db?.levels?.[level] || null;
  if (!levelEntry) {
    throw new AppError("Level not found", 404);
  }

  const theme = resolveTheme(levelEntry, themeKey);
  return summarizeVersions(theme);
}

async function getPart(payload) {
  const level = String(payload.level || "").trim().toLowerCase();
  const themeKey = String(payload.themeKey || "").trim();
  const partKey = assertPartKey(payload.partKey);
  const versionKeyInput = String(payload.versionKey || "default").trim() || "default";

  assertString(level, "level is required");
  assertString(themeKey, "themeKey is required");

  const { data: db, revision } = await getLesenSnapshot();
  const levelEntry = db?.levels?.[level] || null;
  if (!levelEntry) {
    throw new AppError("Level not found", 404);
  }

  const theme = resolveTheme(levelEntry, themeKey);
  const { versionKey, version } = resolveVersion(theme, versionKeyInput);
  const part = version?.lesen?.parts?.[partKey] || null;

  if (!part) {
    throw new AppError("Part not found in this version", 404);
  }

  return {
    level,
    themeKey,
    versionKey,
    partKey,
    revision,
    part: clone(part)
  };
}

function normalizeKeywords(value, answerLabel) {
  const source = value === undefined || value === null
    ? []
    : (Array.isArray(value) ? value : String(value).split(","));
  const seen = new Set();
  const keywords = [];

  source.forEach((entry) => {
    const keyword = String(entry || "").replace(/\s+/g, " ").trim();
    if (!keyword) {
      return;
    }
    if (keyword.length > 120) {
      throw new AppError(`A keyword for ${answerLabel} is too long`, 400);
    }
    const identity = keyword.toLocaleLowerCase("de");
    if (!seen.has(identity)) {
      seen.add(identity);
      keywords.push(keyword);
    }
  });

  if (keywords.length > 30) {
    throw new AppError(`${answerLabel} can contain at most 30 keywords`, 400);
  }
  return keywords;
}

function normalizeReason(value, answerLabel) {
  const reason = String(value || "").trim();
  if (reason.length > 6000) {
    throw new AppError(`The answer reason for ${answerLabel} is too long`, 400);
  }
  return reason;
}

function normalizeHighlights(value, sources, answerLabel) {
  const highlights = Array.isArray(value) ? value : [];
  if (highlights.length > 60) {
    throw new AppError(`${answerLabel} can contain at most 60 highlights`, 400);
  }

  const normalized = highlights.map((item) => {
    const source = String(item?.source || "").trim();
    const start = Number(item?.start);
    const end = Number(item?.end);
    const sourceText = sources.get(source);
    if (sourceText === undefined || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > sourceText.length) {
      throw new AppError(`An invalid highlight range was supplied for ${answerLabel}`, 400, { answer: answerLabel, highlight: item });
    }
    const text = sourceText.slice(start, end);
    if (!text.trim() || text.length > 1000) {
      throw new AppError(`A highlight for ${answerLabel} is empty or too long`, 400);
    }
    return { source, start, end, text };
  }).sort((left, right) => left.source.localeCompare(right.source) || left.start - right.start);

  normalized.forEach((item, index) => {
    const previous = normalized[index - 1];
    if (previous?.source === item.source && previous.end > item.start) {
      throw new AppError(`Highlights for ${answerLabel} cannot overlap`, 400, { answer: answerLabel, highlights: [previous, item] });
    }
  });
  return normalized;
}

function assertKeywordsBelongToSource(keywords, sourceText, answerLabel) {
  const haystack = String(sourceText || "").replace(/\s+/g, " ").toLocaleLowerCase("de");
  const missing = keywords.filter((keyword) => !haystack.includes(keyword.toLocaleLowerCase("de")));
  if (missing.length) {
    throw new AppError(
      `Some keywords for ${answerLabel} were not found in its text`,
      400,
      { answer: answerLabel, keywords: missing }
    );
  }
}

function normalizeTeachingInsights(partKey, rawContent) {
  const content = clone(rawContent);

  if (partKey === "teil-1") {
    const texts = new Map((content.texts || []).map((item) => [String(item.id), item]));
    const headlines = new Map((content.headlines || []).map((item) => [String(item.id), item]));
    content.answers = (content.answers || []).map((answer) => {
      const answerLabel = `text ${answer.textId}`;
      const keywords = normalizeKeywords(answer.keywords, answerLabel);
      const text = String(texts.get(String(answer.textId))?.text || "");
      const headline = String(headlines.get(String(answer.headlineId))?.text || "");
      assertKeywordsBelongToSource(keywords, [text, headline].filter(Boolean).join(" "), answerLabel);
      return {
        ...answer,
        reason: normalizeReason(answer.reason, answerLabel),
        keywords,
        highlights: normalizeHighlights(answer.highlights, new Map([["text", text], ["headline", headline]]), answerLabel)
      };
    });
  } else if (partKey === "teil-2") {
    const passageText = [content.passage?.text, ...(content.passage?.paragraphs || [])].filter(Boolean).join(" ");
    content.questions = (content.questions || []).map((question) => {
      const answerLabel = `question ${question.id}`;
      const keywords = normalizeKeywords(question.keywords, answerLabel);
      const source = [passageText, question.prompt, ...(question.options || []).map((option) => option.text)].filter(Boolean).join(" ");
      assertKeywordsBelongToSource(keywords, source, answerLabel);
      const sources = new Map([
        ["passage-title", String(content.passage?.title || "")],
        ["question", String(question.prompt || "")],
        ...(content.passage?.paragraphs || []).map((paragraph, index) => [`passage:${index}`, String(paragraph || "")]),
        ...(question.options || []).map((option) => [`option:${String(option.id || "").toLowerCase()}`, String(option.text || "")])
      ]);
      return {
        ...question,
        reason: normalizeReason(question.reason, answerLabel),
        keywords,
        highlights: normalizeHighlights(question.highlights, sources, answerLabel)
      };
    });
  } else if (partKey === "teil-3") {
    const situations = new Map((content.situations || []).map((item) => [String(item.id), item]));
    const ads = new Map((content.ads || []).map((item) => [String(item.id), item]));
    content.answers = (content.answers || []).map((answer) => {
      const answerLabel = `situation ${answer.situationId}`;
      const keywords = normalizeKeywords(answer.keywords, answerLabel);
      const situation = String(situations.get(String(answer.situationId))?.text || "");
      const ad = String(ads.get(String(answer.adId))?.text || "");
      assertKeywordsBelongToSource(keywords, [situation, ad].filter(Boolean).join(" "), answerLabel);
      return {
        ...answer,
        reason: normalizeReason(answer.reason, answerLabel),
        keywords,
        highlights: normalizeHighlights(answer.highlights, new Map([["situation", situation], ["ad", ad]]), answerLabel)
      };
    });
  }

  return content;
}

async function getEditorContext(payload) {
  const requestedLevel = String(payload.level || "").trim().toLowerCase();
  const partKey = assertPartKey(payload.partKey);
  const { data: db, revision } = await getLesenSnapshot();
  const levels = Object.keys(db?.levels || {});
  const level = levels.includes(requestedLevel) ? requestedLevel : (levels[0] || requestedLevel);
  const levelEntry = db?.levels?.[level] || null;
  const themes = summarizeThemes(levelEntry);
  const requestedTheme = String(payload.themeKey || "").trim();
  const themeKey = themes.some((theme) => theme.key === requestedTheme)
    ? requestedTheme
    : (themes[0]?.key || "");
  const theme = levelEntry?.themes?.[themeKey] || null;
  const versions = summarizeVersions(theme);
  const requestedVersion = String(payload.versionKey || "").trim();
  const versionKey = versions.some((version) => version.key === requestedVersion)
    ? requestedVersion
    : (versions[0]?.key || "default");
  const part = theme?.versions?.[versionKey]?.lesen?.parts?.[partKey] || null;

  return {
    revision,
    levels,
    themes,
    versions,
    selection: { level, themeKey, versionKey, partKey },
    part: part ? clone(part) : null
  };
}

async function updatePart(payload) {
  const level = String(payload.level || "").trim().toLowerCase();
  const themeKey = String(payload.themeKey || "").trim();
  const partKey = assertPartKey(payload.partKey);
  const versionKeyInput = String(payload.versionKey || "default").trim() || "default";

  assertString(level, "level is required");
  assertString(themeKey, "themeKey is required");

  if (!isPlainObject(payload.meta)) {
    throw new AppError("meta must be an object", 400);
  }
  if (!isPlainObject(payload.content)) {
    throw new AppError("content must be an object", 400);
  }

  const normalizedContent = normalizeTeachingInsights(partKey, payload.content);
  const mutation = await mutateJsonByKey("lesen", (db) => {
    const levelEntry = db?.levels?.[level] || null;
    if (!levelEntry) {
      throw new AppError("Level not found", 404);
    }

    const theme = resolveTheme(levelEntry, themeKey);
    const { versionKey, version } = resolveVersion(theme, versionKeyInput);

    if (!version.lesen || typeof version.lesen !== "object") {
      version.lesen = { partOrder: [...LESEN_PART_ORDER], parts: {} };
    }
    if (!version.lesen.parts || typeof version.lesen.parts !== "object") {
      version.lesen.parts = {};
    }

    version.lesen.parts[partKey] = {
      ...(version.lesen.parts[partKey] || {}),
      meta: payload.meta,
      content: normalizedContent
    };

    return {
      data: db,
      result: {
        level,
        themeKey,
        versionKey,
        partKey,
        part: clone(version.lesen.parts[partKey])
      }
    };
  }, { expectedRevision: payload.revision });

  return {
    ...mutation.result,
    revision: mutation.revision
  };
}

async function createTheme(payload) {
  const level = String(payload.level || "").trim().toLowerCase();
  const themeKey = String(payload.themeKey || "").trim();
  const title = String(payload.title || "").trim();

  assertString(level, "level is required");
  assertString(themeKey, "themeKey is required");
  assertString(title, "title is required");

  const db = await getLesenDb();
  const levelEntry = ensureLevel(db, level);

  if (levelEntry.themes[themeKey]) {
    throw new AppError("Theme already exists in this level", 409);
  }

  levelEntry.themes[themeKey] = createEmptyTheme(level, themeKey, title);
  if (!levelEntry.themeOrder.includes(themeKey)) {
    levelEntry.themeOrder.push(themeKey);
  }

  await writeJsonByKey("lesen", db);
  return levelEntry.themes[themeKey];
}

async function updateTheme(payload) {
  const level = String(payload.level || "").trim().toLowerCase();
  const themeKey = String(payload.themeKey || "").trim();
  const title = String(payload.title || "").trim();
  const newThemeKey = String(payload.newThemeKey || "").trim();

  assertString(level, "level is required");
  assertString(themeKey, "themeKey is required");

  const db = await getLesenDb();
  const levelEntry = ensureLevel(db, level);
  const existing = levelEntry.themes[themeKey];

  if (!existing) {
    throw new AppError("Theme not found", 404);
  }

  let activeKey = themeKey;
  if (newThemeKey && newThemeKey !== themeKey) {
    if (levelEntry.themes[newThemeKey]) {
      throw new AppError("newThemeKey already exists in this level", 409);
    }
    levelEntry.themes[newThemeKey] = existing;
    delete levelEntry.themes[themeKey];
    levelEntry.themeOrder = levelEntry.themeOrder.map((entry) => (entry === themeKey ? newThemeKey : entry));
    activeKey = newThemeKey;
  }

  const theme = levelEntry.themes[activeKey];
  theme.id = activeKey;

  if (title) {
    theme.title = title;
    const versionKeys = Object.keys(theme.versions || {});
    versionKeys.forEach((versionKey) => {
      const version = theme.versions[versionKey];
      if (version && typeof version === "object") {
        version.title = title;
      }
    });
  }

  await writeJsonByKey("lesen", db);
  return {
    key: activeKey,
    theme
  };
}

async function deleteTheme(payload) {
  const level = String(payload.level || "").trim().toLowerCase();
  const themeKey = String(payload.themeKey || "").trim();

  assertString(level, "level is required");
  assertString(themeKey, "themeKey is required");

  const db = await getLesenDb();
  const levelEntry = ensureLevel(db, level);
  if (!levelEntry.themes[themeKey]) {
    throw new AppError("Theme not found", 404);
  }

  delete levelEntry.themes[themeKey];
  levelEntry.themeOrder = levelEntry.themeOrder.filter((entry) => entry !== themeKey);

  await writeJsonByKey("lesen", db);
  return { deleted: true };
}

module.exports = {
  LESEN_PART_ORDER,
  listThemes,
  getTheme,
  listVersions,
  getPart,
  getEditorContext,
  updatePart,
  normalizeTeachingInsights,
  createTheme,
  updateTheme,
  deleteTheme
};
