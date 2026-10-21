const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const C = require('../site/exercise-catalog');
const defaultPlan = require('./data/sahla-b2-reading-2026-10-21.json');
const sha = value => createHash('sha256').update(value).digest('hex');
const sourceHash = source => sha(JSON.stringify(source));
const labels = { 'teil-1': 'Lesen Teil 1', 'teil-2': 'Lesen Teil 2', 'teil-3': 'Lesen Teil 3', 'sprachbausteine-1': 'Sprachbausteine Teil 1', 'sprachbausteine-2': 'Sprachbausteine Teil 2' };

function annotations(row) {
  return {
    ...(row.tr ? { translated: row.tr } : {}),
    ...(row.fazit ? { summary: row.fazit } : {}),
    ...(row.begründung ? { explanation: row.begründung } : {}),
    ...(row.Keywords?.length ? { keywords: row.Keywords } : {})
  };
}
function convert(item, plan = defaultPlan) {
  const s = item.source, part = item.partKey;
  let content;
  if (part === 'teil-1') {
    content = { title: s.titel, instruction: 'Lesen Sie die Texte und ordnen Sie jedem Text die passende Überschrift zu.',
      texts: s.Texte.map(q => ({ id: q.id, text: q.text, ...annotations(q) })),
      headlines: s.Überschriften.map(q => ({ id: q.id.toUpperCase(), text: q.text, ...annotations(q) })),
      answers: s.Texte.map(q => ({ textId: q.id, headlineId: q.antwort.toUpperCase(), highlights: [], ...annotations(q) })) };
  } else if (part === 'teil-2') {
    const paragraphs = s.text.map(q => q.para);
    content = { title: s.titel, instruction: 'Lesen Sie den Text und wählen Sie für jede Aufgabe die passende Lösung.',
      passage: { title: s.titel, text: paragraphs.join('\n\n'), paragraphs, translated: s.text.map(q => q.tr || '') },
      questions: s.fragen.map(q => ({ id: q.id, prompt: q.text, options: q.options.map(o => ({ id: o.id, text: o.text, ...annotations(o) })),
        answerId: q.antwort, answerText: q.options.find(o => o.id === q.antwort)?.text, highlights: [], ...annotations(q) })) };
  } else if (part === 'teil-3') {
    content = { title: s.titel, instruction: 'Ordnen Sie jeder Situation eine passende Anzeige zu. Wählen Sie X, wenn keine Anzeige passt.',
      situations: s.situationen.map(q => ({ id: q.id, text: q.text, ...annotations(q) })),
      ads: [...s.anzeigen.map(q => ({ id: q.id.toUpperCase(), text: q.text, ...annotations(q) })), { id: 'X', text: 'Keine passende Anzeige', translated: 'لا يوجد إعلان مناسب' }],
      answers: s.situationen.map(q => ({ situationId: q.id, adId: q.antwort.toUpperCase(), highlights: [], ...annotations(q) })) };
  } else {
    const occurrences = [...s.text.matchAll(/(?:_+|\.+)?\(\s*(\d+)\s*\)(?:_+|\.+)?/g)];
    const sourceIds = [...new Set(occurrences.map(m => Number(m[1])))];
    if (sourceIds.length !== 10) throw new Error(`Expected ten distinct source gaps: ${s.titel}`);
    const ids = new Map(sourceIds.map((id, index) => [id, (part === 'sprachbausteine-1' ? 21 : 31) + index]));
    const text = s.text.replace(/(?:_+|\.+)?\(\s*(\d+)\s*\)(?:_+|\.+)?/g, (_, id) => `[[${ids.get(Number(id))}]]`);
    content = { title: s.titel, instruction: part === 'sprachbausteine-1' ? 'Wählen Sie für jede Lücke die passende Lösung.' : 'Ergänzen Sie die Lücken. Jedes Wort kann nur einmal verwendet werden.', text,
      ...(s.tr ? { translated: s.tr } : {}) };
    if (part === 'sprachbausteine-1') {
      content.blanks = s.fragen.map(q => ({ id: ids.get(Number(q.id)), sourceQuestionId: q.id, options: q.options.map(o => o.text),
        optionDetails: q.options.map(o => ({ ...o, ...annotations(o) })), ...annotations(q) }));
      content.answers = s.fragen.map(q => ({ id: ids.get(Number(q.id)), answer: q.options.find(o => o.id === q.antwort)?.text, ...annotations(q) }));
    } else {
      content.wordBank = s.options.map(o => ({ id: o.id, text: o.text, ...annotations(o) }));
      content.options = s.options.map(o => o.text);
      content.blanks = sourceIds.map(sourceId => ({ id: ids.get(sourceId), sourceQuestionId: sourceId }));
      content.answers = sourceIds.map(sourceId => {
        const matches = s.options.filter(o => Number(o.antwort) === sourceId);
        if (matches.length !== 1) throw new Error(`Invalid source answer mapping: ${s.titel}/${sourceId}`);
        return { id: ids.get(sourceId), answer: matches[0].text, ...annotations(matches[0]) };
      });
    }
    const answerMap = new Map(content.answers.map(q => [String(q.id), q.answer]));
    content.segments = []; let cursor = 0;
    for (const match of text.matchAll(/\[\[(\d+)\]\]/g)) {
      if (match.index > cursor) content.segments.push({ type: 'text', value: text.slice(cursor, match.index) });
      content.segments.push({ type: 'luecke', id: Number(match[1]), answer: answerMap.get(match[1]) });
      cursor = match.index + match[0].length;
    }
    if (cursor < text.length) content.segments.push({ type: 'text', value: text.slice(cursor) });
  }
  if (!C.hasAnswerKey({ module: 'lesen', payload: content })) throw new Error(`Unusable source answer key: ${s.titel}`);
  content.sourceImport = { id: `sahla:${item.collection}:${s._id}`, names: [s.titel], enabled: true,
    provenance: { batchId: plan.batchId, source: 'sahlab2.online', collection: item.collection, recordId: s._id, sourcePointer: item.pointer,
      archiveSha256: plan.archiveSha256, sourceFingerprint: sourceHash(s), sourceNote: s.note || '' },
    review: { answerStatus: 'unverified', contentStatus: item.themeKey === 'sahla-b2-garten-in-der-stadt' ? 'incomplete' : 'imported', note: s.note || '' } };
  return { meta: { title: s.titel, level: 'B2', partLabel: labels[part], section: part.startsWith('sprachbausteine') ? 'sprachbausteine' : 'lesen',
    partNumber: Number(part.at(-1)), sourceUrl: 'https://www.sahlab2.online' }, content };
}

function signature(partKey, record) {
  return C.fingerprint(C.normalize(JSON.stringify(C.identityContent({ file: 'lesen.json', partKey }, record))));
}
function mergeDocument(input, plan = defaultPlan) {
  const document = structuredClone(input), level = document.levels.b2, added = [], existing = [], preserved = [];
  const records = Object.values(level.themes).flatMap(t => Object.values(t.versions || {}).flatMap(v => Object.entries(v.lesen?.parts || {}).map(([partKey, p]) => ({ partKey, record: p.content }))));
  for (const item of plan.items) {
    const sourceId = `sahla:${item.collection}:${item.source._id}`;
    const imported = records.find(e => e.record.sourceImport?.id === sourceId);
    if (imported) {
      if (imported.record.sourceImport.provenance.sourceFingerprint !== sourceHash(item.source)) throw new Error(`Changed source needs review: ${sourceId}`);
      preserved.push(sourceId); continue;
    }
    if (level.themes[item.themeKey]) throw new Error(`Destination already exists: ${item.themeKey}`);
    const part = convert(item, plan);
    const duplicate = records.find(e => e.partKey === item.partKey && signature(e.partKey, e.record) === signature(item.partKey, part.content));
    if (duplicate) { existing.push(sourceId); continue; }
    const version = { key: 'default', label: 'Default', title: item.source.titel, lesen: { partOrder: [item.partKey], counts: { parts: 1 }, parts: { [item.partKey]: part } } };
    level.themes[item.themeKey] = { id: item.themeKey, title: item.source.titel, defaultVersion: 'default', versionOrder: ['default'], versions: { default: version } };
    level.themeOrder.push(item.themeKey); records.push({ partKey: item.partKey, record: part.content });
    added.push({ id: sourceId, title: item.source.titel, target: { file: 'lesen.json', level: 'b2', kind: 'part', themeKey: item.themeKey, versionKey: 'default', partKey: item.partKey },
      url: `lesen.html?level=b2&theme=${item.themeKey}&version=default&part=${item.partKey}`, scorable: part.content.sourceImport.review.contentStatus !== 'incomplete' });
  }
  if (added.length) {
    const themes = Object.values(level.themes), versions = themes.flatMap(t => Object.values(t.versions || {}));
    level.counts = { ...level.counts, themes: themes.length, versions: versions.length, parts: versions.reduce((sum, v) => sum + Object.keys(v.lesen?.parts || {}).length, 0) };
  }
  return { document, added, existing, preserved };
}
async function importReading({ databaseFile = path.resolve(__dirname, '../site/database/lesen.json'), backupDir, dryRun = false, plan = defaultPlan } = {}) {
  const before = await fs.readFile(databaseFile), result = mergeDocument(JSON.parse(before), plan);
  const report = { batchId: plan.batchId, added: result.added, alreadyPresent: result.existing, preservedImports: result.preserved,
    beforeSha256: sha(before), counts: result.document.levels.b2.counts, dryRun };
  if (dryRun || !result.added.length) return report;
  if (!backupDir) throw new Error('An exact backup directory is required');
  await fs.mkdir(backupDir, { recursive: true });
  await fs.writeFile(path.join(backupDir, 'lesen.json'), before, { flag: 'wx' });
  const temporary = `${databaseFile}.${randomUUID()}.tmp`;
  try {
    const bytes = JSON.stringify(result.document, null, 2) + '\n';
    await fs.writeFile(temporary, bytes);
    if (sha(await fs.readFile(databaseFile)) !== report.beforeSha256) throw new Error('Database changed during import');
    report.afterSha256 = sha(bytes);
    await fs.writeFile(path.join(backupDir, 'import-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    await fs.rename(temporary, databaseFile);
  } finally { await fs.unlink(temporary).catch(() => {}); }
  return report;
}
if (require.main === module) {
  const args = process.argv.slice(2), at = flag => args[args.indexOf(flag) + 1];
  importReading({ dryRun: args.includes('--dry-run'), ...(args.includes('--backup-dir') ? { backupDir: path.resolve(at('--backup-dir')) } : {}) })
    .then(report => console.log(JSON.stringify(report, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { convert, mergeDocument, importReading };
