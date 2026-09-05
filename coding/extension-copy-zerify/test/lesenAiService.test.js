const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULT_MODEL, buildAnalysisContext, mapEvidenceToHighlights } = require("../server/services/lesenAiService");

test("uses a capable non-Astra model by default", () => {
  assert.equal(DEFAULT_MODEL, "gpt-5.6-terra");
  assert.equal(DEFAULT_MODEL.includes("gpt-6-astra"), false);
});

test("Teil 1 AI context includes the correct answer and every distractor", () => {
  const context = buildAnalysisContext("teil-1", {
    texts: [{ id: 1, text: "Mit dem Fahrrad zur Arbeit." }],
    headlines: [{ id: "A", text: "Mobil im Beruf" }, { id: "B", text: "Urlaub am Meer" }, { id: "C", text: "Kochen lernen" }],
    answers: [{ textId: 1, headlineId: "A" }]
  }, 1);

  assert.equal(context.correctAnswer.id, "A");
  assert.deepEqual(context.alternatives.map((item) => item.id), ["B", "C"]);
  assert.deepEqual(context.sources.map((item) => item.key), ["text", "headline"]);
});

test("maps repeated evidence to the requested exact occurrence", () => {
  const text = "Arbeit und Freizeit, danach wieder Arbeit.";
  const highlights = mapEvidenceToHighlights([
    { source: "text", quote: "Arbeit", occurrence: 2 },
    { source: "text", quote: "nicht vorhanden", occurrence: 1 }
  ], [{ key: "text", text }]);

  const start = text.lastIndexOf("Arbeit");
  assert.deepEqual(highlights, [{ source: "text", start, end: start + 6, text: "Arbeit" }]);
});

test("Teil 2 exposes paragraph and correct-option source keys", () => {
  const context = buildAnalysisContext("teil-2", {
    passage: { title: "Mobilität", paragraphs: ["Viele fahren täglich mit dem Rad."] },
    questions: [{ id: 6, prompt: "Wie oft?", answerId: "a", options: [{ id: "a", text: "Täglich" }, { id: "b", text: "Selten" }] }]
  }, 6);

  assert.deepEqual(context.sources.map((item) => item.key), ["passage-title", "passage:0", "question", "option:a"]);
});

test("Teil 3 compares the correct advertisement with all alternatives", () => {
  const context = buildAnalysisContext("teil-3", {
    situations: [{ id: 11, text: "Eine Familie sucht einen Freizeitpark." }],
    ads: [{ id: "A", text: "Freizeitpark für Kinder" }, { id: "B", text: "Sprachkurs für Erwachsene" }, { id: "X", text: "Keine passende Anzeige" }],
    answers: [{ situationId: 11, adId: "A" }]
  }, 11);

  assert.deepEqual(context.sources.map((item) => item.key), ["situation", "ad"]);
  assert.deepEqual(context.alternatives.map((item) => item.id), ["B", "X"]);
});
