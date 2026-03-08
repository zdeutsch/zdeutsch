const { readJsonByKey, writeJsonByKey } = require("../repositories/jsonRepository");
const AppError = require("../utils/appError");
const { assertString } = require("../utils/validators");
const { slugify, uniqueId } = require("../utils/id");

function createPartSkeleton(partKey) {
  const match = String(partKey || "").match(/(\d+)/);
  const partNumber = match ? Number(match[1]) : 1;
  return {
    meta: {
      partLabel: `Schreiben Teil ${partNumber}`,
      partNumber
    },
    content: {
      instruction: "",
      tasks: []
    }
  };
}

function normalizeLines(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function ensureStructure(db, level, partKey) {
  if (!db.levels || typeof db.levels !== "object") {
    db.levels = {};
  }

  if (!db.levels[level]) {
    db.levels[level] = {
      partOrder: [partKey],
      parts: {
        [partKey]: createPartSkeleton(partKey)
      }
    };
  }

  const levelEntry = db.levels[level];
  if (!Array.isArray(levelEntry.partOrder)) {
    levelEntry.partOrder = Object.keys(levelEntry.parts || {});
  }
  if (!levelEntry.parts || typeof levelEntry.parts !== "object") {
    levelEntry.parts = {};
  }

  if (!levelEntry.parts[partKey]) {
    levelEntry.parts[partKey] = createPartSkeleton(partKey);
  }
  if (!levelEntry.partOrder.includes(partKey)) {
    levelEntry.partOrder.push(partKey);
  }

  const part = levelEntry.parts[partKey];
  if (!part.content || typeof part.content !== "object") {
    part.content = {
      instruction: "",
      tasks: []
    };
  }
  if (!Array.isArray(part.content.tasks)) {
    part.content.tasks = [];
  }

  return part;
}

function normalizeTask(payload, fallback = {}) {
  const title = String(payload.title ?? fallback.title ?? "").trim();
  const prompt = String(payload.prompt ?? fallback.prompt ?? "").trim();

  const taskIdRaw = String(payload.taskId || fallback.id || "").trim();
  const taskId = taskIdRaw || slugify(title) || uniqueId("task");

  const ad = {
    header: String(payload.adHeader ?? fallback.ad?.header ?? "").trim(),
    tagline: String(payload.adTagline ?? fallback.ad?.tagline ?? "").trim(),
    paragraphs: normalizeLines(payload.adParagraphs ?? fallback.ad?.paragraphs ?? []),
    offer: normalizeLines(payload.adOffer ?? fallback.ad?.offer ?? []),
    price: String(payload.adPrice ?? fallback.ad?.price ?? "").trim(),
    address: normalizeLines(payload.adAddress ?? fallback.ad?.address ?? [])
  };

  const requirements = {
    mode: normalizeLines(payload.requirementMode ?? fallback.requirements?.mode ?? []),
    points: normalizeLines(payload.requirementPoints ?? fallback.requirements?.points ?? [])
  };

  return {
    id: taskId,
    title,
    ad,
    prompt,
    requirements
  };
}

function normalizeContext(payload) {
  const level = String(payload.level || "").trim().toLowerCase();
  const part = String(payload.part || "").trim().toLowerCase();

  assertString(level, "level is required");
  assertString(part, "part is required");

  return { level, part };
}

async function getDb() {
  return readJsonByKey("shreiben");
}

async function listTasks(payload) {
  const context = normalizeContext(payload);
  const db = await getDb();
  const part = ensureStructure(db, context.level, context.part);

  return part.content.tasks.map((task) => ({
    id: task.id,
    title: task.title || "",
    prompt: task.prompt || "",
    ad: {
      header: task.ad?.header || "",
      tagline: task.ad?.tagline || "",
      paragraphs: Array.isArray(task.ad?.paragraphs) ? task.ad.paragraphs : [],
      offer: Array.isArray(task.ad?.offer) ? task.ad.offer : [],
      price: task.ad?.price || "",
      address: Array.isArray(task.ad?.address) ? task.ad.address : []
    },
    requirements: {
      mode: Array.isArray(task.requirements?.mode) ? task.requirements.mode : [],
      points: Array.isArray(task.requirements?.points) ? task.requirements.points : []
    }
  }));
}

async function createTask(payload) {
  const context = normalizeContext(payload);
  const db = await getDb();
  const part = ensureStructure(db, context.level, context.part);
  const task = normalizeTask(payload);

  if (!task.title) {
    throw new AppError("title is required", 400);
  }
  if (!task.prompt) {
    throw new AppError("prompt is required", 400);
  }

  if (part.content.tasks.some((entry) => entry.id === task.id)) {
    throw new AppError("taskId already exists in this part", 409);
  }

  part.content.tasks.push(task);
  await writeJsonByKey("shreiben", db);
  return task;
}

async function updateTask(payload) {
  const context = normalizeContext(payload);
  const taskId = String(payload.taskId || "").trim();
  assertString(taskId, "taskId is required");

  const db = await getDb();
  const part = ensureStructure(db, context.level, context.part);

  const index = part.content.tasks.findIndex((entry) => entry.id === taskId);
  if (index < 0) {
    throw new AppError("Task not found", 404);
  }

  const current = part.content.tasks[index];
  const next = normalizeTask(payload, current);
  next.id = taskId;

  if (!next.title) {
    throw new AppError("title is required", 400);
  }
  if (!next.prompt) {
    throw new AppError("prompt is required", 400);
  }

  part.content.tasks[index] = next;
  await writeJsonByKey("shreiben", db);
  return next;
}

async function deleteTask(payload) {
  const context = normalizeContext(payload);
  const taskId = String(payload.taskId || "").trim();
  assertString(taskId, "taskId is required");

  const db = await getDb();
  const part = ensureStructure(db, context.level, context.part);

  const before = part.content.tasks.length;
  part.content.tasks = part.content.tasks.filter((entry) => entry.id !== taskId);

  if (part.content.tasks.length === before) {
    throw new AppError("Task not found", 404);
  }

  await writeJsonByKey("shreiben", db);
  return { deleted: true };
}

module.exports = {
  listTasks,
  createTask,
  updateTask,
  deleteTask
};
