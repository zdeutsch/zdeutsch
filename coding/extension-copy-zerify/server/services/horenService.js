const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const {
  readJsonByKey,
  writeJsonByKey,
  mutateJsonByKey
} = require("../repositories/jsonRepository");
const { SITE_DIR } = require("../config/constants");
const AppError = require("../utils/appError");
const { assertString } = require("../utils/validators");
const { uniqueId } = require("../utils/id");

const PART_ORDER = ["teil-1", "teil-2", "teil-3"];

const PART_LABELS = {
  "teil-1": "Teil 1",
  "teil-2": "Teil 2",
  "teil-3": "Teil 3"
};

const AUDIO_UPLOAD_DIR = path.join(SITE_DIR, "assets", "audio", "horen");
const AUDIO_PUBLIC_DIR = "assets/audio/horen";
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

const AUDIO_FORMATS = Object.freeze({
  mp3: { extension: "mp3", mimeType: "audio/mpeg" },
  wav: { extension: "wav", mimeType: "audio/wav" },
  ogg: { extension: "ogg", mimeType: "audio/ogg" },
  m4a: { extension: "m4a", mimeType: "audio/mp4" },
  webm: { extension: "webm", mimeType: "audio/webm" }
});

function detectAudioFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }
  if (buffer.subarray(0, 3).toString("ascii") === "ID3"
    || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
    return AUDIO_FORMATS.mp3;
  }
  if (buffer.length >= 12
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WAVE") {
    return AUDIO_FORMATS.wav;
  }
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") {
    return AUDIO_FORMATS.ogg;
  }
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return AUDIO_FORMATS.m4a;
  }
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return AUDIO_FORMATS.webm;
  }
  return null;
}

function normalizeAudioUpload(buffer, originalName) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new AppError("Choose a non-empty audio file", 400);
  }
  if (buffer.length > MAX_AUDIO_BYTES) {
    throw new AppError("Audio file is too large (maximum 50 MB)", 413);
  }
  const format = detectAudioFormat(buffer);
  if (!format) {
    throw new AppError("Unsupported audio file. Use MP3, WAV, OGG, M4A, or WEBM", 400);
  }
  const cleanOriginalName = path.basename(String(originalName || `audio.${format.extension}`)).slice(0, 180);
  return {
    ...format,
    originalName: cleanOriginalName || `audio.${format.extension}`,
    sizeBytes: buffer.length
  };
}

function sanitizeAudioName(value) {
  return String(value || "audio")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "audio";
}

function resolveManagedAudioPath(source) {
  const relativePath = String(source || "").replace(/\\/g, "/");
  if (!/^assets\/audio\/horen\/[a-z0-9._-]+$/i.test(relativePath)) {
    return null;
  }
  return path.join(SITE_DIR, ...relativePath.split("/"));
}

async function removeManagedAudio(source) {
  const absolutePath = resolveManagedAudioPath(source);
  if (absolutePath) {
    await fs.unlink(absolutePath).catch((error) => {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    });
  }
}

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
      audio: topic.audio || null,
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

  const topic = part.content.topics.find((entry) => entry.id === topicId);
  const before = part.content.topics.length;
  part.content.topics = part.content.topics.filter((topic) => topic.id !== topicId);

  if (part.content.topics.length === before) {
    throw new AppError("Topic not found", 404);
  }

  await writeJsonByKey("horen", db);
  await removeManagedAudio(topic?.audio?.src);
  return { deleted: true };
}

async function uploadTopicAudio(payload) {
  const context = normalizeContext(payload);
  const topicId = String(payload.topicId || "").trim();
  assertString(topicId, "topicId is required");

  const buffer = payload.buffer;
  const upload = normalizeAudioUpload(buffer, payload.fileName);
  const safeTopicId = sanitizeAudioName(topicId);
  const fileName = `${context.level}-${context.part}-${safeTopicId}-${Date.now()}-${randomUUID().slice(0, 8)}.${upload.extension}`;
  const relativePath = `${AUDIO_PUBLIC_DIR}/${fileName}`;
  const absolutePath = path.join(AUDIO_UPLOAD_DIR, fileName);
  const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
  const audio = {
    src: relativePath,
    fileName: upload.originalName,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
    uploadedAt: new Date().toISOString()
  };

  await fs.mkdir(AUDIO_UPLOAD_DIR, { recursive: true });
  await fs.writeFile(temporaryPath, buffer);
  await fs.rename(temporaryPath, absolutePath);

  let previousAudio = null;
  let result;
  try {
    const mutation = await mutateJsonByKey("horen", (db) => {
      const { part, themeKey } = ensureStructure(db, context.level, context.part, context.themeKey);
      const topic = part.content.topics.find((entry) => entry.id === topicId);
      if (!topic) {
        throw new AppError("Topic not found", 404);
      }
      previousAudio = topic.audio || null;
      topic.audio = audio;
      return { data: db, result: { themeKey, topic } };
    });
    result = mutation.result;
  } catch (error) {
    await fs.unlink(absolutePath).catch(() => {});
    throw error;
  }

  if (previousAudio?.src && previousAudio.src !== audio.src) {
    await removeManagedAudio(previousAudio.src);
  }
  return result;
}

async function deleteTopicAudio(payload) {
  const context = normalizeContext(payload);
  const topicId = String(payload.topicId || "").trim();
  assertString(topicId, "topicId is required");

  let previousAudio = null;
  const mutation = await mutateJsonByKey("horen", (db) => {
    const { part, themeKey } = ensureStructure(db, context.level, context.part, context.themeKey);
    const topic = part.content.topics.find((entry) => entry.id === topicId);
    if (!topic) {
      throw new AppError("Topic not found", 404);
    }
    previousAudio = topic.audio || null;
    delete topic.audio;
    return { data: db, result: { themeKey, topic } };
  });

  await removeManagedAudio(previousAudio?.src);
  return mutation.result;
}

module.exports = {
  PART_ORDER,
  MAX_AUDIO_BYTES,
  detectAudioFormat,
  normalizeAudioUpload,
  listTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  uploadTopicAudio,
  deleteTopicAudio
};
