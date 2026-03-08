const AppError = require("./appError");

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function assertPlainObject(value, message = "Body must be a JSON object") {
  if (!isPlainObject(value)) {
    throw new AppError(message, 400);
  }
}

function assertString(value, message = "Expected a non-empty string") {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(message, 400);
  }
}

function assertArray(value, message = "Expected an array") {
  if (!Array.isArray(value)) {
    throw new AppError(message, 400);
  }
}

function parseLinesToArray(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return fallback;
}

module.exports = {
  isPlainObject,
  assertPlainObject,
  assertString,
  assertArray,
  parseLinesToArray,
  normalizeBoolean
};
