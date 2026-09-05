const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeTeachingInsights, getEditorContext } = require("../server/services/lesenService");

test("Teil 1 normalizes explanations and de-duplicates source keywords", () => {
  const content = normalizeTeachingInsights("teil-1", {
    texts: [{ id: 1, text: "Täglich mit dem Fahrrad zur Arbeit fahren." }],
    headlines: [{ id: "A", text: "Gesund zur Arbeit" }],
    answers: [{ textId: 1, headlineId: "A", reason: "  Beide Texte nennen die Arbeit.  ", keywords: ["Arbeit", "arbeit", "Fahrrad"] }]
  });

  assert.equal(content.answers[0].reason, "Beide Texte nennen die Arbeit.");
  assert.deepEqual(content.answers[0].keywords, ["Arbeit", "Fahrrad"]);
});

test("Teil 1 preserves an exact multi-word highlight range", () => {
  const text = "Täglich mit dem Fahrrad zur Arbeit fahren.";
  const phrase = "mit dem Fahrrad";
  const start = text.indexOf(phrase);
  const content = normalizeTeachingInsights("teil-1", {
    texts: [{ id: 1, text }],
    headlines: [{ id: "A", text: "Gesund zur Arbeit" }],
    answers: [{ textId: 1, headlineId: "A", highlights: [{ source: "text", start, end: start + phrase.length, text: "ignored client value" }] }]
  });

  assert.deepEqual(content.answers[0].highlights, [{ source: "text", start, end: start + phrase.length, text: phrase }]);
});

test("Teil 2 accepts clues from the passage, prompt, and answer options", () => {
  const content = normalizeTeachingInsights("teil-2", {
    passage: { paragraphs: ["Die Bohnen werden täglich frisch geröstet."] },
    questions: [{
      id: 6,
      prompt: "Wie oft wird geröstet?",
      options: [{ id: "a", text: "Täglich" }, { id: "b", text: "Monatlich" }],
      answerId: "a",
      reason: "Das Wort täglich steht direkt im Text.",
      keywords: ["täglich", "frisch geröstet"]
    }]
  });

  assert.deepEqual(content.questions[0].keywords, ["täglich", "frisch geröstet"]);
});

test("Teil 3 rejects keywords that do not occur in the related texts", () => {
  assert.throws(() => normalizeTeachingInsights("teil-3", {
    situations: [{ id: 11, text: "Eine Familie sucht einen Ausflug." }],
    ads: [{ id: "A", text: "Freizeitpark für Kinder" }],
    answers: [{ situationId: 11, adId: "A", reason: "Passend für die Familie.", keywords: ["Schwimmbad"] }]
  }), (error) => error.statusCode === 400 && error.details?.keywords?.[0] === "Schwimmbad");
});

test("rejects stale and overlapping position highlights", () => {
  assert.throws(() => normalizeTeachingInsights("teil-3", {
    situations: [{ id: 11, text: "Eine Familie sucht einen Ausflug." }],
    ads: [{ id: "A", text: "Freizeitpark für Kinder" }],
    answers: [{ situationId: 11, adId: "A", highlights: [{ source: "ad", start: 0, end: 12 }, { source: "ad", start: 5, end: 18 }] }]
  }), (error) => error.statusCode === 400 && /cannot overlap/.test(error.message));

  assert.throws(() => normalizeTeachingInsights("teil-3", {
    situations: [{ id: 11, text: "Eine Familie sucht einen Ausflug." }],
    ads: [{ id: "A", text: "Freizeitpark für Kinder" }],
    answers: [{ situationId: 11, adId: "A", highlights: [{ source: "ad", start: 0, end: 999 }] }]
  }), (error) => error.statusCode === 400 && /invalid highlight range/.test(error.message));
});

test("editor context resolves a complete default selection in one read", async () => {
  const context = await getEditorContext({ level: "b1", partKey: "teil-1" });
  assert.equal(context.selection.level, "b1");
  assert.equal(context.selection.partKey, "teil-1");
  assert.ok(context.selection.themeKey);
  assert.ok(context.revision);
  assert.ok(Array.isArray(context.themes));
  assert.ok(context.part?.content);
});
