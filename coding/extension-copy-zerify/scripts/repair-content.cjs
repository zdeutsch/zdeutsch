const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { isDeepStrictEqual: equal } = require('node:util');
const C = require('../site/exercise-catalog');
const defaultPlan = require('./data/content-repair-2026-10-22.json');
const sha = value => createHash('sha256').update(value).digest('hex');

function location(document, pointer) {
  const keys = pointer.slice(1).split('/').map(k => k.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (keys.some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) throw new Error('Unsafe repair path');
  const key = keys.pop(); let parent = document;
  for (const k of keys) {
    if (!parent || !Object.hasOwn(parent, k)) throw new Error(`Missing repair path: ${pointer}`);
    parent = parent[k];
  }
  return { parent, key, exists: Object.hasOwn(parent, key) };
}

function applyPatch(document, patch) {
  if (!/^\/levels\/(b1|b2)\//.test(patch.path)) throw new Error('Repair outside B1/B2 scope');
  const { parent, key, exists } = location(document, patch.path);
  if (patch.operation === 'remove' && !exists) return false;
  if (patch.operation !== 'remove' && exists && equal(parent[key], patch.after)) return false;
  if (patch.operation === 'add' ? exists : !exists || !equal(parent[key], patch.before)) {
    throw new Error(`Content changed since review: ${patch.path}`);
  }
  if (patch.operation === 'remove') delete parent[key];
  else if (['add', 'replace'].includes(patch.operation)) parent[key] = structuredClone(patch.after);
  else throw new Error(`Unknown repair operation: ${patch.operation}`);
  return true;
}

function resolve(document, target) {
  return C.resolveTarget({ 'lesen.json': document }, target)?.record;
}

function repairDocument(input, nameIndexes, plan = defaultPlan) {
  const document = structuredClone(input), indexes = structuredClone(nameIndexes), changes = [];
  for (const item of plan.items) {
    let changedFields = 0;
    for (const patch of item.patches) if (applyPatch(document, patch)) changedFields++;
    if (!changedFields) continue;
    const content = resolve(document, item.target);
    if (content && !C.hasAnswerKey({ module: 'lesen', payload: content })) throw new Error(`Unusable repaired key: ${item.target.themeKey}/${item.target.versionKey}/${item.target.partKey}`);
    if (content && item.target.partKey === 'sprachbausteine-2' && (content.options.length !== 15 || new Set(content.options).size !== 15)) throw new Error('Repaired bank must have 15 distinct choices');
    changes.push({ title: item.title, target: item.target, reason: item.reason, source: item.source, changedFields });
  }
  const changedIds = new Set(changes.map(item => C.targetId(item.target)));
  const refreshedNames = [], staleNames = [];
  for (const [file, index] of Object.entries(indexes)) for (const entry of index.entries || []) {
    if (!changedIds.has(C.targetId(entry.target))) continue;
    const original = resolve(input, entry.target), updated = resolve(document, entry.target);
    if (!original || !updated) throw new Error('Repair would remove a named exercise');
    const originalFingerprint = C.fingerprint(C.identityContent(entry.target, original));
    if (entry.contentFingerprint !== originalFingerprint) { staleNames.push({ file, id: entry.id }); continue; }
    const nextFingerprint = C.fingerprint(C.identityContent(entry.target, updated));
    if (entry.contentFingerprint === nextFingerprint) continue;
    entry.contentFingerprint = nextFingerprint;
    refreshedNames.push({ file, id: entry.id });
  }
  return { document, indexes, changes, refreshedNames, staleNames };
}

async function repairDatabase({ databaseDir = path.resolve(__dirname, '../site/database'), backupDir, dryRun = false, plan = defaultPlan } = {}) {
  const files = ['lesen.json', 'exercise-names.b1.json', 'exercise-names.b2.json'];
  const original = {};
  for (const file of files) original[file] = await fs.readFile(path.join(databaseDir, file));
  const indexes = Object.fromEntries(files.slice(1).map(f => [f, JSON.parse(original[f])]));
  const result = repairDocument(JSON.parse(original['lesen.json']), indexes, plan);
  const documents = { 'lesen.json': result.document, ...result.indexes };
  const changedFiles = files.filter(file => !equal(JSON.parse(original[file]), documents[file]));
  const report = { batchId: plan.batchId, dryRun, changes: result.changes, refreshedNames: result.refreshedNames, staleNames: result.staleNames,
    deferred: plan.deferred, files: changedFiles.map(file => ({ file, beforeSha256: sha(original[file]), afterSha256: sha(JSON.stringify(documents[file], null, 2) + '\n') })) };
  if (dryRun || !changedFiles.length) return report;
  if (!backupDir) throw new Error('An exact backup directory is required');
  await fs.mkdir(backupDir, { recursive: true });
  for (const file of changedFiles) await fs.writeFile(path.join(backupDir, file), original[file], { flag: 'wx' });
  for (const file of files) if (sha(await fs.readFile(path.join(databaseDir, file))) !== sha(original[file])) throw new Error('Database changed during repair');
  const temporary = [];
  try {
    for (const file of changedFiles) {
      const tmp = path.join(databaseDir, `${file}.${randomUUID()}.tmp`);
      await fs.writeFile(tmp, JSON.stringify(documents[file], null, 2) + '\n');
      temporary.push([tmp, path.join(databaseDir, file)]);
    }
    await fs.writeFile(path.join(backupDir, 'repair-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    for (const [tmp, destination] of temporary) await fs.rename(tmp, destination);
  } finally { for (const [tmp] of temporary) await fs.unlink(tmp).catch(() => {}); }
  return report;
}

if (require.main === module) {
  const args = process.argv.slice(2), at = flag => args[args.indexOf(flag) + 1];
  repairDatabase({ dryRun: args.includes('--dry-run'), ...(args.includes('--backup-dir') ? { backupDir: path.resolve(at('--backup-dir')) } : {}) })
    .then(r => console.log(JSON.stringify(r, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { applyPatch, repairDocument, repairDatabase };
