const test = require("node:test");
const assert = require("node:assert/strict");
const imports = require("../site/lesen-import-state");
const C = require("../site/exercise-catalog");
const db = require("../site/database/lesen.json");
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}
const content = { legacyImport: { id: "legacy:telc:b2_g1_37", review: { answerStatus: "unverified" } } };

test("native Lesen keeps the same saved answers, draft and metadata as old exercise links", () => {
  const store = storage(), key = imports.storageKey(content);
  store.setItem(key, JSON.stringify({ responses: { 21: "dich", 22: "könnte" }, draft: "Saved draft", custom: { retained: true } }));
  const responses = imports.readResponses(content, store);
  assert.deepEqual(responses, { 21: "dich", 22: "könnte" });
  responses[23] = "von";
  assert.equal(imports.saveResponses(content, responses, store), true);
  assert.deepEqual(JSON.parse(store.getItem(key)), { responses: { 21: "dich", 22: "könnte", 23: "von" }, draft: "Saved draft", custom: { retained: true } });
  assert.deepEqual(imports.readResponses(content, store), responses);
  imports.saveResponses(content, {}, store);
  assert.deepEqual(imports.readResponses(content, store), {});
  assert.equal(JSON.parse(store.getItem(key)).draft, "Saved draft");
});

test("original exercises never read or write imported storage; corrupt or unavailable storage is handled", () => {
  const inaccessible = { getItem() { throw new Error("Unavailable"); }, setItem() { throw new Error("Unavailable"); } };
  assert.equal(imports.storageKey({}), null);
  assert.deepEqual(imports.readResponses({}, inaccessible), {});
  assert.equal(imports.saveResponses({}, {}, inaccessible), true);
  assert.deepEqual(imports.readResponses(content, inaccessible), {});
  assert.equal(imports.saveResponses(content, {}, inaccessible), false);
  const store = storage();
  for (const raw of ["{bad", "null", "[]", '{"responses":[]}', '{"responses":"bad"}']) {
    store.setItem(imports.storageKey(content), raw);
    assert.deepEqual(imports.readResponses(content, store), {});
  }
});

test("native records expose only their real parts, with original defaults and review state preserved", () => {
  const exercises = C.mergedExercises({ "lesen.json": db }, { levels: ["b2"] });
  assert.equal(exercises.length, 6);
  for (const item of exercises) {
    const theme = db.levels.b2.themes[item.target.themeKey], version = theme.versions[item.target.versionKey];
    assert.deepEqual(version.lesen.partOrder, ["sprachbausteine-1"]);
    assert.deepEqual(Object.keys(version.lesen.parts), ["sprachbausteine-1"]);
    assert.match(C.targetUrl(item.target), /^lesen.html\?/);
    assert.equal(imports.canScore(version.lesen.parts["sprachbausteine-1"].content), true);
    if (item.target.versionKey !== "default") assert.equal(theme.defaultVersion, "default");
  }
  assert.equal(imports.canScore(db.levels.b2.themes["keine-zeit"].versions.default.lesen.parts["sprachbausteine-1"].content), true);
  assert.equal(imports.canScore({ legacyImport: { review: { answerStatus: "verified" } } }), false);
  assert.equal(imports.canScore({ legacyImport: {} }), false);
});

test("source keys are usable normally; missing, duplicate and invalid grammar answers are not graded", () => {
  const item = C.mergedExercises({ "lesen.json": db }).find(item => item.id === content.legacyImport.id);
  assert.equal(item.review.answerStatus, "unverified", "Using a source key must not falsely mark it independently verified");
  assert.equal(C.hasAnswerKey(item), true);
  const missing = structuredClone(item);
  missing.payload.answers.pop();
  assert.equal(C.hasAnswerKey(missing), false);
  const duplicate = structuredClone(item);
  duplicate.payload.answers.push(duplicate.payload.answers[0]);
  assert.equal(C.hasAnswerKey(duplicate), false);
  const invalid = structuredClone(item);
  invalid.payload.answers[0].answer = "not an option";
  assert.equal(C.hasAnswerKey(invalid), false);
  const corrected = structuredClone(item);
  corrected.payload.answers[0].answer = "dir";
  assert.equal(C.hasAnswerKey(corrected), true);
  const record = C.applyMergedExercise({}, corrected);
  assert.equal(imports.canScore(record), true);
  assert.equal(C.mergedExercise({ record, module: "lesen", target: item.target }).payload.answers[0].answer, "dir", "The current key wins over the originally imported dich");
});

test("a false listening answer is a valid key and a missing listening answer is not", () => {
  assert.equal(C.hasAnswerKey({ module: "horen", payload: { statements: [{ correct: false }] } }), true);
  assert.equal(C.hasAnswerKey({ module: "horen", payload: { statements: [{ correct: undefined }] } }), false);
  assert.equal(C.hasAnswerKey({ module: "horen", payload: { statements: [] } }), false);
});
