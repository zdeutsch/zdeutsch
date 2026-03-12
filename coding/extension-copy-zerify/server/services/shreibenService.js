const { readJsonByKey, writeJsonByKey } = require("../repositories/jsonRepository");
const AppError = require("../utils/appError");
const { assertString } = require("../utils/validators");

const DEFAULT_LEGACY_PART_KEY = "teil-1";
const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function createLevelSkeleton() {
  return {
    tasks: []
  };
}

function normalizeMarkdown(value) {
  return String(value || "").trim();
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

function cleanMarkdownLine(value) {
  return String(value || "")
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[\-*+]\s+/, "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .trim();
}

function pickLegacyPart(levelEntry, partKey) {
  const parts = levelEntry?.parts && typeof levelEntry.parts === "object"
    ? levelEntry.parts
    : {};
  const partKeys = Object.keys(parts);
  const requestedPart = String(partKey || "").trim().toLowerCase();
  if (requestedPart && parts[requestedPart]) {
    return parts[requestedPart];
  }
  if (Array.isArray(levelEntry?.partOrder) && levelEntry.partOrder.length) {
    const orderedPart = levelEntry.partOrder.find((key) => parts[key]);
    if (orderedPart) {
      return parts[orderedPart];
    }
  }
  if (partKeys.length) {
    return parts[partKeys[0]];
  }
  return null;
}

function markdownFromLegacyContent(task) {
  const lines = [];
  const ad = task?.ad && typeof task.ad === "object" ? task.ad : {};

  if (ad.header) {
    lines.push(`## ${String(ad.header).trim()}`);
  }
  if (ad.tagline) {
    lines.push(`**${String(ad.tagline).trim()}**`);
  }

  normalizeLines(ad.paragraphs).forEach((paragraph) => {
    lines.push(paragraph);
  });

  const offerItems = normalizeLines(ad.offer);
  if (offerItems.length) {
    lines.push("### Angebot");
    offerItems.forEach((item) => {
      lines.push(`- ${item}`);
    });
  }

  if (ad.price) {
    lines.push(`**${String(ad.price).trim()}**`);
  }

  const addressLines = normalizeLines(ad.address);
  if (addressLines.length) {
    lines.push(addressLines.join(", "));
  }

  return lines.join("\n\n").trim();
}

function markdownFromLegacyTasks(task) {
  const lines = [];
  const requirements = task?.requirements && typeof task.requirements === "object"
    ? task.requirements
    : {};

  const modes = normalizeLines(requirements.mode);
  const points = normalizeLines(requirements.points);

  modes.forEach((modeLine) => {
    lines.push(`- ${modeLine}`);
  });

  if (modes.length && points.length) {
    lines.push("");
  }

  points.forEach((pointLine) => {
    lines.push(`- ${pointLine}`);
  });

  return lines.join("\n").trim();
}

function markdownFromLegacyIstructions(task, index) {
  const lines = [];
  const title = normalizeMarkdown(task?.title);
  const prompt = normalizeMarkdown(task?.prompt);

  if (title) {
    lines.push(`# ${title}`);
  } else {
    lines.push(`# Task ${index + 1}`);
  }

  if (prompt) {
    lines.push("");
    lines.push(prompt);
  }

  return lines.join("\n").trim();
}

function normalizeTaskShape(rawTask, fallback = {}, index = 0) {
  const source = rawTask && typeof rawTask === "object" ? rawTask : {};
  const current = fallback && typeof fallback === "object" ? fallback : {};

  const hasNewShape = ["istructions", "instructions", "content", "tasks"].some((key) => {
    return Object.prototype.hasOwnProperty.call(source, key)
      || Object.prototype.hasOwnProperty.call(current, key);
  });

  if (hasNewShape) {
    const legacyBase = {
      ...(current || {}),
      ...(source || {})
    };

    let istructions = normalizeMarkdown(
      source.istructions
      ?? source.instructions
      ?? current.istructions
      ?? current.instructions
    );
    let content = normalizeMarkdown(source.content ?? current.content);
    let tasks = normalizeMarkdown(source.tasks ?? current.tasks);

    if (!istructions) {
      istructions = normalizeMarkdown(markdownFromLegacyIstructions(legacyBase, index));
    }
    if (!content) {
      content = normalizeMarkdown(markdownFromLegacyContent(legacyBase));
    }
    if (!tasks) {
      tasks = normalizeMarkdown(markdownFromLegacyTasks(legacyBase));
    }

    const title = normalizeMarkdown(source.title ?? current.title)
      || extractTaskTitle({ istructions }, index);

    return {
      title,
      istructions,
      content,
      tasks
    };
  }

  const legacyBase = {
    ...(current || {}),
    ...(source || {})
  };
  const istructions = normalizeMarkdown(markdownFromLegacyIstructions(legacyBase, index));
  const content = normalizeMarkdown(markdownFromLegacyContent(legacyBase));
  const tasks = normalizeMarkdown(markdownFromLegacyTasks(legacyBase));
  const title = normalizeMarkdown(legacyBase.title)
    || extractTaskTitle({ istructions }, index);

  return {
    title,
    istructions,
    content,
    tasks
  };
}

function ensureStructure(db, level, partKey = DEFAULT_LEGACY_PART_KEY) {
  if (!db.levels || typeof db.levels !== "object") {
    db.levels = {};
  }

  if (!db.levels[level]) {
    db.levels[level] = createLevelSkeleton();
    return db.levels[level];
  }

  const levelEntry = db.levels[level] || {};
  if (Array.isArray(levelEntry.tasks)) {
    db.levels[level] = {
      tasks: levelEntry.tasks.map((task, index) => normalizeTaskShape(task, {}, index))
    };
    return db.levels[level];
  }

  const legacyPart = pickLegacyPart(levelEntry, partKey);
  const legacyTasks = Array.isArray(legacyPart?.content?.tasks)
    ? legacyPart.content.tasks
    : [];

  db.levels[level] = {
    tasks: legacyTasks.map((task, index) => normalizeTaskShape(task, {}, index))
  };

  return db.levels[level];
}

function normalizeContext(payload) {
  const level = String(payload.level || "").trim().toLowerCase();
  const part = String(payload.part || "").trim().toLowerCase() || DEFAULT_LEGACY_PART_KEY;

  assertString(level, "level is required");
  return { level, part };
}

function extractTaskTitle(task, index) {
  const lines = String(task?.istructions || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const headingLine = lines.find((line) => /^#{1,6}\s+/.test(line));
  if (headingLine) {
    const heading = cleanMarkdownLine(headingLine);
    if (heading) {
      return heading;
    }
  }

  const firstLine = lines.find(Boolean);
  if (firstLine) {
    const cleaned = cleanMarkdownLine(firstLine);
    if (cleaned) {
      return cleaned;
    }
  }

  return `Task ${index + 1}`;
}

function buildTaskId(index) {
  return `task-${index + 1}`;
}

function toTaskResponse(task, index) {
  const normalized = normalizeTaskShape(task, {}, index);
  return {
    id: buildTaskId(index),
    title: normalized.title || extractTaskTitle(normalized, index),
    istructions: normalized.istructions,
    content: normalized.content,
    tasks: normalized.tasks
  };
}

function parseTaskIndex(taskId, size) {
  const raw = String(taskId || "").trim();
  assertString(raw, "taskId is required");

  const taskFormat = raw.match(/^task-(\d+)$/i);
  const numeric = taskFormat ? taskFormat[1] : raw;
  const parsed = Number.parseInt(numeric, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new AppError("Task not found", 404);
  }

  const index = parsed - 1;
  if (index < 0 || index >= size) {
    throw new AppError("Task not found", 404);
  }

  return index;
}

function validateTaskText(task) {
  if (!task.title) {
    throw new AppError("title is required", 400);
  }
  if (!task.istructions) {
    throw new AppError("istructions is required", 400);
  }
  if (!task.content) {
    throw new AppError("content is required", 400);
  }
  if (!task.tasks) {
    throw new AppError("tasks is required", 400);
  }
}

async function getDb() {
  return readJsonByKey("shreiben");
}

async function listTasks(payload) {
  const context = normalizeContext(payload);
  const db = await getDb();
  const levelEntry = ensureStructure(db, context.level, context.part);
  return levelEntry.tasks.map((task, index) => toTaskResponse(task, index));
}

async function createTask(payload) {
  const context = normalizeContext(payload);
  const db = await getDb();
  const levelEntry = ensureStructure(db, context.level, context.part);

  const task = normalizeTaskShape(payload, {}, levelEntry.tasks.length);
  validateTaskText(task);

  levelEntry.tasks.push(task);
  await writeJsonByKey("shreiben", db);
  return toTaskResponse(task, levelEntry.tasks.length - 1);
}

async function updateTask(payload) {
  const context = normalizeContext(payload);
  const taskId = String(payload.taskId || "").trim();

  const db = await getDb();
  const levelEntry = ensureStructure(db, context.level, context.part);
  const index = parseTaskIndex(taskId, levelEntry.tasks.length);

  const current = levelEntry.tasks[index];
  const next = normalizeTaskShape(payload, current, index);
  validateTaskText(next);

  levelEntry.tasks[index] = next;
  await writeJsonByKey("shreiben", db);
  return toTaskResponse(next, index);
}

async function deleteTask(payload) {
  const context = normalizeContext(payload);
  const taskId = String(payload.taskId || "").trim();

  const db = await getDb();
  const levelEntry = ensureStructure(db, context.level, context.part);
  const index = parseTaskIndex(taskId, levelEntry.tasks.length);

  levelEntry.tasks.splice(index, 1);
  await writeJsonByKey("shreiben", db);
  return { deleted: true };
}

function parseImageDataUrl(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new AppError("imageDataUrl must be a valid base64 image data URL", 400);
  }

  const mimeType = match[1].toLowerCase();
  const base64 = match[2].replace(/\s+/g, "");
  const estimatedBytes = Math.floor((base64.length * 3) / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new AppError("Image is too large. Max size is 8 MB.", 400);
  }

  return {
    dataUrl: `data:${mimeType};base64,${base64}`
  };
}

function collectResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks = [];
  const output = Array.isArray(payload?.output) ? payload.output : [];
  output.forEach((item) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((entry) => {
      if (typeof entry?.text === "string" && entry.text.trim()) {
        chunks.push(entry.text.trim());
      }
    });
  });
  return chunks.join("\n").trim();
}

function parseJsonFromModelOutput(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new AppError("OpenAI returned an empty response", 502);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    // fallback handling below
  }

  const fencedMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```([\s\S]*?)```/);
  if (fencedMatch?.[1]) {
    try {
      return JSON.parse(fencedMatch[1].trim());
    } catch (error) {
      // continue
    }
  }

  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    try {
      return JSON.parse(objectMatch[0]);
    } catch (error) {
      // continue
    }
  }

  throw new AppError("OpenAI response was not valid JSON", 502);
}

function markdownFromUnknownValue(value) {
  if (typeof value === "string") {
    return normalizeMarkdown(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeMarkdown(entry))
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  if (value && typeof value === "object") {
    const directText = normalizeMarkdown(
      value.text
      ?? value.content
      ?? value.body
      ?? value.prompt
      ?? value.instruction
      ?? value.instructions
    );
    if (directText) {
      return directText;
    }

    return Object.values(value)
      .map((entry) => markdownFromUnknownValue(entry))
      .filter(Boolean)
      .join("\n\n")
      .trim();
  }

  return "";
}

function listMarkdownFromUnknownValue(value) {
  const text = markdownFromUnknownValue(value);
  if (!text) {
    return "";
  }

  if (/^[-*+]\s/m.test(text) || /^\d+[.)]\s/m.test(text)) {
    return text;
  }

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line.replace(/^[-*+]\s+/, "")}`)
    .join("\n");
}

function pickFirstMarkdown(values = []) {
  for (const value of values) {
    const text = markdownFromUnknownValue(value);
    if (text) {
      return text;
    }
  }
  return "";
}

function pickFirstListMarkdown(values = []) {
  for (const value of values) {
    const text = listMarkdownFromUnknownValue(value);
    if (text) {
      return text;
    }
  }
  return "";
}

function normalizeExtractedTask(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  let normalized = normalizeTaskShape(source, {}, 0);

  if (!normalized.istructions) {
    normalized.istructions = pickFirstMarkdown([
      source.istructions,
      source.instructions,
      source.instruction,
      source.prompt,
      source.assignment,
      source.aufgabe,
      source.task,
      source.brief
    ]);
  }

  if (!normalized.content) {
    normalized.content = pickFirstMarkdown([
      source.content,
      source.material,
      source.context,
      source.source,
      source.letter,
      source.text,
      source.body,
      source.ad,
      source.anzeige
    ]) || normalized.istructions;
  }

  if (!normalized.tasks) {
    normalized.tasks = pickFirstListMarkdown([
      source.tasks,
      source.requirements,
      source.points,
      source.leitpunkte,
      source.bullets,
      source.stichpunkte,
      source.criteria
    ]) || "- Bearbeiten Sie alle geforderten Punkte aus der Aufgabe.";
  }

  if (!normalized.title) {
    normalized.title = pickFirstMarkdown([
      source.title,
      source.heading,
      source.taskTitle,
      source.name
    ]) || extractTaskTitle(normalized, 0);
  }

  normalized = normalizeTaskShape(normalized, {}, 0);
  validateTaskText(normalized);

  return {
    title: normalized.title,
    istructions: normalized.istructions,
    content: normalized.content,
    tasks: normalized.tasks
  };
}

async function extractTaskFromImage(payload) {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new AppError("OPENAI_API_KEY is not configured on the server", 500);
  }

  const { dataUrl } = parseImageDataUrl(payload?.imageDataUrl);

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  if (process.env.OPENAI_ORG) {
    headers["OpenAI-Organization"] = process.env.OPENAI_ORG;
  }
  if (process.env.OPENAI_PROJECT) {
    headers["OpenAI-Project"] = process.env.OPENAI_PROJECT;
  }

  const extractionInstructions = [
    "Extract one German writing task from the image.",
    "Return JSON only with these keys: title, istructions, content, tasks.",
    "All values must be markdown strings (German text, preserve formatting as lists/headings).",
    "Never leave any key empty.",
    "title: short task title.",
    "istructions: what the learner must do.",
    "content: source block text (Anzeige/Brief/E-Mail/Notiz). If missing, use the main scenario text.",
    "tasks: required points/constraints as a markdown bullet list.",
    "No extra keys, no explanations, no markdown code fences."
  ].join(" ");

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      text: {
        format: {
          type: "json_object"
        }
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "You are a precise OCR to markdown extraction assistant."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: extractionInstructions
            },
            {
              type: "input_image",
              image_url: dataUrl
            }
          ]
        }
      ]
    })
  });

  const payloadJson = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payloadJson?.error?.message || "OpenAI request failed";
    throw new AppError(message, 502);
  }

  const outputText = collectResponseText(payloadJson);
  const parsed = parseJsonFromModelOutput(outputText);
  return normalizeExtractedTask(parsed);
}

module.exports = {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  extractTaskFromImage
};
