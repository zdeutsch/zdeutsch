const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { enumerate, protectedHash, validateEvidence, atomicJson, applyResults, generate, MODEL, POLICY } = require("../scripts/bulk-lesen-keywords.cjs");

const part = () => ({ content: {
  passage: { paragraphs: ["Kinder fahren immer kostenlos."] },
  questions: [{ id: 6, prompt: "Was gilt für Kinder?", answerId: "a", reason: "Manuelle Erklärung.",
    options: [{ id: "a", text: "Kinder fahren kostenlos." }, { id: "b", text: "Kinder bezahlen immer." }],
    keywords: ["old broad phrase"], highlights: [] }]
} });
const fixture = () => ({ levels: {
  b1: { themes: { alpha: { versions: { default: { lesen: { parts: {
    "teil-1": { content: { answers: [{ textId: 1, reason: "Protected", highlights: [{ text: "Entire manual expression" }] }] } },
    "teil-2": part()
  } } } } } } },
  b2: { themes: { beta: { versions: { default: { lesen: { parts: { "teil-2": part() } } }, variant: { lesen: { parts: { "teil-2": part() } } } } } } }
} });
const evidence = [{ source: "passage:0", quote: "immer kostenlos", occurrence: 1 }, { source: "option:a", quote: "fahren kostenlos", occurrence: 1 }];

function seed(data, directory) {
  for (const job of enumerate(data).jobs) atomicJson(path.join(directory, "results", `${job.id}.json`), {
    id: job.id, policy: POLICY, model: MODEL, evidence, highlights: validateEvidence(evidence, job.context)
  });
}

test("includes both levels/all variants but excludes B1 Teil 1, deduplicating identical contexts", () => {
  const { jobs, counts } = enumerate(fixture());
  assert.equal(jobs.length, 3);
  assert.equal(new Set(jobs.map(job => job.id)).size, 1);
  assert.deepEqual(counts, { "b1/teil-2": 1, "b2/teil-2": 2 });
});

test("rejects isolated words, long spans, hallucinations and wrong source linkage", () => {
  const context = enumerate(fixture()).jobs[0].context;
  for (const bad of [
    [{ source: "passage:0", quote: "kostenlos", occurrence: 1 }, evidence[1]],
    [{ source: "passage:0", quote: "Kinder fahren immer kostenlos", occurrence: 1 }, evidence[1]],
    [{ source: "passage:0", quote: "ganz kostenlos", occurrence: 1 }, evidence[1]],
    [evidence[1], { source: "question", quote: "für Kinder", occurrence: 1 }]
  ]) assert.throws(() => validateEvidence(bad, context));
  assert.equal(validateEvidence(evidence, context).length, 2);
});

test("X answers highlight an unmet requirement only in the situation", () => {
  const data = fixture();
  data.levels.b2.themes.beta.versions.default.lesen.parts["teil-3"] = { content: {
    situations: [{ id: 11, text: "Sie suchen eine Wohnung mit Balkon." }],
    ads: [{ id: "A", text: "Ferienwohnung ohne Balkon." }], answers: [{ situationId: 11, adId: "X" }]
  } };
  const context = enumerate(data).jobs.find(job => job.key === "teil-3").context;
  assert.equal(context.noMatch, true);
  assert.equal(validateEvidence([{ source: "situation", quote: "mit Balkon", occurrence: 1 }], context).length, 1);
  assert.throws(() => validateEvidence([{ source: "ad", quote: "ohne Balkon", occurrence: 1 }], context));
});

test("apply changes only highlights and legacy keywords; preserves manual explanations and B1 Teil 1", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lesen-bulk-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const baseline = fixture();
  seed(baseline, directory);
  const current = structuredClone(baseline);
  // Concurrent justification and protected edits must be retained, never overwritten by the baseline.
  current.levels.b1.themes.alpha.versions.default.lesen.parts["teil-1"].content.answers[0].reason = "New manual reason";
  current.levels.b1.themes.alpha.versions.default.lesen.parts["teil-2"].content.questions[0].reason = "New explanation";
  const unchanged = JSON.stringify(current);
  const result = applyResults(baseline, current, directory);
  assert.equal(JSON.stringify(current), unchanged);
  assert.equal(protectedHash(result.output), protectedHash(current));
  assert.equal(result.report.totalItems, 3);
  const updated = result.output.levels.b1.themes.alpha.versions.default.lesen.parts["teil-2"].content.questions[0];
  assert.equal(updated.reason, "New explanation");
  assert.deepEqual(updated.keywords, []);
  assert.equal(updated.highlights.length, 2);
});

test("missing output, source changes or newer manual highlights block the entire apply", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lesen-bulk-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const baseline = fixture();
  assert.throws(() => applyResults(baseline, baseline, directory), /Missing validated result/);
  seed(baseline, directory);
  for (const field of ["source", "highlight"]) {
    const current = structuredClone(baseline);
    const content = current.levels.b2.themes.beta.versions.variant.lesen.parts["teil-2"].content;
    if (field === "source") content.passage.paragraphs[0] = "A changed source.";
    else content.questions[0].highlights = [{ text: "new manual mark" }];
    const unchanged = JSON.stringify(current);
    assert.throws(() => applyResults(baseline, current, directory), /Concurrent/);
    assert.equal(JSON.stringify(current), unchanged);
  }
});

test("generation uses the specified model, retries invalid items and resumes without another API call", async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "lesen-bulk-test-"));
  const oldFetch = global.fetch, oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  t.after(() => { fs.rmSync(directory, { recursive: true, force: true }); global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; });
  let calls = 0;
  global.fetch = async (url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    assert.equal(body.model, "gpt-6.1-sol");
    assert.equal(body.store, false);
    const ids = body.text.format.schema.properties.items.items.properties.id.enum;
    return { ok: true, status: 200, json: async () => ({ output_text: JSON.stringify({ items: ids.map(id => ({ id,
      evidence: calls === 1 ? [evidence[0]] : evidence })) }) }) };
  };
  const first = await generate(fixture(), directory);
  assert.equal(calls, 2);
  assert.equal(first.completed, 1);
  assert.deepEqual(first.failures, []);
  const second = await generate(fixture(), directory);
  assert.equal(calls, 2);
  assert.equal(second.alreadyCompleted, 1);
  assert.equal(second.completed, 0);
});
