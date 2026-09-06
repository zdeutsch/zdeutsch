const {
  readJsonSnapshotByKey,
  mutateJsonByKey
} = require("../repositories/jsonRepository");
const AppError = require("../utils/appError");
const { isPlainObject } = require("../utils/validators");

const SPRECHEN_PART_ORDER = ["teil-1", "teil-2", "teil-3"];
const SPRECHEN_LEVEL_ORDER = ["b1", "b2"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function summarizePart(partKey, part, visible = true) {
  const topics = Array.isArray(part?.topics) ? part.topics.length : 0;
  const prompts = Array.isArray(part?.prompts) ? part.prompts.length : 0;
  const followUps = Array.isArray(part?.followUps) ? part.followUps.length : 0;
  return {
    key: partKey,
    title: part?.title || partKey,
    shortTitle: part?.shortTitle || "",
    durationMinutes: Number(part?.durationMinutes || 0),
    itemCount: topics || prompts + followUps,
    available: Boolean(part),
    visible: Boolean(part) && visible
  };
}

function createEmptySprechenLevel(level) {
  const upperLevel = String(level || "").toUpperCase();
  return {
    title: `TELC ${upperLevel} Mündliche Prüfung`,
    sourceUrl: "",
    partOrder: [...SPRECHEN_PART_ORDER],
    parts: {
      "teil-1": {
        title: "Einander kennenlernen",
        shortTitle: "Vorstellen",
        durationMinutes: 3,
        sourceUrl: "",
        instruction: "Stellen Sie sich vor und stellen Sie Ihrem Gegenüber passende Rückfragen.",
        prompts: [],
        followUps: []
      },
      "teil-2": {
        title: "Über ein Thema sprechen",
        shortTitle: "Diskutieren",
        durationMinutes: 6,
        sourceUrl: "",
        instruction: "Geben Sie die Positionen mit eigenen Worten wieder, äußern Sie Ihre Meinung und reagieren Sie auf Ihr Gegenüber.",
        topics: []
      },
      "teil-3": {
        title: "Gemeinsam etwas planen",
        shortTitle: "Planen",
        durationMinutes: 6,
        sourceUrl: "",
        instruction: "Planen Sie die Aufgabe gemeinsam und einigen Sie sich auf die wichtigsten Punkte.",
        topics: []
      }
    }
  };
}

async function getSprechenContext(payload = {}) {
  const { data: db, revision } = await readJsonSnapshotByKey("sprechen");
  const availableLevels = Object.keys(db?.levels || {});
  const requestedLevel = String(payload.level || "").trim().toLowerCase();
  const level = SPRECHEN_LEVEL_ORDER.includes(requestedLevel)
    ? requestedLevel
    : (availableLevels[0] || SPRECHEN_LEVEL_ORDER[0]);
  const levelEntry = db?.levels?.[level];
  if (!levelEntry) {
    return {
      revision,
      levels: availableLevels,
      levelOptions: SPRECHEN_LEVEL_ORDER.map((key) => ({ key, available: availableLevels.includes(key) })),
      level,
      levelAvailable: false,
      levelTitle: `TELC ${level.toUpperCase()} Mündliche Prüfung`,
      partKey: String(payload.partKey || SPRECHEN_PART_ORDER[0]),
      parts: [],
      part: null
    };
  }

  const availableParts = Object.keys(levelEntry.parts || {});
  const allParts = [
    ...SPRECHEN_PART_ORDER.filter((key) => availableParts.includes(key)),
    ...availableParts.filter((key) => !SPRECHEN_PART_ORDER.includes(key))
  ];
  const orderedParts = Array.isArray(levelEntry.partOrder)
    ? levelEntry.partOrder.filter((key) => availableParts.includes(key))
    : allParts;
  const requestedPart = String(payload.partKey || "").trim().toLowerCase();
  const partKey = allParts.includes(requestedPart) ? requestedPart : (orderedParts[0] || allParts[0] || "");
  const part = levelEntry.parts?.[partKey];
  if (!part) {
    throw new AppError("Prüfungsteil nicht gefunden", 404);
  }

  return {
    revision,
    levels: availableLevels,
    levelOptions: SPRECHEN_LEVEL_ORDER.map((key) => ({ key, available: availableLevels.includes(key) })),
    level,
    levelAvailable: true,
    levelTitle: levelEntry.title || level.toUpperCase(),
    partKey,
    parts: allParts.map((key) => summarizePart(key, levelEntry.parts?.[key], orderedParts.includes(key))),
    part: clone(part)
  };
}

async function createSprechenLevel(payload = {}) {
  const level = String(payload.level || "").trim().toLowerCase();
  if (!SPRECHEN_LEVEL_ORDER.includes(level)) {
    throw new AppError(`Niveau muss einer dieser Werte sein: ${SPRECHEN_LEVEL_ORDER.join(", ")}`, 400);
  }
  const mutation = await mutateJsonByKey("sprechen", (db) => {
    db.levels = db.levels || {};
    if (db.levels[level]) throw new AppError("Dieses Niveau ist bereits vorhanden", 409);
    db.levels[level] = createEmptySprechenLevel(level);
    return { data: db, result: { level, levelEntry: clone(db.levels[level]) } };
  }, { expectedRevision: payload.revision });
  return { ...mutation.result, revision: mutation.revision };
}

async function setSprechenPartVisibility(payload = {}) {
  const level = String(payload.level || "").trim().toLowerCase();
  const partKey = String(payload.partKey || "").trim().toLowerCase();
  if (!level || !partKey) throw new AppError("Niveau und Prüfungsteil sind erforderlich", 400);
  if (typeof payload.visible !== "boolean") throw new AppError("visible muss ein Wahrheitswert sein", 400);

  const mutation = await mutateJsonByKey("sprechen", (db) => {
    const levelEntry = db?.levels?.[level];
    if (!levelEntry?.parts?.[partKey]) throw new AppError("Prüfungsteil nicht gefunden", 404);
    const available = Object.keys(levelEntry.parts);
    const current = Array.isArray(levelEntry.partOrder)
      ? levelEntry.partOrder.filter((key) => available.includes(key))
      : available;
    levelEntry.partOrder = payload.visible
      ? (current.includes(partKey) ? current : [...current, partKey])
      : current.filter((key) => key !== partKey);
    return { data: db, result: { level, partKey, visible: payload.visible } };
  }, { expectedRevision: payload.revision });

  return { ...mutation.result, revision: mutation.revision };
}

async function updateSprechenPart(payload = {}) {
  const level = String(payload.level || "").trim().toLowerCase();
  const partKey = String(payload.partKey || "").trim().toLowerCase();
  if (!level || !partKey) {
    throw new AppError("Niveau und Prüfungsteil sind erforderlich", 400);
  }
  if (!isPlainObject(payload.part)) {
    throw new AppError("Prüfungsteil muss ein Objekt sein", 400);
  }

  const mutation = await mutateJsonByKey("sprechen", (db) => {
    const current = db?.levels?.[level]?.parts?.[partKey];
    if (!current) {
      throw new AppError("Prüfungsteil nicht gefunden", 404);
    }
    const next = {
      ...current,
      ...clone(payload.part)
    };
    db.levels[level].parts[partKey] = next;
    return { data: db, result: { level, partKey, part: clone(next) } };
  }, { expectedRevision: payload.revision });

  return {
    ...mutation.result,
    revision: mutation.revision
  };
}

module.exports = {
  SPRECHEN_LEVEL_ORDER,
  SPRECHEN_PART_ORDER,
  createEmptySprechenLevel,
  createSprechenLevel,
  getSprechenContext,
  updateSprechenPart,
  setSprechenPartVisibility,
  summarizePart
};
