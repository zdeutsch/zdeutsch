const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeVisibleOrder,
  summarizeThemes,
  buildSprachbausteineDerivedContent
} = require("../server/services/lesenService");
const { summarizePartStates } = require("../server/services/horenService");
const { createEmptySprechenLevel, summarizePart } = require("../server/services/sprechenService");

test("Lesen theme summaries keep hidden themes manageable", () => {
  const summary = summarizeThemes({
    themeOrder: ["sichtbar"],
    themes: {
      sichtbar: {
        title: "Sichtbares Thema",
        versions: {
          default: {
            lesen: {
              partOrder: ["teil-1"],
              parts: {
                "teil-1": { content: {} },
                "teil-2": { content: {} }
              }
            }
          }
        }
      },
      verborgen: {
        title: "Verborgenes Thema",
        versions: {
          default: { lesen: { partOrder: [], parts: {} } }
        }
      }
    }
  });

  assert.deepEqual(summary.map((theme) => theme.key), ["sichtbar", "verborgen"]);
  assert.equal(summary[0].visible, true);
  assert.equal(summary[0].parts.find((part) => part.key === "teil-1").visible, true);
  assert.equal(summary[0].parts.find((part) => part.key === "teil-2").visible, false);
  assert.equal(summary[1].visible, false);
  assert.equal(summary[1].parts.length, 5);
});

test("visibility order removes and restores keys without deleting records", () => {
  const hidden = normalizeVisibleOrder(["eins", "zwei"], ["eins", "zwei"], "eins", false);
  assert.deepEqual(hidden, ["zwei"]);
  assert.deepEqual(normalizeVisibleOrder(hidden, ["eins", "zwei"], "eins", true), ["zwei", "eins"]);
});

test("Hören and Sprechen summaries expose hidden part state", () => {
  const horen = summarizePartStates({
    themeKey: "horen-b1",
    horenRoot: {
      partOrder: ["teil-1", "teil-3"],
      parts: { "teil-1": {}, "teil-2": {}, "teil-3": {} }
    }
  });
  assert.equal(horen.parts.find((part) => part.key === "teil-2").visible, false);

  const sprechen = summarizePart("teil-2", { title: "Diskussion", topics: [{}] }, false);
  assert.equal(sprechen.available, true);
  assert.equal(sprechen.visible, false);
});

test("a missing Sprechen level starts with the three TELC parts and no copied content", () => {
  const level = createEmptySprechenLevel("b2");

  assert.equal(level.title, "TELC B2 Mündliche Prüfung");
  assert.deepEqual(level.partOrder, ["teil-1", "teil-2", "teil-3"]);
  assert.deepEqual(level.parts["teil-1"].prompts, []);
  assert.deepEqual(level.parts["teil-1"].followUps, []);
  assert.deepEqual(level.parts["teil-2"].topics, []);
  assert.deepEqual(level.parts["teil-3"].topics, []);
});

test("new Sprachbausteine content derives the structure used by the learner app", () => {
  const content = buildSprachbausteineDerivedContent("sprachbausteine-2", {
    text: "Heute [[31]] morgen [[32]].",
    options: ["ABER", "ODER"],
    answers: [{ id: 31, answer: "ABER" }, { id: 32, answer: "ODER" }]
  });

  assert.deepEqual(content.segments, [
    { type: "text", value: "Heute " },
    { type: "luecke", id: 31, answer: "ABER" },
    { type: "text", value: " morgen " },
    { type: "luecke", id: 32, answer: "ODER" },
    { type: "text", value: "." }
  ]);
  assert.deepEqual(content.blanks, [{ id: 31, answer: "ABER" }, { id: 32, answer: "ODER" }]);
  assert.deepEqual(content.wordBank, [{ id: "", text: "ABER" }, { id: "", text: "ODER" }]);
});
