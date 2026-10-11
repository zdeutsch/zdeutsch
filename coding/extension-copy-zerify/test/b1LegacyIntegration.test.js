const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const C = require('../site/exercise-catalog');
const Imports = require('../site/lesen-import-state');
const { mergeDocuments, mergeB1 } = require('../scripts/merge-b1-legacy.cjs');
const plan = require('../scripts/data/b1-legacy-plan.json');
const sources = Object.fromEntries(plan.items.map(item => [item.sourceId, require(`../scripts/data/b1-legacy-sources/${item.sourceId}.json`)]));
const blankNames = () => ({ schemaVersion: 1, entries: [] });
const blankManifest = () => ({ schemaVersion: 1, exercises: [], migrated: [] });
function original() {
  const db = Object.fromEntries(C.FILES.map(file => [file, structuredClone(require(`../site/database/${file}`))]));
  for (const item of plan.items) {
    const theme = db['lesen.json'].levels.b1.themes[item.themeKey];
    delete theme.versions[item.versionKey];
    theme.versionOrder = theme.versionOrder.filter(key => key !== item.versionKey);
  }
  return db;
}

test('B1 adds two partial versions while preserving every original record and all B2 content', () => {
  const before = original(), result = mergeDocuments(before, blankNames(), blankManifest(), plan, sources);
  assert.equal(result.added.length, 2);
  assert.deepEqual(result.db['lesen.json'].levels.b2, before['lesen.json'].levels.b2);
  for (const file of C.FILES.filter(file => file !== 'lesen.json')) assert.deepEqual(result.db[file], before[file]);
  for (const [key, theme] of Object.entries(before['lesen.json'].levels.b1.themes)) {
    const next = result.db['lesen.json'].levels.b1.themes[key];
    for (const [field, value] of Object.entries(theme)) if (!['versions', 'versionOrder'].includes(field)) assert.deepEqual(next[field], value);
    for (const [version, value] of Object.entries(theme.versions)) assert.deepEqual(next.versions[version], value);
    assert.deepEqual(next.versionOrder.slice(0, theme.versionOrder.length), theme.versionOrder);
  }
  for (const row of result.added) assert.deepEqual(Object.keys(result.db['lesen.json'].levels.b1.themes[row.target.themeKey].versions[row.target.versionKey].lesen.parts), ['sprachbausteine-2']);
});

test('aliases remain level-scoped and cross-level Liebe Lara is found without duplicating it', () => {
  const result = mergeDocuments(original(), blankNames(), blankManifest(), plan, sources);
  assert.equal(result.names.entries.length, 167);
  const entries = C.combinedNames(result.db, result.names, { levels: ['b1'] });
  assert.ok(entries.every(entry => entry.target.level === 'b1'));
  assert.ok(C.searchNames(entries, { query: 'PETRA/JENNIFER', level: 'b1', module: 'lesen' }).some(entry => entry.target.themeKey === 'petra' && entry.target.partKey === 'teil-1'));
  const cross = plan.audit.find(row => row.sourceId === '284');
  assert.equal(cross.status, 'Found outside B1'); assert.equal(cross.target.level, 'b2');
  assert.ok(C.resolveTarget(result.db, cross.target));
  assert.ok(!C.mergedExercises(result.db, { levels: ['b1'] }).some(item => item.provenance.quizId === '284'));
});

test('source word banks and unusable answer keys are preserved without enabling grading', () => {
  const result = mergeDocuments(original(), blankNames(), blankManifest(), plan, sources);
  for (const item of C.mergedExercises(result.db, { levels: ['b1'] })) {
    assert.equal(item.level, 'b1'); assert.equal(item.partKey, 'sprachbausteine-2');
    assert.deepEqual(item.payload.options, sources[item.provenance.quizId].dragOptions);
    assert.deepEqual(item.payload.answers.map(answer => answer.answer), sources[item.provenance.quizId].questions.map(q => q.correctAnswer));
    assert.deepEqual(item.payload.blanks.map(blank => blank.id), Array.from({ length: 10 }, (_, i) => i + 31));
    assert.equal(C.hasAnswerKey(item), false);
    const content = C.resolveTarget(result.db, item.target).record;
    assert.equal(Imports.canScore(content), false);
    assert.equal(Imports.storageKey(content), `zdeutsch.exercise-additions.v1:${item.id}`);
    assert.equal(item.review.answerStatus, 'unverified');
  }
});

test('word-bank checking requires available, distinct answers; corrected native keys can become usable', () => {
  const payload = { blanks: [{ id: 31 }, { id: 32 }], options: ['AUF', 'MIT'], answers: [{ id: 31, answer: 'AUF' }, { id: 32, answer: 'MIT' }] };
  assert.equal(C.hasAnswerKey({ module: 'lesen', payload }), true);
  payload.answers[1].answer = 'mit'; assert.equal(C.hasAnswerKey({ module: 'lesen', payload }), false);
  payload.answers[1].answer = 'AUF'; assert.equal(C.hasAnswerKey({ module: 'lesen', payload }), false);
  payload.answers[1].answer = 'GERNE'; assert.equal(C.hasAnswerKey({ module: 'lesen', payload }), false);
});

test('repeat merging preserves edits, visibility, corrected keys and intentionally removed aliases', () => {
  const first = mergeDocuments(original(), blankNames(), blankManifest(), plan, sources);
  const item = C.mergedExercises(first.db, { levels: ['b1'] })[0];
  const record = C.resolveTarget(first.db, item.target).record;
  record.title = 'Manager title'; record.answers[0].answer = 'MEHRMALS'; record.legacyImport.enabled = false;
  first.names.entries[0].names = [{ label: 'Manager name', source: 'manager', scope: 'exercise' }];
  const repeat = mergeDocuments(first.db, first.names, first.manifest, plan, sources);
  assert.equal(repeat.added.length, 0); assert.equal(repeat.newMappings, 0);
  assert.deepEqual(repeat.db, first.db); assert.deepEqual(repeat.names, first.names); assert.deepEqual(repeat.manifest, first.manifest);
  assert.equal(C.mergedExercises(repeat.db, { levels: ['b1'] }).length, 1);
});

test('changed source content or referenced exercise content requires review before merging', () => {
  const changedSource = structuredClone(sources); changedSource['265'].clozeText += ' changed';
  assert.throws(() => mergeDocuments(original(), blankNames(), blankManifest(), plan, changedSource), /Source changed/);
  const changed = original(); const target = plan.nameMappings[0].target;
  C.resolveTarget(changed, target).record.texts[0].text += ' changed';
  assert.throws(() => mergeDocuments(changed, blankNames(), blankManifest(), plan, sources), /Exercise changed/);
});

test('actual merge backs up exact original bytes and a repeat performs no writes', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'zdeutsch-b1-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const db = original(); const before = JSON.stringify(db['lesen.json']);
  for (const file of C.FILES) await fs.writeFile(path.join(dir, file), file === 'lesen.json' ? before : JSON.stringify(db[file]));
  const args = { databaseDir: dir, sourceDir: path.resolve(__dirname, '../scripts/data/b1-legacy-sources'), backupDir: path.join(dir, 'backup') };
  assert.equal((await mergeB1(args)).added.length, 2);
  assert.equal(await fs.readFile(path.join(args.backupDir, 'lesen.json'), 'utf8'), before);
  const bytes = await fs.readFile(path.join(dir, 'lesen.json'), 'utf8');
  const again = await mergeB1(args); assert.equal(again.added.length, 0); assert.deepEqual(again.changedFiles, []);
  assert.equal(await fs.readFile(path.join(dir, 'lesen.json'), 'utf8'), bytes);
});
