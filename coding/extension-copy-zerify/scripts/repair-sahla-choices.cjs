const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { isDeepStrictEqual: equal } = require('node:util');
const C = require('../site/exercise-catalog');
const defaultPlan = require('./data/sahla-choice-repair-2026-10-22.json');
defaultPlan.extraRepairs = require('./data/sahla-choice-extra-repair-2026-10-22.json').items;
const sha = value => createHash('sha256').update(value).digest('hex');
const key = value => String(value || '').normalize('NFC').toLocaleLowerCase('de-DE').replace(/ß/g, 'ss').replace(/\s+/g, ' ').trim();
const text = word => typeof word === 'string' ? word : word?.text || '';

function mergeChoices(record, item) {
  const existing = record.options || [], answers = record.answers || [];
  const known = [...existing, ...answers.map(a => a.answer)];
  const uppercase = known.filter(w => w && w === w.toLocaleUpperCase('de-DE')).length > known.length / 2;
  const sources = item.source.options.map(choice => {
    const corrected = item.preservedSourceSpellings?.[key(choice.text)] || choice.text;
    const preserved = known.find(word => key(word) === key(corrected));
    return { ...choice, text: preserved || (uppercase ? corrected.toLocaleUpperCase('de-DE') : corrected) };
  });
  const options = [...existing];
  for (const choice of sources) if (!options.some(w => key(w) === key(choice.text))) options.push(choice.text);
  const wordBank = options.map((word, index) => {
    const previous = (record.wordBank || []).find(w => key(text(w)) === key(word));
    const source = sources.find(w => key(w.text) === key(word));
    return { ...(typeof previous === 'object' ? previous : {}), id: previous?.id || source?.id || `choice-${index + 1}`, text: word };
  });
  if (equal(options, existing) && equal(wordBank, record.wordBank)) return null;
  if (sha(record.text || '') !== item.expectedTextSha256 || !equal(answers, item.expectedAnswers)) {
    throw new Error(`Exercise changed since source review: ${JSON.stringify(item.target)}`);
  }
  if (sources.length !== 15 || new Set(sources.map(w => key(w.text))).size !== 15) throw new Error('Reviewed source must contain 15 distinct choices');
  if (answers.some(a => !options.includes(a.answer))) throw new Error('A stored answer would not be selectable');
  if (!existing.every(word => options.includes(word))) throw new Error('An existing choice would be removed');
  return { options, wordBank };
}

function resolve(doc, target) {
  return doc.levels?.[target.level]?.themes?.[target.themeKey]?.versions?.[target.versionKey]?.lesen?.parts?.[target.partKey]?.content;
}
function mirror(doc, target) {
  const theme = doc.levels[target.level].themes[target.themeKey];
  return theme.defaultVersion === target.versionKey ? theme.lesen?.parts?.[target.partKey]?.content : null;
}
function patchReviewedExtra(record, item) {
  const { mode, afterOptions } = item;
  const before = mode === 'restore-duplicate-choice' ? record.blanks.find(b => b.id === item.blankId)?.options : record.options;
  if (equal(before, afterOptions)) return false;
  if (sha(record.text || '') !== item.expectedTextSha256 || !equal(record.answers, item.expectedAnswers)) throw new Error('Extra exercise changed since source review');
  if (!equal(before, mode === 'restore-duplicate-choice' ? item.beforeBlank.options : item.beforeOptions)) throw new Error('Choice list changed since source review');
  if (mode === 'restore-duplicate-choice') {
    if (new Set(afterOptions).size !== 3) throw new Error('Expected three distinct choices');
    const sourceAnswer = item.source.question.options.find(o => o.id === item.source.question.antwort)?.text.trim();
    const answer = record.answers.find(a => a.id === item.blankId)?.answer;
    if (key(sourceAnswer) !== key(answer) || !afterOptions.includes(answer)) throw new Error('Source question has a different answer');
    record.blanks.find(b => b.id === item.blankId).options = [...afterOptions];
  } else {
    const sourceKeys = new Set(item.source.options.map(o => key(o.text)));
    if (afterOptions.length !== 15 || new Set(afterOptions.map(key)).size !== 15 || afterOptions.some(o => !sourceKeys.has(key(o)))) throw new Error('Replacement choices disagree with reviewed source');
    if (record.answers.some(a => !afterOptions.includes(a.answer))) throw new Error('Replacement would make an answer unselectable');
    record.options = [...afterOptions];
    record.wordBank = afterOptions.map((word, i) => {
      const old = mode === 'match-answer-casing' ? (record.wordBank || []).find(o => key(text(o)) === key(word)) : null;
      const source = item.source.options.find(o => key(o.text) === key(word));
      return { ...(typeof old === 'object' && old ? old : {}), id: old?.id || source?.id || `choice-${i + 1}`, text: word };
    });
  }
  return true;
}
function repairDocument(input, nameIndexes, plan = defaultPlan) {
  const document = structuredClone(input), indexes = structuredClone(nameIndexes), changes = [];
  for (const item of plan.items) {
    const record = resolve(document, item.target);
    if (!record) throw new Error(`Missing reviewed target: ${JSON.stringify(item.target)}`);
    const patch = mergeChoices(record, item);
    if (!patch) continue;
    const root = mirror(document, item.target);
    if (root && (root.text !== record.text || !equal(root.answers, record.answers))) throw new Error('Default mirror has different text or corrections');
    const previousCount = (record.options || []).length;
    Object.assign(record, structuredClone(patch));
    if (root) Object.assign(root, structuredClone(patch));
    changes.push({ type: previousCount < patch.options.length ? 'missing choices restored' : 'word-bank metadata repaired', target: item.target,
      before: previousCount, after: patch.options.length, added: patch.options.filter(w => !item.beforeOptions.includes(w)),
      source: { collection: item.source.collection, recordId: item.source.recordId, pointer: item.source.pointer, title: item.source.title },
      ...(item.variantNote ? { note: item.variantNote } : {}) });
  }
  for (const item of plan.extraRepairs || []) {
    const record = resolve(document, item.target);
    if (!record) throw new Error('Reviewed extra target missing');
    if (!patchReviewedExtra(record, item)) continue;
    // Old root projections can contain older keys. Casing repairs follow the active version only.
    const root = item.mode === 'match-answer-casing' ? null : mirror(document, item.target);
    if (root) patchReviewedExtra(root, item);
    changes.push({ type: item.mode, target: item.target, before: item.mode === 'restore-duplicate-choice' ? item.beforeBlank.options : item.beforeOptions,
      after: item.afterOptions, source: { collection: item.source.collection, recordId: item.source.recordId, pointer: item.source.pointer, title: item.source.title } });
  }
  const item = plan.advert, record = resolve(document, item.target), source = item.source.ad;
  if (!record) throw new Error('Missing TAMARA advert target');
  function fixAdvert(content) {
    const ad = content.ads.find(a => a.id === 'G');
    if (!ad) throw new Error('TAMARA advert G missing');
    if (ad.text === source.text) return false;
    if (ad.text !== item.before.text) throw new Error('TAMARA advert G was edited after the review');
    ad.text = source.text;
    ad.translated = source.fazit;
    const answer = content.answers.find(a => a.situationId === item.situationId);
    if (!answer || answer.adId !== 'G') throw new Error('Unexpected TAMARA correction; preserving it');
    if (Array.isArray(answer.highlights)) {
      answer.highlights = [
        ...['Nordsee', 'direktem Zugang zum Strand'].map(value => {
          const start = source.text.indexOf(value);
          if (start < 0) throw new Error('Advert highlight not found');
          return { source: 'ad', start, end: start + value.length, text: value };
        }),
        ...answer.highlights.filter(h => h.source !== 'ad')
      ];
    }
    return true;
  }
  if (fixAdvert(record)) {
    const root = mirror(document, item.target); if (root) fixAdvert(root);
    changes.push({ type: 'TAMARA advert G restored', target: item.target, source: { collection: item.source.collection, recordId: item.source.recordId, pointer: item.source.pointer } });
  }
  const changedIds = new Set(changes.map(c => C.targetId(c.target)));
  const refreshedNames = [], staleNames = [];
  for (const [filename, index] of Object.entries(indexes)) for (const entry of index.entries || []) {
    if (!changedIds.has(C.targetId(entry.target))) continue;
    const before = resolve(input, entry.target), after = resolve(document, entry.target);
    const originalFingerprint = C.fingerprint(C.identityContent(entry.target, before));
    if (entry.contentFingerprint !== originalFingerprint) { staleNames.push({ filename, id: entry.id }); continue; }
    entry.contentFingerprint = C.fingerprint(C.identityContent(entry.target, after));
    refreshedNames.push({ filename, id: entry.id });
  }
  return { document, indexes, changes, refreshedNames, staleNames };
}

async function repairDatabase({ databaseDir = path.resolve(__dirname, '../site/database'), backupDir, dryRun = false, plan = defaultPlan } = {}) {
  const filenames = ['lesen.json', 'exercise-names.b1.json', 'exercise-names.b2.json'];
  const bytes = Object.fromEntries(await Promise.all(filenames.map(async f => [f, await fs.readFile(path.join(databaseDir, f))])));
  const original = JSON.parse(bytes['lesen.json']);
  const names = Object.fromEntries(filenames.slice(1).map(f => [f, JSON.parse(bytes[f])]));
  const result = repairDocument(original, names, plan);
  const report = { batchId: plan.batchId, archiveSha256: plan.archiveSha256, dryRun,
    changes: result.changes, refreshedNames: result.refreshedNames, staleNames: result.staleNames, files: [] };
  if (!result.changes.length) return report;
  const documents = { 'lesen.json': result.document, ...result.indexes };
  const changedFiles = filenames.filter(f => !equal(JSON.parse(bytes[f]), documents[f]));
  for (const f of changedFiles) report.files.push({ file: f, beforeSha256: sha(bytes[f]), afterSha256: sha(JSON.stringify(documents[f], null, 2) + '\n') });
  if (dryRun) return report;
  if (!backupDir) throw new Error('An exact backup directory is required');
  await fs.mkdir(backupDir, { recursive: true });
  for (const f of changedFiles) await fs.writeFile(path.join(backupDir, f), bytes[f], { flag: 'wx' });
  for (const f of changedFiles) if (!equal(bytes[f], await fs.readFile(path.join(databaseDir, f)))) throw new Error('Database changed during repair');
  const temporary = [];
  try {
    for (const f of changedFiles) {
      const temp = path.join(databaseDir, `${f}.${randomUUID()}.tmp`);
      await fs.writeFile(temp, JSON.stringify(documents[f], null, 2) + '\n'); temporary.push([temp, path.join(databaseDir, f)]);
    }
    await fs.writeFile(path.join(backupDir, 'repair-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    for (const [temp, destination] of temporary) await fs.rename(temp, destination);
  } finally { for (const [temp] of temporary) await fs.unlink(temp).catch(() => {}); }
  return report;
}
if (require.main === module) {
  const args = process.argv.slice(2), at = flag => args[args.indexOf(flag) + 1];
  repairDatabase({ dryRun: args.includes('--dry-run'), ...(args.includes('--backup-dir') ? { backupDir: path.resolve(at('--backup-dir')) } : {}) })
    .then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e); process.exitCode = 1; });
}
module.exports = { key, mergeChoices, repairDocument, repairDatabase };
