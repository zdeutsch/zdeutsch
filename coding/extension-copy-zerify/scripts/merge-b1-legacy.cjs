const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../site/exercise-catalog');
const { validateExercise, validateNamesEntry } = require('../server/services/exerciseCatalogService');
const planDefault = require('./data/b1-legacy-plan.json');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const sourceFingerprint = value => sha(JSON.stringify(value));
function convert(item, source, batchId) {
  if (String(source.id) !== item.sourceId || sourceFingerprint(source) !== item.expectedSourceFingerprint) throw new Error(`Source changed since the comparison: ${item.sourceId}`);
  const numbers = new Map(source.questions.map((q, index) => [String(q.id), 31 + index]));
  const text = source.clozeText.replace(/\[\[\s*(\d+)\s*\]\]/g, (_, id) => {
    if (!numbers.has(id)) throw new Error(`Unknown source gap: ${id}`);
    return `[[${numbers.get(id)}]]`;
  });
  const record = {
    id: item.stableId, level: 'b1', module: 'lesen', partKey: item.partKey, title: item.title, names: item.names, enabled: true,
    provenance: { batchId, source: 'telc.site', sourceLevel: 'b1', quizId: item.sourceId, url: `https://telc.site/quiz/${item.sourceId}`, questionIds: source.questions.map(q => q.id), sourceFingerprint: item.expectedSourceFingerprint, audioUrls: [], sourceIssues: item.issues },
    review: { answerStatus: 'unverified', note: item.issues.join(' ') },
    relatedCurrentLocation: `lesen.json#/levels/b1/themes/${item.themeKey}/versions/default/lesen/parts/${item.partKey}`,
    payload: { instruction: 'Lesen Sie den Text und ergänzen Sie die Lücken. Jedes Wort kann nur einmal verwendet werden.',
      text, options: source.dragOptions, wordBank: source.dragOptions.map((text, index) => ({ id: String.fromCharCode(97 + index), text })),
      blanks: source.questions.map(q => ({ id: numbers.get(String(q.id)), sourceQuestionId: q.id, answer: q.correctAnswer })),
      answers: source.questions.map(q => ({ id: numbers.get(String(q.id)), answer: q.correctAnswer })) }
  };
  validateExercise(record);
  return record;
}
function mergeDocuments(databases, namesInput, manifestInput, plan, sources) {
  if (namesInput.schemaVersion !== 1 || manifestInput.schemaVersion !== 1 || !Array.isArray(namesInput.entries) || !Array.isArray(manifestInput.migrated) || !Array.isArray(manifestInput.exercises) || manifestInput.exercises.length) throw new Error('Unsupported B1 catalogue schema');
  const db = structuredClone(databases), names = structuredClone(namesInput), manifest = structuredClone(manifestInput);
  const imports = new Map(C.mergedExercises(db, { includeHidden: true }).map(item => [item.id, item]));
  const added = [], mappings = [];
  for (const item of plan.items) {
    const imported = convert(item, sources[item.sourceId], plan.batchId);
    if (imports.has(imported.id)) {
      if (imports.get(imported.id).provenance.sourceFingerprint !== imported.provenance.sourceFingerprint) throw new Error('Changed imported source requires review');
      continue;
    }
    if (manifest.migrated.some(row => row.id === imported.id)) throw new Error('A merged record is missing; review before importing again');
    const theme = db['lesen.json'].levels.b1.themes[item.themeKey];
    if (!theme || theme.versions[item.versionKey]) throw new Error('The B1 variant destination is unavailable');
    const content = C.applyMergedExercise({}, imported);
    theme.versions[item.versionKey] = { key: item.versionKey, label: `${item.title} · alte Fassung`, title: item.title,
      lesen: { partOrder: [item.partKey], counts: { parts: 1 }, parts: { [item.partKey]: {
        meta: { title: item.title, level: 'B1', partLabel: C.partLabel(imported), section: 'sprachbausteine', partNumber: 2, sourceUrl: imported.provenance.url }, content
      } } } };
    theme.versionOrder = [...(theme.versionOrder || Object.keys(theme.versions).filter(key => key !== item.versionKey)), item.versionKey];
    const target = { file: 'lesen.json', level: 'b1', kind: 'part', themeKey: item.themeKey, versionKey: item.versionKey, partKey: item.partKey };
    const entry = { id: imported.id, title: imported.title, target };
    added.push(entry); manifest.migrated.push(entry); imports.set(imported.id, imported);
  }
  for (const mapping of plan.nameMappings) {
    const resolved = C.resolveTarget(db, mapping.target);
    if (!resolved) throw new Error('Missing B1 name target');
    const id = C.targetId(mapping.target), fingerprint = C.fingerprint(C.identityContent(mapping.target, resolved.record));
    if (fingerprint !== mapping.expectedContentFingerprint) throw new Error(`Exercise changed since the comparison: ${id}`);
    let entry = names.entries.find(row => row.id === id);
    if (entry?.contentFingerprint !== undefined && entry.contentFingerprint !== fingerprint) throw new Error(`Name mapping needs review: ${id}`);
    if (entry?.sourceReferences.some(ref => ref.auditReference === mapping.source.auditReference)) continue;
    if (!entry) { entry = { id, target: mapping.target, subtitle: mapping.subtitle, contentFingerprint: fingerprint, names: [], sourceReferences: [] }; names.entries.push(entry); }
    const labels = [mapping.label, mapping.sourceExerciseTitle].filter(label => label && !/^Lesen Teil \d$/i.test(label));
    for (const label of labels) if (!entry.names.some(name => name.label === label)) entry.names.push({ label, source: 'telc.site', scope: 'exercise' });
    entry.sourceReferences.push(mapping.source); validateNamesEntry(entry, db); mappings.push(id);
  }
  if (added.length && db['lesen.json'].levels.b1.counts) {
    const versions = Object.values(db['lesen.json'].levels.b1.themes).flatMap(theme => Object.values(theme.versions));
    db['lesen.json'].levels.b1.counts.versions = versions.length;
    db['lesen.json'].levels.b1.counts.parts = versions.reduce((total, version) => total + Object.keys(version.lesen.parts).length, 0);
  }
  return { db, names, manifest, added, newMappings: mappings.length };
}
async function mergeB1({ databaseDir, sourceDir, plan = planDefault, backupDir, dryRun = false }) {
  const files = ['lesen.json', 'exercise-names.b1.json', 'exercise-additions.b1.json'];
  const fallback = { 'exercise-names.b1.json': { schemaVersion: 1, entries: [] }, 'exercise-additions.b1.json': { schemaVersion: 1, exercises: [], migrated: [] } };
  const raw = {}, db = {};
  for (const file of C.FILES) db[file] = JSON.parse(await fs.readFile(path.join(databaseDir, file), 'utf8'));
  for (const file of files) {
    try { raw[file] = await fs.readFile(path.join(databaseDir, file), 'utf8'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; raw[file] = null; }
  }
  const sources = {};
  for (const item of plan.items) {
    if (sourceDir) sources[item.sourceId] = JSON.parse(await fs.readFile(path.join(sourceDir, `${item.sourceId}.json`), 'utf8'));
    else { const response = await fetch(`https://telc.site/data/quizzes/${item.sourceId}.json`, { signal: AbortSignal.timeout(30000) }); if (!response.ok) throw new Error(`Source ${item.sourceId}: ${response.status}`); sources[item.sourceId] = await response.json(); }
  }
  const result = mergeDocuments(db, JSON.parse(raw[files[1]] || JSON.stringify(fallback[files[1]])), JSON.parse(raw[files[2]] || JSON.stringify(fallback[files[2]])), plan, sources);
  const outputs = { 'lesen.json': result.db['lesen.json'], [files[1]]: result.names, [files[2]]: result.manifest };
  const changed = files.filter(file => file === 'lesen.json' ? result.added.length : file === files[1] ? result.newMappings || raw[file] === null : result.added.length || raw[file] === null);
  const report = { added: result.added, newMappings: result.newMappings, nameTargets: result.names.entries.length, alreadyMerged: result.manifest.migrated.length - result.added.length, changedFiles: changed, dryRun };
  if (dryRun || !changed.length) return report;
  if (!backupDir) throw new Error('A backup directory is required');
  await fs.mkdir(backupDir, { recursive: true });
  for (const file of changed) if (raw[file] !== null) await fs.writeFile(path.join(backupDir, file), raw[file], { flag: 'wx' });
  await fs.writeFile(path.join(backupDir, 'merge-report.json'), JSON.stringify({ ...report, missingBefore: files.filter(file => raw[file] === null), beforeHashes: Object.fromEntries(files.map(file => [file, raw[file] === null ? null : sha(raw[file])])) }, null, 2) + '\n', { flag: 'wx' });
  const pending = [], written = [];
  try {
    for (const file of changed) { const temporary = path.join(databaseDir, `${file}.${crypto.randomUUID()}.tmp`); const bytes = JSON.stringify(outputs[file], null, 2) + '\n'; await fs.writeFile(temporary, bytes); pending.push({ file, temporary, bytes }); }
    for (const item of pending) {
      const latest = await fs.readFile(path.join(databaseDir, item.file), 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (latest !== raw[item.file]) throw new Error(`Concurrent database change: ${item.file}`);
      await fs.rename(item.temporary, path.join(databaseDir, item.file)); written.push(item);
    }
  } catch (error) {
    for (const item of written) {
      const current = await fs.readFile(path.join(databaseDir, item.file), 'utf8');
      if (current !== item.bytes) continue; // Never restore over another writer's later changes.
      if (raw[item.file] === null) await fs.unlink(path.join(databaseDir, item.file));
      else await fs.writeFile(path.join(databaseDir, item.file), raw[item.file]);
    }
    throw error;
  } finally { for (const item of pending) await fs.unlink(item.temporary).catch(() => {}); }
  return report;
}
if (require.main === module) {
  const args = process.argv.slice(2), get = (flag, fallback) => args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback;
  mergeB1({ databaseDir: get('--database-dir', path.resolve(__dirname, '../site/database')), sourceDir: get('--source-dir', undefined), backupDir: get('--backup-dir', undefined), dryRun: args.includes('--dry-run') }).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
module.exports = { convert, mergeDocuments, mergeB1 };
