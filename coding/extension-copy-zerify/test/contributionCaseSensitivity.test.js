const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeContributionValue,
  buildAllowedValuesByItem,
  buildComparisonRows,
  buildCurrentAnswerMap,
  applyValueToContent
} = require("../server/services/contributionService");

test("Sprachbausteine correction compares answers case-sensitively", () => {
  assert.equal(normalizeContributionValue("sprachbausteine-1", " Sie "), "Sie");
  assert.equal(normalizeContributionValue("sprachbausteine-2", " sie "), "sie");

  const rows = buildComparisonRows({
    partKey: "sprachbausteine-1",
    itemNumbers: ["21"],
    answerValues: { 21: "Sie" },
    currentAnswerMap: { 21: "sie" },
    canCompareAgainstCurrent: true
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].currentValue, "sie");
  assert.equal(rows[0].submittedValue, "Sie");
  assert.equal(rows[0].isDifferent, true);
});

test("accepting or reverting a Sprachbausteine correction preserves capitalization", () => {
  const content = { answers: [{ id: 21, answer: "sie" }] };

  assert.deepEqual(buildCurrentAnswerMap("sprachbausteine-1", content), { 21: "sie" });
  applyValueToContent("sprachbausteine-1", content, "21", "Sie");
  assert.equal(content.answers[0].answer, "Sie");
  applyValueToContent("sprachbausteine-1", content, "21", "sie");
  assert.equal(content.answers[0].answer, "sie");
});

test("Sprachbausteine edits expose case-sensitive allowed values", () => {
  const teilOne = buildAllowedValuesByItem("sprachbausteine-1", {
    blanks: [{ id: 21, options: ["sie", "Sie", "Ihnen"] }]
  }, ["21"]);
  const teilTwo = buildAllowedValuesByItem("sprachbausteine-2", {
    options: ["ALS", "als", "WENN"]
  }, ["31"]);

  assert.deepEqual(teilOne[21], ["sie", "Sie", "Ihnen"]);
  assert.deepEqual(teilTwo[31], ["ALS", "als", "WENN"]);
});
