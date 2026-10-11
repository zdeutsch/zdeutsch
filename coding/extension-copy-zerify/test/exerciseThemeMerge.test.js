const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const C = require("../site/exercise-catalog");
const { mergeDocuments, mergeThemen } = require("../scripts/merge-b2-themen.cjs");

function fixture() {
  const grammar = { id: "legacy:fixture:g", title: "C", level: "b2", module: "lesen", partKey: "sprachbausteine-1", names: ["C"], enabled: true,
    provenance: { quizId: "fixture_g", sourceFingerprint: "a".repeat(64), url: "https://example.test/g" }, review: { answerStatus: "unverified", note: "" },
    payload: { instruction: "Choose", text: Array.from({ length: 10 }, (_, i) => `Text [[${i + 21}]]`).join(" "), blanks: Array.from({ length: 10 }, (_, i) => ({ id: i + 21, sourceQuestionId: i + 1, options: ["a", "b", "c"] })), answers: Array.from({ length: 10 }, (_, i) => ({ id: i + 21, answer: "b" })) } };
  const variant = { ...structuredClone(grammar), id: "legacy:fixture:v", title: "Different letter", provenance: { ...grammar.provenance, quizId: "fixture_v" }, relatedCurrentLocation: "lesen.json#/levels/b2/themes/a/versions/default/lesen/parts/sprachbausteine-1" };
  const hearing = { ...structuredClone(grammar), id: "legacy:fixture:h", title: "New hearing set", module: "horen", partKey: "teil-3", provenance: { ...grammar.provenance, quizId: "fixture_h" }, payload: { instruction: "Listen", statements: Array.from({ length: 5 }, (_, i) => ({ id: `new-${i}`, number: 56 + i, sourceQuestionId: i + 1, text: `Statement ${i}`, correct: i % 2 === 0 })) } };
  const writing = { ...structuredClone(grammar), id: "legacy:fixture:w", title: "New writing task", module: "shreiben", partKey: "teil-1", provenance: { ...grammar.provenance, quizId: "fixture_w" }, payload: { istructions: "Write", content: "Advertisement", tasks: "Complain", minimumWords: 150 } };
  const originalPart = { meta: { title: "A" }, content: { ...structuredClone(grammar.payload), title: "Original corrected exercise" } };
  const db = {
    "lesen.json": { levels: { b1: { untouched: true }, b2: { themeOrder: ["a"], themes: { a: { id: "a", title: "A", defaultVersion: "default", versionOrder: ["default"], versions: { default: { key: "default", lesen: { partOrder: ["sprachbausteine-1"], parts: { "sprachbausteine-1": originalPart } } } } } } } } },
    "horen-codes.json": { levels: { b2: { themeOrder: ["horen-b2"], themes: { "horen-b2": { title: "Existing codes", "hören": { partOrder: ["teil-3"], parts: { "teil-3": { content: { topics: [{ id: "original", title: "Original", statements: [{ id: "original-1", text: "Corrected statement", number: 1, correct: false }] }] } } } } } } } } },
    "shreiben.json": { levels: { b2: { tasks: [{ title: "Original draft task", istructions: "Old", content: "Old ad", tasks: "Old points" }] } } }
  };
  return { db, additions: { schemaVersion: 1, exercises: [grammar, variant, hearing, writing] } };
}
test("merge preserves original records, defaults and indexes; variants never replace corrected content", () => {
  const { db, additions } = fixture(), before = structuredClone(db);
  const result = mergeDocuments(db, additions);
  assert.deepEqual(db, before, "planning the merge must not mutate the source objects");
  const reading = result.databases["lesen.json"].levels;
  assert.deepEqual(reading.b1, before["lesen.json"].levels.b1);
  assert.deepEqual(reading.b2.themes.a.versions.default, before["lesen.json"].levels.b2.themes.a.versions.default);
  assert.equal(reading.b2.themes.a.defaultVersion, "default");
  assert.deepEqual(reading.b2.themes.a.versionOrder, ["default", "telc-fixture-v"]);
  assert.deepEqual(reading.b2.themes["telc-fixture-g"].versions.default.lesen.partOrder, ["sprachbausteine-1"]);
  assert.deepEqual(result.databases["horen-codes.json"].levels.b2.themes["horen-b2"]["hören"].parts["teil-3"].content.topics[0], before["horen-codes.json"].levels.b2.themes["horen-b2"]["hören"].parts["teil-3"].content.topics[0]);
  assert.deepEqual(result.databases["shreiben.json"].levels.b2.tasks[0], before["shreiben.json"].levels.b2.tasks[0]);
  assert.equal(result.additions.exercises.length, 0);
  assert.equal(C.mergedExercises(result.databases).length, 4);
  for (const original of additions.exercises) {
    const actual = C.mergedExercises(result.databases).find(item => item.id === original.id);
    assert.deepEqual(actual.payload, original.payload);
    assert.equal(actual.review.answerStatus, "unverified");
    assert.deepEqual(actual.provenance, original.provenance);
  }
});
test("merged names search their native destinations and disabled imports stay unavailable", () => {
  const { db, additions } = fixture(); const result = mergeDocuments(db, additions);
  const entry = C.searchNames(C.combinedNames(result.databases, { entries: [] }), { query: "C", module: "lesen" }).find(entry => entry.record.legacyImport);
  assert.ok(entry);
  assert.match(entry.url, /^lesen.html/);
  entry.record.legacyImport.enabled = false;
  assert.equal(C.mergedExercises(result.databases).length, 3);
  assert.equal(C.mergedExercises(result.databases, { includeHidden: true }).length, 4);
});
test("a real merge backs up exact bytes and a repeat merge writes nothing", async t => {
  const { db, additions } = fixture();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zdeutsch-theme-merge-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const databaseDir = path.join(root, "db"), backupDir = path.join(root, "backup"); await fs.mkdir(databaseDir);
  const originals = { ...db, "exercise-additions.b2.json": additions };
  for (const [file, data] of Object.entries(originals)) await fs.writeFile(path.join(databaseDir, file), JSON.stringify(data));
  assert.equal((await mergeThemen({ databaseDir, backupDir })).merged, 4);
  const first = await Promise.all(Object.keys(originals).map(file => fs.readFile(path.join(databaseDir, file), "utf8")));
  for (const [file, data] of Object.entries(originals)) assert.equal(await fs.readFile(path.join(backupDir, file), "utf8"), JSON.stringify(data));
  assert.equal((await mergeThemen({ databaseDir, backupDir })).merged, 0);
  assert.deepEqual(await Promise.all(Object.keys(originals).map(file => fs.readFile(path.join(databaseDir, file), "utf8"))), first);
});
