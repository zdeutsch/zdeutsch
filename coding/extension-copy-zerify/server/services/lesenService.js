const { readJsonByKey, writeJsonByKey } = require("../repositories/jsonRepository");
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

async function listThemes(level) {
  assertString(level, "level is required");
  const db = await getLesenDb();
  const levelEntry = db?.levels?.[level] || null;
  if (!levelEntry) {
    return [];
  }

  const orderedKeys = levelEntry.themeOrder?.length
    ? levelEntry.themeOrder
    : Object.keys(levelEntry.themes || {});

  return orderedKeys
    .map((themeKey) => {
      const theme = levelEntry.themes?.[themeKey];
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

async function getTheme(level, themeKey) {
  assertString(level, "level is required");
  assertString(themeKey, "themeKey is required");

  const db = await getLesenDb();
  const theme = db?.levels?.[level]?.themes?.[themeKey] || null;
  if (!theme) {
    throw new AppError("Theme not found", 404);
  }

  return theme;
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

  const db = await getLesenDb();
  const levelEntry = db?.levels?.[level] || null;
  if (!levelEntry) {
    throw new AppError("Level not found", 404);
  }

  const theme = resolveTheme(levelEntry, themeKey);
  const versionKeys = Array.isArray(theme.versionOrder) && theme.versionOrder.length
    ? theme.versionOrder
    : Object.keys(theme.versions || {});

  return versionKeys
    .map((versionKey) => {
      const version = theme.versions?.[versionKey];
      if (!version) {
        return null;
      }
      return {
        key: versionKey,
        label: version.label || versionKey,
        title: version.title || theme.title || themeKey
      };
    })
    .filter(Boolean);
}

async function getPart(payload) {
  const level = String(payload.level || "").trim().toLowerCase();
  const themeKey = String(payload.themeKey || "").trim();
  const partKey = assertPartKey(payload.partKey);
  const versionKeyInput = String(payload.versionKey || "default").trim() || "default";

  assertString(level, "level is required");
  assertString(themeKey, "themeKey is required");

  const db = await getLesenDb();
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
    part: JSON.parse(JSON.stringify(part))
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

  const db = await getLesenDb();
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
    content: payload.content
  };

  await writeJsonByKey("lesen", db);

  return {
    level,
    themeKey,
    versionKey,
    partKey,
    part: version.lesen.parts[partKey]
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
  updatePart,
  createTheme,
  updateTheme,
  deleteTheme
};
