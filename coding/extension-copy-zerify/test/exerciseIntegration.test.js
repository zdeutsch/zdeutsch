const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const C = require("../site/exercise-catalog");
const { importLegacy } = require("../scripts/import-b2-legacy.cjs");
const { mergeThemen } = require("../scripts/merge-b2-themen.cjs");
const { createSidecarRepository } = require("../server/repositories/exerciseSidecarRepository");
const { validateExercise, validateNamesEntry } = require("../server/services/exerciseCatalogService");
const standalone = require("../site/database/exercise-additions.b2.json");
const names = require("../site/database/exercise-names.b2.json");
const databases = Object.fromEntries(C.FILES.map(file => [file, require(`../site/database/${file}`)]));
const additions = { exercises: [...C.mergedExercises(databases, { includeHidden: true, levels: ["b2"] }), ...standalone.exercises] };

test("31 additions contain exactly the reviewed missing sets and distinct grammar variants", () => {
  assert.equal(additions.exercises.length, 31);
  assert.equal(new Set(additions.exercises.map(item => item.id)).size, 31);
  assert.equal(additions.exercises.filter(item => item.module === "lesen").length, 6);
  assert.equal(additions.exercises.filter(item => item.module === "horen").length, 24);
  assert.equal(additions.exercises.filter(item => item.module === "shreiben").length, 1);
  for (const item of additions.exercises) { validateExercise(item); assert.equal(item.review.answerStatus, "unverified"); assert.equal(item.audio, undefined); }
  assert.equal(additions.exercises.filter(item => item.module === "horen").reduce((n, item) => n + item.payload.statements.length, 0), 160);
});

test("all scoped names reference current content; aliases open the requested part", () => {
  const bound = C.bindNames(databases, names);
  assert.equal(bound.length, names.entries.length);
  const result = C.searchNames(bound, { query: "Puppenmacher", module: "lesen" });
  assert.ok(result.length);
  const umwelt = result.find(item => item.target.themeKey === "umwelt");
  assert.ok(umwelt);
  assert.equal(new URL(umwelt.url, "https://example.test/").searchParams.get("part"), "teil-2");
  assert.equal(umwelt.contextTitle, "Umwelt");
  assert.equal(C.searchNames(bound, { query: "Puppenmacher", module: "horen" }).length, 0);
  assert.equal(C.searchNames(bound, { query: "Liebe Lara" }).length, 0);
  assert.equal(C.searchAdditions(additions, { query: "Liebe Lara" }).length, 1);
  assert.ok(C.searchNames(bound, { query: "Herr Martini" }).length > 1, "ambiguous destinations must remain available");
});

test("answer corrections retain names; a changed exercise body invalidates stale mappings", () => {
  const data = structuredClone(databases);
  const entry = names.entries.find(e => e.target.file === "horen-codes.json");
  const record = C.resolveTarget(data, entry.target).record;
  record.statements[0].correct = !record.statements[0].correct;
  assert.equal(C.bindNames(data, { entries: [entry] }).length, 1);
  record.statements[0].text = "A completely different recording.";
  assert.equal(C.bindNames(data, { entries: [entry] }).length, 0);
  assert.throws(() => validateNamesEntry(entry, data), /referenced exercise has changed/);
  assert.equal(C.resolveTarget(databases, { file: "lesen.json", level: "b2", kind: "theme", themeKey: "__proto__" }), null);
});

test("the combined library retains current exercises which had no old counterpart", () => {
  const combined = C.combinedNames(databases, names);
  const results = C.searchNames(combined, { query: "Im August", module: "horen" });
  assert.ok(results.some(entry => entry.target.file === "horen-codes.json"));
  assert.ok(results.some(entry => entry.target.file === "horen-audio.json"));
  assert.equal(C.searchAdditions(additions, { query: "Im August", module: "horen" }).length, 1);
});

test("new grammar keys must belong to the corresponding options and verified keys need a review note", () => {
  const sample = structuredClone(additions.exercises.find(e => e.module === "lesen"));
  sample.payload.answers[0].answer = "not an option";
  assert.throws(() => validateExercise(sample), /Answer must occur/);
  sample.payload.answers[0].answer = sample.payload.blanks[0].options[0];
  sample.review.answerStatus = "verified";
  assert.throws(() => validateExercise(sample), /review note/);
  sample.review.note = "All gap answers checked against the text.";
  assert.equal(validateExercise(sample), sample);
});

test("repeat import preserves base bytes, corrections, manager edits and removed aliases", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "zdeutsch-import-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dbDir = path.join(root, "db"), sourceDir = path.join(root, "source");
  await fs.mkdir(dbDir); await fs.mkdir(sourceDir);
  const target = { file: "lesen.json", level: "b2", kind: "part", themeKey: "a", versionKey: "default", partKey: "teil-2" };
  const base = { levels: { b2: { themes: { a: { title: "A", defaultVersion: "default", versions: { default: { lesen: { parts: { "teil-2": { content: { passage: { text: "Existing corrected passage" }, questions: [] } } } } } } } } } } };
  const raw = JSON.stringify(base); await fs.writeFile(path.join(dbDir, "lesen.json"), raw);
  const source = { id: "b2_g1_fixture", clozeText: Array.from({ length: 10 }, (_, i) => `Text [[${i + 1}]]`).join(" "), questions: Array.from({ length: 10 }, (_, i) => ({ id: i + 1, options: ["a", "b", "c"], correctAnswer: "b" })) };
  await fs.writeFile(path.join(sourceDir, source.id + ".json"), JSON.stringify(source));
  const plan = { batchId: "fixture", items: [{ category: "SprachbausteineTeil1", title: "New letter", proposedStableId: "legacy:fixture", source: { quizId: source.id } }], nameMappings: [{ target, label: "C", subtitle: "C", source: { auditReference: "old-C" } }] };
  const initial = await importLegacy({ databaseDir: dbDir, sourceDir, plan }); assert.equal(initial.added, 1);
  const additionFile = path.join(dbDir, "exercise-additions.b2.json"), nameFile = path.join(dbDir, "exercise-names.b2.json");
  const extra = JSON.parse(await fs.readFile(additionFile)); extra.exercises[0].title = "Manager's new title"; extra.exercises[0].payload.answers[0].answer = "c";
  const index = JSON.parse(await fs.readFile(nameFile)); index.entries[0].names = [{ label: "Manager's alternative name", source: "manager", scope: "exercise" }];
  const extraRaw = JSON.stringify(extra), indexRaw = JSON.stringify(index);
  await fs.writeFile(additionFile, extraRaw); await fs.writeFile(nameFile, indexRaw);
  const second = await importLegacy({ databaseDir: dbDir, sourceDir, plan }); assert.equal(second.added, 0); assert.equal(second.nameAdded, 0);
  assert.equal(await fs.readFile(path.join(dbDir, "lesen.json"), "utf8"), raw);
  assert.equal(await fs.readFile(additionFile, "utf8"), extraRaw); assert.equal(await fs.readFile(nameFile, "utf8"), indexRaw);
  base.levels.b2.themeOrder = ["a"];
  await fs.writeFile(path.join(dbDir, "lesen.json"), JSON.stringify(base));
  await fs.writeFile(path.join(dbDir, "horen-codes.json"), JSON.stringify({ levels: { b2: { themes: {} } } }));
  await fs.writeFile(path.join(dbDir, "shreiben.json"), JSON.stringify({ levels: { b2: { tasks: [] } } }));
  assert.equal((await mergeThemen({ databaseDir: dbDir, backupDir: path.join(root, "backup") })).merged, 1);
  const mergedBefore = await fs.readFile(path.join(dbDir, "lesen.json"), "utf8"), manifestBefore = await fs.readFile(additionFile, "utf8");
  const third = await importLegacy({ databaseDir: dbDir, sourceDir, plan });
  assert.equal(third.added, 0); assert.equal(third.nameAdded, 0);
  assert.equal(await fs.readFile(path.join(dbDir, "lesen.json"), "utf8"), mergedBefore);
  assert.equal(await fs.readFile(additionFile, "utf8"), manifestBefore);
  assert.equal(await fs.readFile(nameFile, "utf8"), indexRaw);
  const mergedDb = { "lesen.json": JSON.parse(mergedBefore) }, mergedItem = C.mergedExercises(mergedDb)[0];
  assert.equal(mergedItem.title, "Manager's new title");
  assert.equal(mergedItem.payload.answers[0].answer, "c");
  source.clozeText += " source revision"; await fs.writeFile(path.join(sourceDir, source.id + ".json"), JSON.stringify(source));
  await assert.rejects(importLegacy({ databaseDir: dbDir, sourceDir, plan }), /Changed source requires revision review/);
  source.clozeText = source.clozeText.replace(" source revision", "");
  await fs.writeFile(path.join(sourceDir, source.id + ".json"), JSON.stringify(source));
  delete mergedDb["lesen.json"].levels.b2.themes[mergedItem.target.themeKey];
  await fs.writeFile(path.join(dbDir, "lesen.json"), JSON.stringify(mergedDb["lesen.json"]));
  await assert.rejects(importLegacy({ databaseDir: dbDir, sourceDir, plan }), /Merged exercise was removed or moved/);
});

test("sidecar saves reject concurrent stale edits and cannot target a base file", async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "zdeutsch-sidecar-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, "exercise-additions.b2.json"), JSON.stringify({ exercises: [] }));
  const store = createSidecarRepository(directory), snapshot = await store.read("additions");
  const outcomes = await Promise.allSettled([store.mutate("additions", snapshot.revision, data => { data.exercises.push({ id: "one" }); return data; }), store.mutate("additions", snapshot.revision, data => { data.exercises.push({ id: "two" }); return data; })]);
  assert.equal(outcomes.filter(o => o.status === "fulfilled").length, 1);
  assert.equal(outcomes.find(o => o.status === "rejected").reason.statusCode, 409);
  assert.equal((await store.read("additions")).data.exercises.length, 1);
  await assert.rejects(store.read("lesen"), /Unknown additional-content file/);
  await assert.rejects(store.mutate("additions", "", data => data), /Reload/);
});
