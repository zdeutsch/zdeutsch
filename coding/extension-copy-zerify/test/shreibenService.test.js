const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createRequire } = require("node:module");

function isolatedService(initialDb) {
  let storedDb = structuredClone(initialDb);
  const filename = require.resolve("../server/services/shreibenService");
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module,
    process,
    require(id) {
      if (id === "../repositories/jsonRepository") {
        return {
          readJsonByKey: async () => structuredClone(storedDb),
          writeJsonByKey: async (_key, db) => { storedDb = structuredClone(db); }
        };
      }
      return localRequire(id);
    }
  }, { filename });
  return { service: module.exports, readStored: () => structuredClone(storedDb) };
}

const addedAt = "2026-10-09T15:57:45.685Z";
const task = { title: "Laura", istructions: "Antworten Sie.", content: "Liebe/r ...", tasks: "- Treffen?", addedAt };

test("editing Schreiben preserves the original addition date, including other normalized tasks", async () => {
  const { service, readStored } = isolatedService({ levels: { b1: { tasks: [task, { ...task, title: "Second" }] } } });
  await service.updateTask({ level: "b1", taskId: "task-1", title: "Laura revised", addedAt: "2099-01-01T00:00:00Z" });
  const saved = readStored().levels.b1.tasks;
  assert.equal(saved[0].title, "Laura revised");
  assert.equal(saved[0].addedAt, addedAt);
  assert.equal(saved[1].addedAt, addedAt);
});

test("adding a task keeps existing dates without backdating undated legacy tasks", async () => {
  const { addedAt: _date, ...undated } = task;
  const { service, readStored } = isolatedService({ levels: { b1: { tasks: [task, undated] } } });
  await service.createTask({ ...task, level: "b1", title: "New task" });
  const saved = readStored().levels.b1.tasks;
  assert.equal(saved[0].addedAt, addedAt);
  assert.equal(Object.hasOwn(saved[1], "addedAt"), false);
  assert.equal(saved[2].addedAt, addedAt);
});
