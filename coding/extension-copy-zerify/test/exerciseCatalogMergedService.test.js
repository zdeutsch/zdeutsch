const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const C = require("../site/exercise-catalog");

function isolatedService() {
  const files = { "lesen.json": "lesen", "horen-codes.json": "horen", "shreiben.json": "shreiben" };
  const stored = Object.fromEntries(Object.entries(files).map(([file, key]) => [key, JSON.parse(fs.readFileSync(require.resolve(`../site/database/${file}`), "utf8"))]));
  const revisions = Object.fromEntries(Object.values(files).map(key => [key, 1]));
  const filename = require.resolve("../server/services/exerciseCatalogService"), localRequire = createRequire(filename), module = { exports: {} };
  const writes = [];
  const repo = {
    readJsonSnapshotByKey: async key => ({ data: structuredClone(stored[key]), revision: String(revisions[key]) }),
    mutateJsonByKey: async (key, updater, options) => {
      assert.equal(options.expectedRevision, String(revisions[key]));
      const outcome = await updater(structuredClone(stored[key]));
      stored[key] = structuredClone(outcome.data);
      revisions[key]++; writes.push(key);
      return { data: structuredClone(stored[key]), revision: String(revisions[key]) };
    }
  };
  const localFs = { ...require("node:fs/promises"), readFile: async file => {
    const key = files[require("node:path").basename(file)];
    return key ? JSON.stringify(stored[key]) : require("node:fs/promises").readFile(file, "utf8");
  } };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), { module, process, require(id) {
    if (id === "node:fs/promises") return localFs;
    if (id === "../repositories/jsonRepository") return repo;
    if (id === "../repositories/exerciseSidecarRepository") return { read: async kind => ({ data: kind === "additions" ? { exercises: [] } : { entries: [] }, revision: "sidecar" }), mutate: async () => { throw new Error("Merged content must not be written to a sidecar"); } };
    return localRequire(id);
  } }, { filename });
  const read = () => structuredClone(stored);
  return { service: module.exports, read, writes };
}

test("manager saves each imported module at its native destination without changing other records", async () => {
  const { service, read, writes } = isolatedService();
  const listed = await service.list();
  assert.equal(listed.additions.length, 31);
  assert.match(listed.additionsRevision, /^merged:/);
  for (const moduleName of ["lesen", "horen", "shreiben"]) {
    const before = read(), fresh = await service.list(), item = fresh.additions.find(item => item.module === moduleName);
    const saved = await service.updateExercise(item.id, { revision: fresh.additionsRevision, patch: { names: [...item.names, "Manager alias"] } });
    const after = read(), key = { lesen: "lesen", horen: "horen", shreiben: "shreiben" }[moduleName];
    const resolved = C.resolveTarget({ [item.target.file]: after[key] }, item.target);
    assert.ok(resolved.record.legacyImport.names.includes("Manager alias"));
    // Removing exactly the new alias must recreate every original database byte for byte as objects.
    resolved.record.legacyImport.names.pop();
    assert.deepEqual(after, before);
    assert.notEqual(saved.revision, fresh.additionsRevision);
  }
  assert.deepEqual(writes, ["lesen", "horen", "shreiben"]);
});

test("native manager edits reject stale revisions and changed source question identities", async () => {
  const { service, read, writes } = isolatedService();
  const initial = await service.list(), grammar = initial.additions.find(item => item.module === "lesen");
  await service.updateExercise(grammar.id, { revision: initial.additionsRevision, patch: { enabled: false } });
  const before = read();
  await assert.rejects(service.updateExercise(grammar.id, { revision: initial.additionsRevision, patch: { enabled: true } }), error => error.statusCode === 409);
  const fresh = await service.list(), payload = structuredClone(grammar.payload);
  payload.blanks[0].sourceQuestionId = "different-source-question";
  await assert.rejects(service.updateExercise(grammar.id, { revision: fresh.additionsRevision, patch: { payload } }), /Original question identities/);
  assert.deepEqual(read(), before);
  assert.equal(writes.length, 1);
});

test("changing a merged exercise body removes its previous answer approval", async () => {
  const { service, read } = isolatedService();
  const initial = await service.list(), hearing = initial.additions.find(item => item.module === "horen");
  await service.updateExercise(hearing.id, { revision: initial.additionsRevision, patch: { review: { answerStatus: "verified", note: "Checked against the source" } } });
  const fresh = await service.list(), payload = structuredClone(hearing.payload);
  payload.statements[0].text += " Revised wording.";
  await service.updateExercise(hearing.id, { revision: fresh.additionsRevision, patch: { payload } });
  const record = C.resolveTarget({ "horen-codes.json": read().horen }, hearing.target).record;
  assert.equal(record.legacyImport.review.answerStatus, "unverified");
  assert.equal(record.legacyImport.review.note, "");
  assert.equal(record.statements[0].sourceQuestionId, hearing.payload.statements[0].sourceQuestionId);
});
