const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../site/exercise-catalog');
const { plainText } = require('./import-b2-legacy.cjs');
const root = path.resolve(__dirname, '..');
const sha = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalize = value => C.normalize(plainText(value).replace(/\[\[\s*\d+\s*\]\]/g, ' gap ').replace(/^\d+\s*[.)]\s*/, ''));
const grams = value => { const words = normalize(value).split(' '); return new Set(words.slice(0, -2).map((word, i) => words.slice(i, i + 3).join(' '))); };
const similarity = (a, b) => { const aa = grams(a), bb = grams(b); return aa.size + bb.size ? 2 * [...aa].filter(x => bb.has(x)).length / (aa.size + bb.size) : 0; };
const str = values => (values || []).map(value => typeof value === 'string' ? value : value.text || '');
function nativeBody(record, part, hearing) {
  if (hearing) return str(record.statements).map(text => text.replace(/^\d+\s*[.)]\s*/, '')).join('\n');
  if (part === 'teil-1') return str(record.texts).join('\n');
  if (part === 'teil-2') return record.passage?.text || str(record.passage?.paragraphs).join('\n');
  return record.text || '';
}
async function buildPlan() {
  const dir = path.join(root, 'output/b1-legacy-integration/source');
  const rows = JSON.parse(await fs.readFile(path.join(root, 'output/b1-legacy-integration/audit-candidates.json')));
  const db = Object.fromEntries(await Promise.all(C.FILES.map(async file => [file, JSON.parse(await fs.readFile(path.join(root, 'site/database', file)))])));
  const current = C.baseEntries(db, { levels: ['b1'], includeHidden: true }).filter(entry => entry.target.kind !== 'theme');
  const manual = {
    '201': [['petra', 'default'], ['alicia', 'default']], '203': [['eva', 'default']], '202': [['iris', 'default']],
    '217': [['sophie', 'default']], '218': [['nadja-claudia', 'default'], ['jan', 'default'], ['moritz', 'default']],
    '286': [['andreas', 'version-1'], ['annika', 'version-1'], ['annika', 'version-2']],
    '287': [['andreas', 'version-2']], '288': [['caroline', 'default'], ['caroline', 'version-2']],
    '283': [['alicia', 'version-1'], ['caroline', 'version-3']]
  };
  const plan = { schemaVersion: 1, batchId: 'telc-b1-20261011', sourceUrl: 'https://telc.site/b1', items: [], nameMappings: [], audit: [] };
  for (const row of rows) {
    const source = JSON.parse(await fs.readFile(path.join(dir, row.sourceId + '.json')));
    if (['265', '267'].includes(row.sourceId)) {
      const themeKey = row.sourceId === '265' ? 'vera' : 'thomas-anna';
      const issues = row.sourceId === '265' ? ['The source reuses DREI and AUCH for multiple gaps, although each bank word can only be used once.'] : ['The source answer GERNE is absent from its word bank.', 'The source reuses WENN and BEI for multiple gaps.'];
      plan.items.push({ sourceId: row.sourceId, title: source.title, names: [...new Set([source.title, row.menuTitle])], level: 'b1', partKey: row.partKey, themeKey, versionKey: `telc-b1-${row.sourceId}`, stableId: `legacy:telc:b1:${row.sourceId}`, expectedSourceFingerprint: sha(source), issues });
      plan.audit.push({ ...row, status: 'Added partial version', target: { file: 'lesen.json', level: 'b1', kind: 'part', themeKey, versionKey: `telc-b1-${row.sourceId}`, partKey: row.partKey }, issues });
      continue;
    }
    if (row.sourceId === '284') {
      const target = { file: 'lesen.json', level: 'b2', kind: 'part', themeKey: 'keine-zeit', versionKey: 'default', partKey: row.partKey };
      plan.audit.push({ ...row, status: 'Found outside B1', target, note: 'Liebe Lara already exists in B2 Keine Zeit. Keep the current classification and corrected answers; do not duplicate it in B1.' });
      continue;
    }
    let matches;
    if (manual[row.sourceId]) matches = current.filter(entry => entry.target.partKey === row.partKey && manual[row.sourceId].some(([tk, vk]) => entry.target.themeKey === tk && entry.target.versionKey === vk));
    else {
      const hearing = row.category === 'Hören';
      const selected = hearing ? source.questions.filter(q => row.questionIds.includes(q.id)) : source.questions;
      const body = hearing || row.partKey === 'teil-1' ? selected.map(q => q.text.replace(/^\d+\s*[.)]\s*/, '')).join('\n') : row.partKey === 'teil-2' ? source.passage : source.clozeText;
      matches = current.filter(entry => entry.target.partKey === row.partKey && (entry.module === 'horen') === hearing && similarity(body, nativeBody(entry.record, row.partKey, hearing)) >= .92);
    }
    if (!matches.length) throw new Error('Unreviewed source: ' + row.sourceReference);
    for (const match of matches) {
      const sourceTitle = plainText(source.title).replace(/^Lesen Teil \d\s*[-:–]?\s*/i, '').trim();
      const subtitle = row.category === 'Hören' ? row.menuTitle : sourceTitle && !/^Lesen Teil \d$/i.test(sourceTitle) ? sourceTitle : row.menuTitle;
      plan.nameMappings.push({ target: match.target, label: row.menuTitle, subtitle, sourceExerciseTitle: sourceTitle, expectedContentFingerprint: match.contentFingerprint, source: { quizId: row.sourceId, auditReference: row.sourceReference, sourceLevel: 'b1' } });
    }
    const differs = manual[row.sourceId] || row.candidates[0].bodySimilarity < 1 || row.candidates[0].optionsSimilarity < 1;
    plan.audit.push({ ...row, status: differs ? 'Found; current content preserved' : 'Found', targets: matches.map(match => match.target), note: manual[row.sourceId] ? 'The same existing exercise/situations have source text or option differences. Preserve the current corrected version.' : undefined });
  }
  await fs.writeFile(path.join(root, 'scripts/data/b1-legacy-plan.json'), JSON.stringify(plan, null, 2) + '\n');
  console.log(JSON.stringify({ groups: plan.audit.length, additions: plan.items.length, aliasMappings: plan.nameMappings.length, aliasTargets: new Set(plan.nameMappings.map(mapping => C.targetId(mapping.target))).size, statuses: plan.audit.reduce((out, row) => ({ ...out, [row.status]: (out[row.status] || 0) + 1 }), {}) }));
}
if (require.main === module) buildPlan().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { buildPlan };
