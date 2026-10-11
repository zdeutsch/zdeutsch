const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { DATABASE_DIR } = require("../config/constants");
const AppError = require("../utils/appError");
const revision = raw => createHash("sha256").update(raw).digest("hex");

function createSidecarRepository(directory = DATABASE_DIR, level = "b2") {
  if (!["b1", "b2"].includes(level)) throw new AppError("Unsupported catalogue level", 400);
  const files = Object.freeze({ additions: `exercise-additions.${level}.json`, names: `exercise-names.${level}.json` });
  const queues = new Map();
  function file(key) {
    if (!Object.hasOwn(files, key)) throw new AppError("Unknown additional-content file", 400);
    return path.join(directory, files[key]);
  }
  async function read(key) {
    const raw = await fs.readFile(file(key), "utf8");
    return { data: JSON.parse(raw), revision: revision(raw) };
  }
  async function mutate(key, expectedRevision, update) {
    file(key);
    if (!expectedRevision) throw new AppError("Reload this content before saving.", 409);
    const task = (queues.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
      const current = await read(key);
      if (current.revision !== expectedRevision) throw new AppError("This content was changed after you opened it. Reload before saving.", 409, { code: "STALE_DATA" });
      const data = await update(current.data);
      const raw = JSON.stringify(data, null, 2) + "\n";
      const temporary = `${file(key)}.${process.pid}.${randomUUID()}.tmp`;
      try { await fs.writeFile(temporary, raw); await fs.rename(temporary, file(key)); }
      finally { await fs.unlink(temporary).catch(() => {}); }
      return { data, revision: revision(raw) };
    });
    queues.set(key, task);
    task.finally(() => { if (queues.get(key) === task) queues.delete(key); }).catch(() => {});
    return task;
  }
  return { read, mutate };
}
const repositories = new Map();
function forLevel(level = "b2") {
  if (!repositories.has(level)) repositories.set(level, createSidecarRepository(DATABASE_DIR, level));
  return repositories.get(level);
}
module.exports = { ...forLevel(), createSidecarRepository, forLevel };
