const fs = require("node:fs/promises");
const path = require("node:path");
const { DATABASE_DIR, SITE_DIR } = require("../config/constants");
const repository = require("../repositories/exerciseSidecarRepository");
const C = require("../../site/exercise-catalog");
const AppError = require("../utils/appError");
const { createHash } = require("node:crypto");
const { readJsonSnapshotByKey, mutateJsonByKey } = require("../repositories/jsonRepository");
const MERGED_FILES = { "lesen.json": "lesen", "horen-codes.json": "horen", "shreiben.json": "shreiben" };
function assert(condition, message) { if (!condition) throw new AppError(message, 400); }
function text(value, label, max = 100000) { assert(typeof value === "string" && value.trim() && value.length <= max, `Invalid ${label}`); }
function validateExercise(item) {
  text(item.id, "exercise ID", 200); text(item.title, "title", 200);
  assert(["b1", "b2"].includes(item.level) && ["lesen", "horen", "shreiben"].includes(item.module), "Invalid module or level");
  assert(Array.isArray(item.names) && item.names.length <= 40 && item.names.every(n => typeof n === "string" && n.trim() && n.length <= 200), "Invalid alternative names");
  assert(typeof item.enabled === "boolean", "Invalid visibility");
  assert(item.provenance?.quizId && /^[a-f0-9]{64}$/.test(item.provenance.sourceFingerprint), "Source provenance is required");
  assert(["unverified", "verified"].includes(item.review?.answerStatus), "Invalid answer review status");
  assert(typeof item.review.note === "string" && item.review.note.length <= 5000, "Invalid review note");
  if (item.review.answerStatus === "verified") text(item.review.note, "review note", 5000);
  const p = item.payload;
  assert(p && typeof p === "object" && !Array.isArray(p), "Missing exercise content");
  if (item.module === "horen") {
    assert(["teil-1", "teil-2", "teil-3"].includes(item.partKey), "Invalid listening part");
    assert(Array.isArray(p.statements) && p.statements.length === (item.partKey === "teil-2" ? 10 : 5), "Unexpected statement count");
    const ids = new Set();
    p.statements.forEach(s => { text(s.id, "statement ID", 240); text(s.text, "statement text"); assert(!ids.has(s.id) && typeof s.correct === "boolean" && Number.isInteger(s.number), "Invalid statement"); ids.add(s.id); });
  } else if (item.module === "lesen") {
    assert(["sprachbausteine-1", "sprachbausteine-2"].includes(item.partKey), "Invalid grammar part"); text(p.text, "cloze text");
    assert(Array.isArray(p.blanks) && p.blanks.length === 10 && Array.isArray(p.answers) && p.answers.length === 10, "Expected ten grammar gaps and answers");
    const ids = new Set();
    p.blanks.forEach(b => {
      const first = item.partKey === "sprachbausteine-1" ? 21 : 31;
      assert(Number.isInteger(b.id) && !ids.has(b.id) && b.id >= first && b.id < first + 10, "Invalid grammar gap ID"); ids.add(b.id);
      if (item.partKey === "sprachbausteine-1") {
        assert(Array.isArray(b.options) && b.options.length === 3 && b.options.every(o => typeof o === "string" && o.trim()), "Invalid grammar options");
        const answers = p.answers.filter(a => a.id === b.id); assert(answers.length === 1 && b.options.includes(answers[0].answer), "Answer must occur in its gap options");
      } else {
        const answers = p.answers.filter(a => a.id === b.id);
        assert(answers.length === 1 && typeof answers[0].answer === "string", "Invalid word-bank answer");
      }
    });
    const gaps = [...p.text.matchAll(/\[\[\s*(\d+)\s*\]\]/g)].map(m => Number(m[1]));
    assert(new Set(gaps).size === 10 && gaps.every(id => ids.has(id)), "Cloze markers must match the ten gaps");
    if (item.partKey === "sprachbausteine-2") {
      assert(Array.isArray(p.options) && p.options.length > 0 && p.options.every(word => typeof word === "string" && word.trim()), "Invalid word bank");
      if (p.wordBank) assert(Array.isArray(p.wordBank) && JSON.stringify(p.wordBank.map(word => word.text)) === JSON.stringify(p.options), "Word-bank representations must agree");
      if (item.review.answerStatus === "verified") assert(C.hasAnswerKey(item), "Verified keys must use available words once each");
    }
  } else {
    assert(item.partKey === "teil-1", "Invalid writing part");
    ["istructions", "content", "tasks"].forEach(key => text(p[key], key));
    assert(Number.isInteger(p.minimumWords) && p.minimumWords > 0, "Invalid word target");
  }
  if (item.audio) {
    assert(item.module === "horen" && item.audio.status === "verified" && /^assets\/audio\/[a-zA-Z0-9/_-]+\.(mp3|m4a|wav|ogg)$/i.test(item.audio.src), "Use a reviewed local recording");
    text(item.audio.note, "audio review note", 5000);
  }
  return item;
}
async function databases() {
  return Object.fromEntries(await Promise.all(C.FILES.map(async file => [file, JSON.parse(await fs.readFile(path.join(DATABASE_DIR, file), "utf8"))])));
}
async function mergedSnapshot(level = "b2") {
  const snapshots = Object.fromEntries(await Promise.all(Object.entries(MERGED_FILES).map(async ([file, key]) => [file, await readJsonSnapshotByKey(key)])));
  const db = Object.fromEntries(Object.entries(snapshots).map(([file, snapshot]) => [file, snapshot.data]));
  const revision = "merged:" + createHash("sha256").update(JSON.stringify(Object.values(snapshots).map(snapshot => snapshot.revision))).digest("hex");
  return { db, snapshots, revision, items: C.mergedExercises(db, { includeHidden: true, levels: [level] }) };
}
function validateNamesEntry(entry, db) {
  assert(entry.id === C.targetId(entry.target), "Name target identity is immutable");
  const resolved = C.resolveTarget(db, entry.target);
  assert(resolved && C.fingerprint(C.identityContent(entry.target, resolved.record)) === entry.contentFingerprint, "The referenced exercise has changed. Review its names before saving.");
  assert(typeof entry.subtitle === "string" && entry.subtitle.length <= 200, "Invalid subtitle");
  assert(Array.isArray(entry.names) && entry.names.length > 0 && entry.names.length <= 40, "Provide between one and forty names");
  const scope = entry.target.kind === "theme" ? "theme" : "exercise";
  entry.names.forEach(name => { text(name.label, "name", 200); assert(name.scope === scope && typeof name.source === "string", "Invalid name scope"); });
  return entry;
}
async function list(level = "b2") {
  const sidecar = repository.forLevel(level);
  const [additions, names, db, merged] = await Promise.all([sidecar.read("additions"), sidecar.read("names"), databases(), mergedSnapshot(level)]);
  const bound = C.bindNames(db, names.data);
  const lookup = new Map(bound.map(entry => [entry.id, entry]));
  return { additions: [...merged.items, ...additions.data.exercises], additionsRevision: merged.items.length ? merged.revision : additions.revision, names: names.data.entries.map(entry => ({ ...entry, available: lookup.has(entry.id), context: lookup.get(entry.id)?.contextTitle || "Referenz prüfen", versionLabel: lookup.get(entry.id)?.versionLabel || "", label: C.partLabel(entry.target) })), namesRevision: names.revision };
}
async function targets(level = "b2") {
  repository.forLevel(level);
  return C.baseEntries(await databases(), { includeHidden: true, levels: [level] }).map(entry => ({ id: entry.id, target: entry.target, label: [entry.contextTitle, entry.versionLabel, entry.label].filter(Boolean).join(" · ") }));
}
async function updateExercise(id, input, level = "b2") {
  const sidecar = repository.forLevel(level);
  const permitted = ["title", "names", "payload", "review", "enabled", "audio"];
  assert(input.patch && Object.keys(input.patch).every(key => permitted.includes(key)), "Only added content can be edited here");
  const merged = await mergedSnapshot(level);
  const imported = merged.items.find(item => item.id === id);
  if (imported) {
    if (input.revision !== merged.revision) throw new AppError("This content was changed after you opened it. Reload before saving.", 409);
    const target = imported.target;
    const mutation = await mutateJsonByKey(MERGED_FILES[target.file], async db => {
      const resolved = C.resolveTarget({ [target.file]: db }, target);
      assert(resolved?.record.legacyImport?.id === id, "Imported exercise identity has changed. Reload before saving.");
      const old = C.mergedExercise({ ...resolved, target, module: C.section(target) });
      const next = { ...old, ...input.patch };
      if (input.patch.audio === null) delete next.audio;
      validateExercise(next);
      const identity = payload => old.module === "horen" ? payload.statements.map(s => [s.id, s.sourceQuestionId]) : old.module === "lesen" ? payload.blanks.map(b => [b.id, b.sourceQuestionId]) : [];
      assert(JSON.stringify(identity(old.payload)) === JSON.stringify(identity(next.payload)), "Original question identities must stay unchanged");
      if (C.fingerprint(next.payload) !== C.fingerprint(old.payload) && !input.patch.review) next.review = { answerStatus: "unverified", note: "" };
      if (next.audio) await fs.access(path.join(SITE_DIR, next.audio.src));
      C.applyMergedExercise(resolved.record, next);
      return { data: db };
    }, { expectedRevision: merged.snapshots[target.file].revision });
    return { data: C.mergedExercises({ [target.file]: mutation.data }, { includeHidden: true, levels: [level] }), revision: (await mergedSnapshot(level)).revision };
  }
  return sidecar.mutate("additions", input.revision, async data => {
    const index = data.exercises.findIndex(e => e.id === id);
    if (index < 0) throw new AppError("Additional exercise not found", 404);
    const old = data.exercises[index], next = { ...old, ...input.patch };
    if (input.patch.audio === null) delete next.audio;
    validateExercise(next);
    const identity = payload => old.module === "horen" ? payload.statements.map(s => [s.id, s.sourceQuestionId]) : old.module === "lesen" ? payload.blanks.map(b => [b.id, b.sourceQuestionId]) : [];
    assert(JSON.stringify(identity(old.payload)) === JSON.stringify(identity(next.payload)), "Original question identities must stay unchanged");
    const changed = C.fingerprint(next.payload) !== C.fingerprint(old.payload);
    if (changed && !input.patch.review) next.review = { answerStatus: "unverified", note: "" };
    if (next.audio) await fs.access(path.join(SITE_DIR, next.audio.src));
    data.exercises[index] = next; return data;
  });
}
async function saveNames(id, input, level = "b2") {
  const sidecar = repository.forLevel(level);
  const db = await databases();
  assert(Array.isArray(input.labels), "Provide alternative names");
  return sidecar.mutate("names", input.revision, data => {
    const index = data.entries.findIndex(entry => entry.id === id);
    const current = index >= 0 ? data.entries[index] : null;
    const target = current?.target || input.target;
    assert(target && C.targetId(target) === id, "Invalid target");
    assert(target.level === level, "The name target belongs to another level");
    const resolved = C.resolveTarget(db, target); assert(resolved, "Target does not exist");
    const entry = { ...(current || { id, target, contentFingerprint: C.fingerprint(C.identityContent(target, resolved.record)), sourceReferences: [] }), subtitle: String(input.subtitle || ""), names: [...new Set(input.labels.map(label => String(label).trim()).filter(Boolean))].map(label => ({ label, scope: target.kind === "theme" ? "theme" : "exercise", source: current?.names.find(n => n.label === label)?.source || "manager" })) };
    if (input.rebind === true) {
      text(input.reviewNote, "mapping review note", 5000);
      entry.contentFingerprint = C.fingerprint(C.identityContent(target, resolved.record));
      entry.mappingReviewNote = input.reviewNote;
    }
    validateNamesEntry(entry, db);
    if (index >= 0) data.entries[index] = entry; else data.entries.push(entry);
    return data;
  });
}
module.exports = { list, targets, updateExercise, saveNames, validateExercise, validateNamesEntry };
