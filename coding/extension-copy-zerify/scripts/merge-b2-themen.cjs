const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash, randomUUID } = require("node:crypto");
const C = require("../site/exercise-catalog");
const { validateExercise } = require("../server/services/exerciseCatalogService");
const sha = raw => createHash("sha256").update(raw).digest("hex");
const FILES = ["lesen.json", "horen-codes.json", "shreiben.json", "exercise-additions.b2.json"];

function mergeDocuments(input, additions) {
  const db = structuredClone(input), remaining = structuredClone(additions);
  const existing = new Map(C.mergedExercises(db, { includeHidden: true }).map(item => [item.id, item]));
  const migrated = [...(remaining.migrated || [])];
  const locations = [];
  for (const item of remaining.exercises) {
    validateExercise(item);
    if (existing.has(item.id)) throw new Error(`Duplicate imported exercise: ${item.id}`);
    let target, record;
    if (item.module === "lesen") {
      const level = db["lesen.json"].levels.b2;
      const related = item.relatedCurrentLocation?.match(/^lesen\.json#\/levels\/b2\/themes\/([^/]+)\/versions\/[^/]+\/lesen\/parts\/sprachbausteine-1$/);
      const themeKey = related ? related[1] : `telc-${item.provenance.quizId.replaceAll("_", "-")}`;
      const versionKey = related ? `telc-${item.provenance.quizId.replaceAll("_", "-")}` : "default";
      let theme = level.themes[themeKey];
      if (!related) {
        if (theme) throw new Error(`Theme key already exists: ${themeKey}`);
        theme = level.themes[themeKey] = { id: themeKey, title: item.title, defaultVersion: "default", versionOrder: ["default"], versions: {} };
        level.themeOrder.push(themeKey);
      }
      if (!theme || theme.versions[versionKey]) throw new Error(`Variant destination is unavailable: ${themeKey}/${versionKey}`);
      record = C.applyMergedExercise({}, item);
      theme.versions[versionKey] = { key: versionKey, label: related ? `${item.title} · alte Fassung` : "Default", title: item.title, lesen: {
        partOrder: [item.partKey], counts: { parts: 1 }, parts: { [item.partKey]: {
          meta: { title: item.title, level: "B2", partLabel: C.partLabel(item), section: "sprachbausteine", partNumber: 1, sourceUrl: item.provenance.url }, content: record
        } }
      } };
      if (related) theme.versionOrder = [...(theme.versionOrder || Object.keys(theme.versions).filter(key => key !== versionKey)), versionKey];
      target = { file: "lesen.json", level: "b2", kind: "part", themeKey, versionKey, partKey: item.partKey };
    } else if (item.module === "horen") {
      const part = db["horen-codes.json"].levels.b2.themes["horen-b2"]["hören"].parts[item.partKey];
      if (!part?.content?.topics) throw new Error("The existing Hören Codes collection is missing");
      record = C.applyMergedExercise({ id: item.id }, item);
      part.content.topics.push(record);
      target = { file: "horen-codes.json", level: "b2", kind: "topic", themeKey: "horen-b2", partKey: item.partKey, topicId: item.id };
    } else {
      const tasks = db["shreiben.json"].levels.b2.tasks;
      target = { file: "shreiben.json", level: "b2", kind: "task", index: tasks.length };
      record = C.applyMergedExercise({}, item);
      tasks.push(record);
    }
    const resolved = C.resolveTarget(db, target);
    if (resolved?.record !== record) throw new Error(`Merge destination cannot be resolved: ${item.id}`);
    existing.set(item.id, item);
    const entry = { id: item.id, title: item.title, target };
    locations.push(entry); migrated.push(entry);
  }
  remaining.exercises = [];
  remaining.migrated = migrated;
  return { databases: db, additions: remaining, locations };
}

async function mergeThemen({ databaseDir, backupDir, dryRun = false }) {
  const raw = Object.fromEntries(await Promise.all(FILES.map(async file => [file, await fs.readFile(path.join(databaseDir, file), "utf8")])));
  const input = Object.fromEntries(FILES.slice(0, 3).map(file => [file, JSON.parse(raw[file])]));
  const result = mergeDocuments(input, JSON.parse(raw[FILES[3]]));
  if (!result.locations.length) return { merged: 0, alreadyMerged: result.additions.migrated?.length || 0 };
  const report = { merged: result.locations.length, locations: result.locations, originalHashes: Object.fromEntries(FILES.map(file => [file, sha(raw[file])])) };
  if (dryRun) return report;
  if (!backupDir) throw new Error("A backup directory is required for the merge");
  await fs.mkdir(backupDir, { recursive: true });
  for (const file of FILES) await fs.writeFile(path.join(backupDir, file), raw[file], { flag: "wx" });
  await fs.writeFile(path.join(backupDir, "merge-report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  const outputs = { ...result.databases, "exercise-additions.b2.json": result.additions };
  const staged = [];
  try {
    for (const file of FILES) {
      if (sha(await fs.readFile(path.join(databaseDir, file))) !== report.originalHashes[file]) throw new Error(`Database changed during merge: ${file}`);
      const temporary = path.join(databaseDir, `${file}.${randomUUID()}.tmp`);
      await fs.writeFile(temporary, JSON.stringify(outputs[file], null, 2) + "\n");
      staged.push([file, temporary]);
    }
    for (const [file, temporary] of staged) await fs.rename(temporary, path.join(databaseDir, file));
  } catch (error) {
    // Restore only files this operation already replaced, using the exact pre-merge bytes.
    for (const [file, temporary] of staged) {
      const pending = await fs.access(temporary).then(() => true, () => false);
      if (!pending) await fs.writeFile(path.join(databaseDir, file), raw[file]);
    }
    throw error;
  } finally { for (const [, temporary] of staged) await fs.unlink(temporary).catch(() => {}); }
  return report;
}
if (require.main === module) {
  const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
  mergeThemen({ databaseDir: args.includes("--database-dir") ? value("--database-dir") : path.resolve(__dirname, "../site/database"), backupDir: args.includes("--backup-dir") ? path.resolve(value("--backup-dir")) : undefined, dryRun: args.includes("--dry-run") }).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { mergeDocuments, mergeThemen };
