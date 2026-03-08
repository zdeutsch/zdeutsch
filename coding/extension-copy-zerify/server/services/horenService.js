const { readJsonByKey, writeJsonByKey } = require("../repositories/jsonRepository");
const AppError = require("../utils/appError");
const { assertString } = require("../utils/validators");
const { uniqueId } = require("../utils/id");

const PART_ORDER = ["teil-1", "teil-2", "teil-3"];

const PART_LABELS = {
  "teil-1": "Teil 1",
  "teil-2": "Teil 2",
  "teil-3": "Teil 3"
};

function createLevelSkeleton(level) {
  const upper = String(level || "").toUpperCase();
  const themeKey = `horen-${level}`;
  return {
    title: `${upper} Hören`,
    description: "",
    themeOrder: [themeKey],
    themes: {
      [themeKey]: {
        title: `${upper} Hören`,
        section: "horen",
        description: "",
        "hören": {
          partOrder: PART_ORDER,
          parts: {
            "teil-1": createPartSkeleton("teil-1"),
            "teil-2": createPartSkeleton("teil-2"),
            "teil-3": createPartSkeleton("teil-3")
          }
        }
      }
    }
  };
}

function createPartSkeleton(partKey) {
  return {
    meta: {
      partLabel: PART_LABELS[partKey] || partKey
    },
    content: {
      instruction: "",
      topics: []
    },
    totalPoints: 25
  };
}

function ensureStructure(db, level, partKey, requestedThemeKey) {
  if (!db.levels || typeof db.levels !== "object") {
    db.levels = {};
  }

  if (!db.levels[level]) {
    db.levels[level] = createLevelSkeleton(level);
  }

  const levelEntry = db.levels[level];
  if (!Array.isArray(levelEntry.themeOrder)) {
    levelEntry.themeOrder = Object.keys(levelEntry.themes || {});
  }
  if (!levelEntry.themes || typeof levelEntry.themes !== "object") {
    levelEntry.themes = {};
  }

  const themeKey = requestedThemeKey || levelEntry.themeOrder[0] || `horen-${level}`;

  if (!levelEntry.themes[themeKey]) {
    levelEntry.themes[themeKey] = {
      title: `${String(level).toUpperCase()} Hören`,
      section: "horen",
      description: "",
      "hören": {
        partOrder: PART_ORDER,
        parts: {}
      }
    };
  }

  if (!levelEntry.themeOrder.includes(themeKey)) {
    levelEntry.themeOrder.push(themeKey);
  }

  const theme = levelEntry.themes[themeKey];
  if (!theme["hören"] || typeof theme["hören"] !== "object") {
    theme["hören"] = {
      partOrder: PART_ORDER,
      parts: {}
    };
  }

  const horenRoot = theme["hören"];
  if (!Array.isArray(horenRoot.partOrder) || !horenRoot.partOrder.length) {
    horenRoot.partOrder = PART_ORDER;
  }
  if (!horenRoot.parts || typeof horenRoot.parts !== "object") {
    horenRoot.parts = {};
  }

  if (!horenRoot.parts[partKey]) {
    horenRoot.parts[partKey] = createPartSkeleton(partKey);
  }

  const part = horenRoot.parts[partKey];
  if (!part.content || typeof part.content !== "object") {
    part.content = { instruction: "", topics: [] };
  }
  if (!Array.isArray(part.content.topics)) {
    part.content.topics = [];
  }

  return {
    levelEntry,
    themeKey,
    part
  };
}

function normalizeStatements(statements, topicId) {
  const source = Array.isArray(statements) ? statements : [];
  return source.map((statement, index) => {
    const item = statement && typeof statement === "object" ? statement : {};
    const number = Number.isFinite(item.number) ? Number(item.number) : index + 1;
    return {
      id: String(item.id || `${topicId}-s${index + 1}`),
      number,
      text: String(item.text || "").trim(),
      correct: Boolean(item.correct)
    };
  });
}

async function getHorenDb() {
  return readJsonByKey("horen");
}

function normalizeContext(payload) {
  const level = String(payload.level || "").trim().toLowerCase();
  const part = String(payload.part || "").trim().toLowerCase();
  const themeKey = String(payload.themeKey || "").trim();

  assertString(level, "level is required");
  assertString(part, "part is required");

  if (!PART_ORDER.includes(part)) {
    throw new AppError(`part must be one of: ${PART_ORDER.join(", ")}`, 400);
  }

  return {
    level,
    part,
    themeKey: themeKey || null
  };
}

async function listTopics(payload) {
  const context = normalizeContext(payload);
  const db = await getHorenDb();
  const { part, themeKey } = ensureStructure(db, context.level, context.part, context.themeKey);

  return {
    themeKey,
    topics: part.content.topics.map((topic) => ({
      id: topic.id,
      title: topic.title || "",
      tag: topic.tag || "",
      statements: topic.statements || [],
      statementsCount: (topic.statements || []).length
    }))
  };
}

async function createTopic(payload) {
  const context = normalizeContext(payload);
  const title = String(payload.title || "").trim();
  assertString(title, "title is required");

  const db = await getHorenDb();
  const { part, themeKey } = ensureStructure(db, context.level, context.part, context.themeKey);
  const topicId = String(payload.topicId || uniqueId("topic"));

  if (part.content.topics.some((topic) => topic.id === topicId)) {
    throw new AppError("topicId already exists in this part", 409);
  }

  const topic = {
    id: topicId,
    title,
    tag: String(payload.tag || "").trim(),
    statements: normalizeStatements(payload.statements, topicId)
  };

  part.content.topics.push(topic);
  await writeJsonByKey("horen", db);

  return {
    themeKey,
    topic
  };
}

async function updateTopic(payload) {
  const context = normalizeContext(payload);
  const topicId = String(payload.topicId || "").trim();
  assertString(topicId, "topicId is required");

  const db = await getHorenDb();
  const { part, themeKey } = ensureStructure(db, context.level, context.part, context.themeKey);

  const index = part.content.topics.findIndex((topic) => topic.id === topicId);
  if (index < 0) {
    throw new AppError("Topic not found", 404);
  }

  const current = part.content.topics[index];
  const nextTopic = {
    ...current,
    title: String(payload.title ?? current.title ?? "").trim(),
    tag: String(payload.tag ?? current.tag ?? "").trim(),
    statements: Array.isArray(payload.statements)
      ? normalizeStatements(payload.statements, topicId)
      : normalizeStatements(current.statements, topicId)
  };

  if (!nextTopic.title) {
    throw new AppError("title is required", 400);
  }

  part.content.topics[index] = nextTopic;
  await writeJsonByKey("horen", db);

  return {
    themeKey,
    topic: nextTopic
  };
}

async function deleteTopic(payload) {
  const context = normalizeContext(payload);
  const topicId = String(payload.topicId || "").trim();
  assertString(topicId, "topicId is required");

  const db = await getHorenDb();
  const { part } = ensureStructure(db, context.level, context.part, context.themeKey);

  const before = part.content.topics.length;
  part.content.topics = part.content.topics.filter((topic) => topic.id !== topicId);

  if (part.content.topics.length === before) {
    throw new AppError("Topic not found", 404);
  }

  await writeJsonByKey("horen", db);
  return { deleted: true };
}

module.exports = {
  PART_ORDER,
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic
};
