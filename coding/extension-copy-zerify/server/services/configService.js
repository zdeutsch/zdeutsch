const { readJsonByKey, writeJsonByKey } = require("../repositories/jsonRepository");
const { assertPlainObject, assertArray, assertString } = require("../utils/validators");
const AppError = require("../utils/appError");

function normalizeModule(module, index) {
  assertPlainObject(module, `Module at index ${index} must be an object`);
  assertString(module.name, `Module at index ${index} needs a valid name`);
  assertString(module.dataFile, `Module ${module.name} needs a valid dataFile`);

  const timer = {
    enabled: Boolean(module.timer?.enabled),
    durationMinutes: Number.isFinite(module.timer?.durationMinutes)
      ? Number(module.timer.durationMinutes)
      : 0
  };

  const passPercentRaw = module.scoreConfig?.passPercent;
  const passPercent = Number.isFinite(passPercentRaw)
    ? Math.max(0, Math.min(100, Number(passPercentRaw)))
    : 60;

  const scoreParts = module.scoreConfig?.parts && typeof module.scoreConfig.parts === "object"
    ? module.scoreConfig.parts
    : {};

  return {
    name: module.name.trim(),
    dataFile: module.dataFile.trim(),
    timer,
    scoreConfig: {
      passPercent,
      parts: scoreParts
    }
  };
}

async function getConfig() {
  return readJsonByKey("config");
}

async function updateConfig(payload) {
  assertPlainObject(payload);
  const current = await getConfig();
  const next = {
    ...current,
    ...payload
  };

  if (payload.modules !== undefined) {
    assertArray(payload.modules, "modules must be an array");
    next.modules = payload.modules.map(normalizeModule);
  }

  if (!Array.isArray(next.modules) || !next.modules.length) {
    throw new AppError("Config must include at least one module", 400);
  }

  if (payload.defaultModule !== undefined) {
    assertString(payload.defaultModule, "defaultModule must be a non-empty string");
    next.defaultModule = payload.defaultModule.trim();
  }

  const moduleNames = new Set(next.modules.map((module) => module.name));
  if (!moduleNames.has(next.defaultModule)) {
    throw new AppError("defaultModule must exist in modules list", 400);
  }

  if (payload.fontScale !== undefined) {
    const value = Number(payload.fontScale);
    if (!Number.isFinite(value) || value <= 0) {
      throw new AppError("fontScale must be a positive number", 400);
    }
    next.fontScale = value;
  }

  if (payload.asideWidth !== undefined) {
    next.asideWidth = String(payload.asideWidth).trim();
  }

  await writeJsonByKey("config", next);
  return next;
}

module.exports = {
  getConfig,
  updateConfig
};
