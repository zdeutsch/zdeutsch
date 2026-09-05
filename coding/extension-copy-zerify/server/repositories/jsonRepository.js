const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");
const { DATABASE_DIR, DATABASE_FILES, ALLOWED_FILE_KEYS } = require("../config/constants");
const AppError = require("../utils/appError");

const snapshotCache = new Map();
const mutationQueues = new Map();

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

function parseJson(raw, fileKey) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new AppError(`Invalid JSON in ${DATABASE_FILES[fileKey]}`, 500);
  }
}

function revisionFromStat(stat) {
  return `${Math.trunc(stat.mtimeMs).toString(36)}-${Number(stat.size).toString(36)}`;
}

async function readJsonByKey(fileKey) {
  const filePath = resolveFilePath(fileKey);
  const raw = await fs.readFile(filePath, "utf-8");
  return parseJson(raw, fileKey);
}

async function readJsonSnapshotByKey(fileKey) {
  const filePath = resolveFilePath(fileKey);
  const stat = await fs.stat(filePath);
  const revision = revisionFromStat(stat);
  const cached = snapshotCache.get(fileKey);

  if (cached?.revision === revision) {
    return { data: cached.data, revision };
  }

  const raw = await fs.readFile(filePath, "utf-8");
  const data = parseJson(raw, fileKey);
  snapshotCache.set(fileKey, { data, revision });
  return { data, revision };
}

async function writeJsonFile(fileKey, data) {
  const filePath = resolveFilePath(fileKey);
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

  try {
    await fs.writeFile(tempPath, serialized, "utf-8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }

  snapshotCache.delete(fileKey);
  const stat = await fs.stat(filePath);

  return {
    fileKey,
    fileName: DATABASE_FILES[fileKey],
    filePath,
    revision: revisionFromStat(stat)
  };
}

function enqueueMutation(fileKey, operation) {
  const previous = mutationQueues.get(fileKey) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  mutationQueues.set(fileKey, current);
  current.finally(() => {
    if (mutationQueues.get(fileKey) === current) {
      mutationQueues.delete(fileKey);
    }
  }).catch(() => {});
  return current;
}

async function writeJsonByKey(fileKey, data) {
  return enqueueMutation(fileKey, () => writeJsonFile(fileKey, data));
}

async function mutateJsonByKey(fileKey, updater, options = {}) {
  if (typeof updater !== "function") {
    throw new TypeError("updater must be a function");
  }

  return enqueueMutation(fileKey, async () => {
    const filePath = resolveFilePath(fileKey);
    const stat = await fs.stat(filePath);
    const currentRevision = revisionFromStat(stat);
    const expectedRevision = String(options.expectedRevision || "").trim();

    if (expectedRevision && expectedRevision !== currentRevision) {
      throw new AppError(
        "This content was changed after you opened it. Reload before saving.",
        409,
        { code: "STALE_DATA", expectedRevision, currentRevision }
      );
    }

    const data = await readJsonByKey(fileKey);
    const outcome = await updater(data);
    const nextData = outcome?.data ?? data;
    const file = await writeJsonFile(fileKey, nextData);

    return {
      data: nextData,
      result: outcome?.result,
      file,
      revision: file.revision
    };
  });
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
  readJsonSnapshotByKey,
  writeJsonByKey,
  mutateJsonByKey,
  listDatabaseFiles,
  ALLOWED_FILE_KEYS
};
