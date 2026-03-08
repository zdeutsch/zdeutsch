const fs = require("fs/promises");
const path = require("path");
const { DATABASE_DIR, DATABASE_FILES, ALLOWED_FILE_KEYS } = require("../config/constants");
const AppError = require("../utils/appError");

function assertValidFileKey(fileKey) {
  if (!ALLOWED_FILE_KEYS.includes(fileKey)) {
    throw new AppError(
      `Invalid file key. Allowed: ${ALLOWED_FILE_KEYS.join(", ")}`,
      400
    );
  }
}

function resolveFilePath(fileKey) {
  assertValidFileKey(fileKey);
  return path.join(DATABASE_DIR, DATABASE_FILES[fileKey]);
}

async function readJsonByKey(fileKey) {
  const filePath = resolveFilePath(fileKey);
  const raw = await fs.readFile(filePath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new AppError(`Invalid JSON in ${DATABASE_FILES[fileKey]}`, 500);
  }
}

async function writeJsonByKey(fileKey, data) {
  const filePath = resolveFilePath(fileKey);
  const serialized = `${JSON.stringify(data, null, 2)}\n`;

  // write to temp file first, then rename for atomic updates
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, serialized, "utf-8");
  await fs.rename(tempPath, filePath);

  return {
    fileKey,
    fileName: DATABASE_FILES[fileKey],
    filePath
  };
}

async function listDatabaseFiles() {
  const entries = await Promise.all(
    ALLOWED_FILE_KEYS.map(async (fileKey) => {
      const filePath = resolveFilePath(fileKey);
      const stat = await fs.stat(filePath);
      return {
        fileKey,
        fileName: DATABASE_FILES[fileKey],
        filePath,
        sizeBytes: stat.size,
        updatedAt: stat.mtime.toISOString()
      };
    })
  );

  return entries;
}

module.exports = {
  resolveFilePath,
  readJsonByKey,
  writeJsonByKey,
  listDatabaseFiles,
  ALLOWED_FILE_KEYS
};
