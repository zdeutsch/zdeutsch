const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeLesenAnswer, highlightLesenAnswer, mapEvidenceToHighlights, resolveModel } = require("../server/services/lesenAiService");
const { AVAILABLE_MODELS, getContributionAiConfig } = require("../server/services/contributionAiService");

const content = {
  texts: [{ id: 1, text: "Mitarbeiter können E-Bikes für ihren Weg zur Arbeit leasen." }],
  headlines: [{ id: "B", text: "Elektromobilität für Angestellte" }, { id: "C", text: "Urlaub mit Kindern" }],
  answers: [{ textId: 1, headlineId: "B", reason: "Manuelle Begründung.", highlights: [{ source: "text", start: 0, end: 11, text: "Mitarbeiter" }] }]
};
const payload = { partKey: "teil-1", targetId: 1, content, model: "gpt-6.1-sol" };
const validEvidence = [
  { source: "text", quote: "können E-Bikes", occurrence: 1 },
  { source: "headline", quote: "Elektromobilität für Angestellte", occurrence: 1 }
];

async function withResponses(responses, run) {
  const oldFetch = global.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  const requests = [];
  process.env.OPENAI_API_KEY = "fixture-key";
  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    requests.push(JSON.parse(options.body));
    const parsed = responses[Math.min(requests.length - 1, responses.length - 1)];
    return { ok: true, async json() { return { output_text: JSON.stringify(parsed) }; } };
  };
  try { await run(requests); } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
  }
}

test("current model catalogue matches frontend fallbacks and all selections are accepted", async () => {
  const { fallbackAiModels, resolveAiModel } = await import("../dashboard-react/src/utils/aiModels.mjs");
  assert.deepEqual(fallbackAiModels.map(x => x.id), AVAILABLE_MODELS.map(x => x.id));
  for (const id of ["gpt-6.1-sol", "gpt-6-luna", "gpt-6-sol", "gpt-5.6-luna"]) {
    assert.equal(resolveModel(id), id);
    assert.equal(resolveAiModel(getContributionAiConfig(), id).selectedModel, id);
  }
  assert.equal(resolveAiModel(null, "gpt-6.1-sol").selectedModel, "gpt-6.1-sol");
});

test("justification request and response contain no highlighting work", async () => {
  const unchanged = JSON.stringify(payload);
  await withResponses([{ reason: "E-Bikes sind elektrische Fahrräder für Angestellte.", score: 98, alternativeAssessment: "B passt.", evidence: validEvidence }], async requests => {
    const result = await analyzeLesenAnswer(payload);
    assert.match(result.reason, /E-Bikes/);
    assert.equal(result.model, "gpt-6.1-sol");
    assert.equal(Object.hasOwn(result, "highlights"), false);
    assert.deepEqual(requests[0].text.format.schema.required, ["reason", "score", "alternativeAssessment"]);
    assert.match(requests[0].input[1].content, /keine Markierungen/);
  });
  assert.equal(JSON.stringify(payload), unchanged);
});

test("keyword request returns only short exact ranges on both linked sources", async () => {
  const unchanged = JSON.stringify(payload);
  await withResponses([{ evidence: validEvidence, reason: "This must not overwrite a reason." }], async requests => {
    const result = await highlightLesenAnswer(payload);
    assert.equal(Object.hasOwn(result, "reason"), false);
    assert.deepEqual(result.highlights.map(x => x.text).sort(), ["können E-Bikes", "Elektromobilität für Angestellte"].sort());
    for (const mark of result.highlights) {
      const source = mark.source === "text" ? content.texts[0].text : content.headlines[0].text;
      assert.equal(source.slice(mark.start, mark.end), mark.text);
    }
    assert.deepEqual(requests[0].text.format.schema.required, ["evidence"]);
    assert.equal(requests[0].text.format.schema.properties.evidence.maxItems, 4);
    assert.match(requests[0].input[1].content, /Negationen/);
  });
  assert.equal(JSON.stringify(payload), unchanged);
});

test("rejects sentences, partial words and hallucinated keywords while preserving negations", () => {
  const text = "Mitarbeiter dürfen nicht fahren. Kinder können täglich mit dem Fahrrad fahren.";
  const marks = mapEvidenceToHighlights([
    { source: "text", quote: "Mitarbeiter dürfen nicht fahren", occurrence: 1 },
    { source: "text", quote: "arbeiter", occurrence: 1 },
    { source: "text", quote: "nicht fahren", occurrence: 1 },
    { source: "text", quote: "Kinder", occurrence: 1 },
    { source: "text", quote: "täglich", occurrence: 1 },
    { source: "missing", quote: "Kinder", occurrence: 1 }
  ], [{ key: "text", text }]);
  assert.deepEqual(marks.map(x => x.text), ["nicht fahren", "Kinder"]);
});

test("accepts a three-word expression but rejects longer spans", () => {
  const text = "Kinder dürfen nicht mehr fahren. Der Eintritt für Kinder ist kostenlos.";
  const marks = mapEvidenceToHighlights([
    { source: "text", quote: "nicht mehr fahren", occurrence: 1 },
    { source: "text", quote: "Der Eintritt für Kinder", occurrence: 1 },
    { source: "text", quote: "Eintritt für Kinder", occurrence: 1 }
  ], [{ key: "text", text }]);
  assert.deepEqual(marks.map(x => x.text), ["nicht mehr fahren", "Eintritt für Kinder"]);
});

test("accepts short comma-separated expressions while rejecting sentence endings", () => {
  const text = "Sport-Empfehlung: Schwimmen, Gehen, Radfahren. Vier weitere Wörter folgen.";
  const marks = mapEvidenceToHighlights([
    { source: "headline", quote: "Schwimmen, Gehen, Radfahren", occurrence: 1 },
    { source: "headline", quote: "Vier weitere Wörter", occurrence: 1 },
    { source: "headline", quote: "Vier weitere Wörter folgen.", occurrence: 1 }
  ], [{ key: "headline", text }]);
  assert.deepEqual(marks.map(x => x.text), ["Schwimmen, Gehen, Radfahren", "Vier weitere Wörter"]);
});

test("invalid keywords are retried once without returning broad highlights", async () => {
  await withResponses([{ evidence: [{ source: "text", quote: content.texts[0].text, occurrence: 1 }] }, { evidence: validEvidence }], async requests => {
    const result = await highlightLesenAnswer(payload);
    assert.equal(requests.length, 2);
    assert.equal(result.highlights.length, 2);
    assert.match(requests[1].input[1].content, /vorherige Auswahl war ungültig/);
  });
  await withResponses([{ evidence: [{ source: "text", quote: "Mitarbeiter", occurrence: 1 }] }], async requests => {
    await assert.rejects(highlightLesenAnswer(payload), /Vorhandene Markierungen bleiben erhalten/);
    assert.equal(requests.length, 2);
  });
});

test("keywords link the passage to the correct option in Teil 2 and situation to ad in Teil 3", async () => {
  const two = { partKey: "teil-2", targetId: 6, model: "gpt-6.1-sol", content: {
    passage: { paragraphs: ["Kinder unter sechs Jahren fahren kostenlos."] },
    questions: [{ id: 6, prompt: "Was gilt für Kinder?", answerId: "a", options: [{ id: "a", text: "Sie fahren kostenlos." }, { id: "b", text: "Sie bezahlen." }] }]
  } };
  await withResponses([{ evidence: [{ source: "passage:0", quote: "kostenlos", occurrence: 1 }, { source: "option:a", quote: "kostenlos", occurrence: 1 }] }], async () => {
    assert.deepEqual((await highlightLesenAnswer(two)).highlights.map(x => x.source).sort(), ["option:a", "passage:0"]);
  });
  const three = { partKey: "teil-3", targetId: 11, model: "gpt-6.1-sol", content: {
    situations: [{ id: 11, text: "Sie suchen Freizeitangebote für Kinder." }],
    ads: [{ id: "A", text: "Freizeitpark mit Spielplätzen für Kinder." }, { id: "B", text: "Deutschkurs für Erwachsene" }],
    answers: [{ situationId: 11, adId: "A" }]
  } };
  await withResponses([{ evidence: [{ source: "situation", quote: "Kinder", occurrence: 1 }, { source: "ad", quote: "Spielplätzen", occurrence: 1 }] }], async () => {
    assert.deepEqual((await highlightLesenAnswer(three)).highlights.map(x => x.source).sort(), ["ad", "situation"]);
  });
});
