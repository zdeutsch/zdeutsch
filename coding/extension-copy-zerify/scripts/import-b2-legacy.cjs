const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const catalog = require("../site/exercise-catalog");
const defaultPlan = require("./data/b2-legacy-plan.json");

function sha(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function plainText(value) {
  const entities = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
  return String(value || "").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<li\b[^>]*>/gi, "\n- ").replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|ul|ol)>/gi, "\n\n").replace(/<[^>]*>/g, "")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value) => String.fromCodePoint(parseInt(value[0].toLowerCase() === "x" ? value.slice(1) : value, value[0].toLowerCase() === "x" ? 16 : 10)))
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (_, key) => entities[key]).replace(/[ \t]+/g, " ").replace(/\n\s*\n(?:\s*\n)+/g, "\n\n").trim();
}
function convertItem(item, source, batchId) {
  const hearing = item.category.startsWith("Hören");
  let selected = source;
  if (hearing) {
    const ids = new Set(item.source.questionIds);
    selected = source.questions.filter(q => ids.has(q.id));
    if (selected.length !== ids.size || selected.some(q => !["Richtig", "Falsch"].includes(q.correctAnswer))) throw new Error(`Incomplete listening source: ${item.auditReference}`);
  }
  const record = {
    id: item.proposedStableId, level: "b2", module: hearing ? "horen" : item.category === "SchreibenB2" ? "shreiben" : "lesen",
    partKey: hearing ? `teil-${item.category.endsWith("2") ? 2 : 3}` : item.category === "SchreibenB2" ? "teil-1" : "sprachbausteine-1",
    title: item.title, names: [item.title], enabled: true,
    provenance: { batchId, source: "telc.site", quizId: item.source.quizId, url: `https://telc.site/quiz/${item.source.quizId}`, questionIds: hearing ? item.source.questionIds : (source.questions || []).map(q => q.id), sourceFingerprint: sha(JSON.stringify(selected)), audioUrls: item.audioLinksInSource || [] },
    review: { answerStatus: "unverified", note: "" },
    relatedCurrentLocation: item.relatedCurrentLocation || null
  };
  if (hearing) record.payload = { instruction: "Entscheiden Sie bei jeder Aussage: richtig oder falsch.", statements: selected.map((q, index) => ({ id: `${record.id}:q${q.id}`, number: (record.partKey === "teil-2" ? 46 : 56) + index, sourceQuestionId: q.id, text: plainText(q.text), correct: q.correctAnswer === "Richtig" })) };
  else if (record.module === "shreiben") record.payload = { istructions: "Schreiben Sie eine Beschwerde. Schreiben Sie mindestens 150 Wörter.", content: plainText(source.passage), tasks: plainText(source.writingPrompt), minimumWords: 150 };
  else {
    const numbers = new Map(source.questions.map((q, index) => [String(q.id), 21 + index]));
    if (numbers.size !== 10) throw new Error(`Expected ten grammar gaps: ${item.auditReference}`);
    const text = String(source.clozeText || "").replace(/\[\[\s*(\d+)\s*\]\]/g, (_, id) => {
      if (!numbers.has(id)) throw new Error(`Unknown grammar gap ${id}`);
      return `[[${numbers.get(id)}]]`;
    });
    record.payload = { instruction: "Wählen Sie für jede Lücke die passende Lösung.", text, blanks: source.questions.map(q => {
      if (!Array.isArray(q.options) || !q.options.includes(q.correctAnswer)) throw new Error(`Missing source answer option: ${item.auditReference} Q${q.id}`);
      return { id: numbers.get(String(q.id)), sourceQuestionId: q.id, options: q.options };
    }), answers: source.questions.map(q => ({ id: numbers.get(String(q.id)), answer: q.correctAnswer })) };
  }
  return record;
}
async function atomicWrite(file, value) {
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try { await fs.writeFile(temp, JSON.stringify(value, null, 2) + "\n"); await fs.rename(temp, file); }
  finally { await fs.unlink(temp).catch(() => {}); }
}
async function importLegacy({ databaseDir, sourceDir, plan = defaultPlan, dryRun = false }) {
  const databases = {}, baseline = {};
  const allFiles = (await fs.readdir(databaseDir)).filter(name => name.endsWith(".json") && !name.startsWith("exercise-"));
  for (const name of allFiles) {
    const raw = await fs.readFile(path.join(databaseDir, name)); baseline[name] = sha(raw);
    if (catalog.FILES.includes(name)) databases[name] = JSON.parse(raw);
  }
  const additionFile = path.join(databaseDir, "exercise-additions.b2.json"), nameFile = path.join(databaseDir, "exercise-names.b2.json");
  const readExisting = async (file, fallback) => {
    try { return JSON.parse(await fs.readFile(file, "utf8")); } catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
  };
  const additions = await readExisting(additionFile, { schemaVersion: 1, exercises: [] });
  const names = await readExisting(nameFile, { schemaVersion: 1, entries: [] });
  if (additions.schemaVersion !== 1 || names.schemaVersion !== 1) throw new Error("Unsupported sidecar schema");
  const sourceCache = new Map();
  async function source(id) {
    if (!sourceCache.has(id)) {
      let value;
      if (sourceDir) value = JSON.parse(await fs.readFile(path.join(sourceDir, `${id}.json`), "utf8"));
      else {
        const response = await fetch(`https://telc.site/data/quizzes/${encodeURIComponent(id)}.json`, { signal: AbortSignal.timeout(30000) });
        if (!response.ok) throw new Error(`Source ${id}: HTTP ${response.status}`);
        value = await response.json();
      }
      if (value.id !== id) throw new Error(`Source identity mismatch: ${id}`);
      sourceCache.set(id, value);
    }
    return sourceCache.get(id);
  }
  let added = 0, nameAdded = 0;
  for (const item of plan.items) {
    const record = convertItem(item, await source(item.source.quizId), plan.batchId);
    if (item.expectedSourceFingerprint && record.provenance.sourceFingerprint !== item.expectedSourceFingerprint) throw new Error(`Source changed since the reviewed plan: ${item.auditReference}`);
    const existing = additions.exercises.find(e => e.id === record.id) || catalog.mergedExercises(databases, { includeHidden: true }).find(e => e.id === record.id);
    if (existing) {
      if (existing.provenance.sourceFingerprint !== record.provenance.sourceFingerprint) throw new Error(`Changed source requires revision review: ${record.id}`);
      continue; // Preserve all manager edits, reviews and corrections on reruns.
    }
    if (additions.migrated?.some(entry => entry.id === record.id)) throw new Error(`Merged exercise was removed or moved; review before importing again: ${record.id}`);
    additions.exercises.push(record); added++;
  }
  for (const mapping of plan.nameMappings) {
    const resolved = catalog.resolveTarget(databases, mapping.target);
    if (!resolved) throw new Error(`Name target no longer exists: ${JSON.stringify(mapping.target)}`);
    const id = catalog.targetId(mapping.target);
    let entry = names.entries.find(e => e.id === id);
    const contentFingerprint = catalog.fingerprint(catalog.identityContent(mapping.target, resolved.record));
    if (mapping.expectedContentFingerprint && mapping.expectedContentFingerprint !== contentFingerprint) throw new Error(`Target content changed since the reviewed mapping: ${id}`);
    if (entry && entry.contentFingerprint !== contentFingerprint) throw new Error(`Changed target requires name review: ${id}`);
    if (entry?.sourceReferences.some(ref => ref.auditReference === mapping.source.auditReference)) continue;
    if (!entry) {
      entry = { id, target: mapping.target, subtitle: mapping.subtitle, contentFingerprint, names: [], sourceReferences: [] };
      names.entries.push(entry);
    }
    if (!entry.names.some(n => n.label === mapping.label)) { entry.names.push({ label: mapping.label, source: "telc.site", scope: mapping.target.kind === "theme" ? "theme" : "exercise" }); nameAdded++; }
    const sourceTitle = plainText(mapping.sourceExerciseTitle).replace(/^(?:Lesen Teil \d\s*[:–-]?|Schreiben\s*[:–-]?)\s*/i, "");
    if (sourceTitle && !["Schreiben: Beschwerdebrief", "Beschwerdebrief", "Aufgaben"].includes(sourceTitle) && !entry.names.some(n => n.label === sourceTitle)) entry.names.push({ label: sourceTitle, source: "telc.site", scope: "exercise" });
    if (!entry.sourceReferences.some(ref => ref.auditReference === mapping.source.auditReference)) entry.sourceReferences.push(mapping.source);
  }
  for (const [file, hash] of Object.entries(baseline)) if (sha(await fs.readFile(path.join(databaseDir, file))) !== hash) throw new Error(`Base changed during import: ${file}`);
  if (!dryRun) {
    if (added) await atomicWrite(additionFile, additions);
    // Only write if new aliases appeared; no rewrites on a repeat import.
    if (nameAdded) await atomicWrite(nameFile, names);
  }
  return { added, nameAdded, exerciseCount: additions.exercises.length, nameTargetCount: names.entries.length, unchangedBaseFiles: allFiles.length, dryRun };
}
if (require.main === module) {
  const args = process.argv.slice(2), arg = flag => args[args.indexOf(flag) + 1];
  const get = (flag, fallback) => args.includes(flag) ? arg(flag) : fallback;
  importLegacy({ databaseDir: get("--database-dir", path.resolve(__dirname, "../site/database")), sourceDir: get("--source-dir", undefined), dryRun: args.includes("--dry-run") }).then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { importLegacy, convertItem, plainText };
