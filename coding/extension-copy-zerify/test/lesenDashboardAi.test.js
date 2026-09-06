const test = require("node:test");
const assert = require("node:assert/strict");

test("builds correction candidates for all five Lesen parts", async () => {
  const { buildCorrectionCandidates } = await import("../dashboard-react/src/utils/lesenAi.mjs");

  assert.deepEqual(buildCorrectionCandidates("teil-1", { answers: [{ textId: 1, headlineId: "B" }] }), [{ itemNumber: "1", answer: "B" }]);
  assert.deepEqual(buildCorrectionCandidates("teil-2", { questions: [{ id: 6, answerId: "a" }] }), [{ itemNumber: "6", answer: "a" }]);
  assert.deepEqual(buildCorrectionCandidates("teil-3", { answers: [{ situationId: 11, adId: "X" }] }), [{ itemNumber: "11", answer: "X" }]);
  assert.deepEqual(buildCorrectionCandidates("sprachbausteine-1", { answers: [{ id: 21, answer: "Sie" }] }), [{ itemNumber: "21", answer: "Sie" }]);
  assert.deepEqual(buildCorrectionCandidates("sprachbausteine-2", { answers: [{ id: 31, answer: "ALS" }] }), [{ itemNumber: "31", answer: "ALS" }]);
});

test("persists one shared AI model preference for Lesen and contributions", async () => {
  const { AI_MODEL_STORAGE_KEY, getStoredAiModel, storeAiModel } = await import("../dashboard-react/src/utils/aiModels.mjs");
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  };

  storeAiModel("gpt-5.6-sol", storage);
  assert.equal(values.get(AI_MODEL_STORAGE_KEY), "gpt-5.6-sol");
  assert.equal(getStoredAiModel(storage), "gpt-5.6-sol");
});
