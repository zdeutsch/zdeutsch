const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID, createHash } = require("node:crypto");
const { DATABASE_DIR } = require("../config/constants");
const AppError = require("../utils/appError");
const files = Object.freeze({ additions: "exercise-additions.b2.json", names: "exercise-names.b2.json" });
const revision = raw => createHash("sha256").update(raw).digest("hex");

function createSidecarRepository(directory = DATABASE_DIR) {
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
module.exports = { ...createSidecarRepository(), createSidecarRepository };
