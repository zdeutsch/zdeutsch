const test = require("node:test");
const assert = require("node:assert/strict");

const {
  splitPairedAnswer,
  sameAnswer,
  countBlankOccurrences,
  resolveCorrectAnswer,
  answerForOccurrence
} = require("../site/sprachbausteine-utils");

test("splits paired Sprachbausteine answers with Unicode or ASCII ellipses", () => {
  assert.deepEqual(splitPairedAnswer("sowohl … als auch"), ["sowohl", "als auch"]);
  assert.deepEqual(splitPairedAnswer("Einerseits ... anderseits"), ["Einerseits", "anderseits"]);
});

test("compares Sprachbausteine answers case-sensitively", () => {
  assert.equal(sameAnswer("Sie", "Sie"), true);
  assert.equal(sameAnswer("Sie", "sie"), false);
});

test("infers the unique paired option from a stored answer fragment", () => {
  assert.equal(
    resolveCorrectAnswer("sowohl", ["sowohl … als auch", "teils … teils", "weder … noch"], 2),
    "sowohl … als auch"
  );
  assert.equal(
    resolveCorrectAnswer("als auch", ["sowohl … als auch", "teils … teils", "weder … noch"], 2),
    "sowohl … als auch"
  );
  assert.equal(
    resolveCorrectAnswer("aber", ["nicht nur … sondern", "teils … teils", "zwar … aber"], 2),
    "zwar … aber"
  );
});

test("keeps an exact full paired answer and renders one half per occurrence", () => {
  const answer = resolveCorrectAnswer("sowohl ... als auch", ["sowohl … als auch"], 2);
  assert.equal(answer, "sowohl … als auch");
  assert.equal(answerForOccurrence(answer, 0, 2), "sowohl");
  assert.equal(answerForOccurrence(answer, 1, 2), "als auch");
});

test("does not guess when more than one paired option matches", () => {
  assert.equal(
    resolveCorrectAnswer("als", ["sowohl … als", "so … als"], 2),
    "als"
  );
});

test("counts repeated template markers by id", () => {
  const counts = countBlankOccurrences([
    { type: "blank", id: "29" },
    { type: "text", value: " in Nord– " },
    { type: "blank", id: "29" }
  ]);
  assert.equal(counts.get("29"), 2);
});
