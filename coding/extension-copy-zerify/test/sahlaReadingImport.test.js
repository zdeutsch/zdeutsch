const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { convert, mergeDocument, importReading } = require('../scripts/import-sahla-b2-reading.cjs');
const plan = require('../scripts/data/sahla-b2-reading-2026-10-21.json');
const C = require('../site/exercise-catalog');
const Imports = require('../site/lesen-import-state');
const current = require('../site/database/lesen.json');
function baseline() {
  const original = structuredClone(current);
  for (const item of plan.items) delete original.levels.b2.themes[item.themeKey];
  original.levels.b2.themeOrder = original.levels.b2.themeOrder.filter(key => !plan.items.some(item => item.themeKey === key));
  return original;
}

test('all 18 missing parts are appended without changing any existing Thema or B1 data', () => {
  const before = baseline(), result = mergeDocument(before);
  assert.equal(result.added.length, 18);
  assert.deepEqual(result.document.levels.b1, before.levels.b1);
  for (const [key, theme] of Object.entries(before.levels.b2.themes)) assert.deepEqual(result.document.levels.b2.themes[key], theme);
  assert.deepEqual(result.document.levels.b2.themeOrder.slice(0, before.levels.b2.themeOrder.length), before.levels.b2.themeOrder);
  assert.equal(result.document.levels.b2.counts.themes, Object.keys(result.document.levels.b2.themes).length);
  for (const item of result.added) {
    const theme = result.document.levels.b2.themes[item.target.themeKey];
    assert.deepEqual(theme.versions.default.lesen.partOrder, [item.target.partKey]);
    assert.equal(Object.keys(theme.versions.default.lesen.parts).length, 1);
    assert.ok(C.resolveTarget({ 'lesen.json': result.document }, item.target));
  }
});

test('keys resolve to the original source options and no German text is silently corrected', () => {
  for (const item of plan.items) {
    const s = item.source, c = convert(item).content;
    assert.equal(C.hasAnswerKey({ module: 'lesen', payload: c }), true);
    if (item.partKey === 'teil-1') {
      assert.deepEqual(c.texts.map(q => q.text), s.Texte.map(q => q.text));
      assert.deepEqual(c.answers.map(q => q.headlineId.toLowerCase()), s.Texte.map(q => q.antwort));
    } else if (item.partKey === 'teil-2') {
      assert.deepEqual(c.passage.paragraphs, s.text.map(p => p.para));
      assert.deepEqual(c.questions.map(q => q.answerId), s.fragen.map(q => q.antwort));
    } else if (item.partKey === 'teil-3') {
      assert.deepEqual(c.answers.map(q => q.adId.toLowerCase()), s.situationen.map(q => q.antwort));
      assert.ok(c.ads.some(ad => ad.id === 'X'));
    } else {
      const sourceIds = [...new Set([...s.text.matchAll(/\(\s*(\d+)\s*\)/g)].map(m => Number(m[1])))];
      const restored = c.text.replace(/\[\[(\d+)\]\]/g, (_, id) => `(${sourceIds[Number(id) - (item.partKey.endsWith('1') ? 21 : 31)]})`);
      assert.equal(restored, s.text.replace(/(?:_+|\.+)?\(\s*(\d+)\s*\)(?:_+|\.+)?/g, (_, id) => `(${id})`));
      for (const [index, answer] of c.answers.entries()) {
        const expected = item.partKey.endsWith('1') ? s.fragen[index].options.find(o => o.id === s.fragen[index].antwort).text
          : s.options.find(o => Number(o.antwort) === sourceIds[index]).text;
        assert.equal(answer.answer, expected);
      }
    }
  }
});

test('repeated paired gap stays repeated; incomplete garden text cannot produce a score', () => {
  const jan = convert(plan.items.find(i => i.themeKey === 'sahla-b2-hey-jan')).content;
  assert.equal([...jan.text.matchAll(/\[\[28\]\]/g)].length, 2);
  const garden = convert(plan.items.find(i => i.themeKey === 'sahla-b2-garten-in-der-stadt')).content;
  assert.equal(Imports.canScore(garden), false);
  assert.ok(garden.sourceImport.provenance.sourceNote);
  for (const item of plan.items.filter(i => !i.themeKey.endsWith('garten-in-der-stadt'))) assert.equal(Imports.canScore(convert(item).content), true);
});

test('reruns preserve later corrections, text edits and names; changed source needs review', () => {
  const first = mergeDocument(baseline());
  const edited = first.document.levels.b2.themes[plan.items[0].themeKey].versions.default.lesen.parts['teil-1'].content;
  edited.answers[0].headlineId = 'A'; edited.texts[0].text += ' Manager edit'; edited.sourceImport.names.push('Manager alias');
  const again = mergeDocument(first.document);
  assert.equal(again.added.length, 0); assert.equal(again.preserved.length, 18);
  assert.deepEqual(again.document, first.document);
  const changed = structuredClone(plan); changed.items[0].source.titel += ' Changed';
  assert.throws(() => mergeDocument(first.document, changed), /Changed source needs review/);
});

test('unusable source answers are rejected, and equivalent native content is not duplicated', () => {
  const invalid = structuredClone(plan.items.find(i => i.partKey === 'teil-2'));
  invalid.source.fragen[0].antwort = 'missing';
  assert.throws(() => convert(invalid), /Unusable source answer key/);
  const first = mergeDocument(baseline());
  const one = plan.items[0], level = first.document.levels.b2;
  level.themes['existing-copy'] = level.themes[one.themeKey];
  delete level.themes[one.themeKey];
  delete level.themes['existing-copy'].versions.default.lesen.parts['teil-1'].content.sourceImport;
  level.themeOrder = level.themeOrder.map(key => key === one.themeKey ? 'existing-copy' : key);
  const rerun = mergeDocument(first.document);
  assert.equal(rerun.added.length, 0); assert.equal(rerun.existing.length, 1);
});

test('writing backs up exact bytes and an unchanged rerun performs no write', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'zdeutsch-sahla-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const databaseFile = path.join(directory, 'lesen.json'), before = JSON.stringify(baseline());
  await fs.writeFile(databaseFile, before);
  const backupDir = path.join(directory, 'backup');
  const first = await importReading({ databaseFile, backupDir });
  assert.equal(first.added.length, 18);
  assert.equal(await fs.readFile(path.join(backupDir, 'lesen.json'), 'utf8'), before);
  const after = await fs.readFile(databaseFile, 'utf8');
  assert.equal((await importReading({ databaseFile })).added.length, 0);
  assert.equal(await fs.readFile(databaseFile, 'utf8'), after);
});
