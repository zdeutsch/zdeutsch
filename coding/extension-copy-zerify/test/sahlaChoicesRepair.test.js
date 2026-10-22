const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { key, repairDocument, repairDatabase } = require('../scripts/repair-sahla-choices.cjs');
const plan = require('../scripts/data/sahla-choice-repair-2026-10-22.json');
const C = require('../site/exercise-catalog');
const current = require('../site/database/lesen.json');
const names = Object.fromEntries(['b1','b2'].map(level => [`exercise-names.${level}.json`, require(`../site/database/exercise-names.${level}.json`)]));
function get(doc, target) { return doc.levels[target.level].themes[target.themeKey].versions[target.versionKey].lesen.parts[target.partKey].content; }
function representations(doc, target) {
  const theme = doc.levels[target.level].themes[target.themeKey];
  return [get(doc,target), ...(theme.defaultVersion === target.versionKey && theme.lesen?.parts[target.partKey] ? [theme.lesen.parts[target.partKey].content] : [])];
}
function extraRepresentations(doc,item) { return item.mode==='match-answer-casing' ? [get(doc,item.target)] : representations(doc,item.target); }
function baseline() {
  const document = structuredClone(current), indexes = structuredClone(names);
  // Recreate this batch's historical fixture independently of the later content corrections.
  const later = require('../scripts/data/content-repair-2026-10-22.json');
  for (const item of [...later.items].reverse()) for (const patch of [...item.patches].reverse()) {
    const keys = patch.path.slice(1).split('/').map(k => k.replace(/~1/g, '/').replace(/~0/g, '~'));
    const field = keys.pop(), parent = keys.reduce((value, k) => value[k], document);
    if (patch.operation === 'add') delete parent[field]; else parent[field] = structuredClone(patch.before);
  }
  for (const item of plan.items) for (const content of representations(document,item.target)) {
    content.options = structuredClone(item.beforeOptions); content.wordBank = structuredClone(item.beforeWordBank);
  }
  for (const item of plan.extraRepairs || []) for (const content of extraRepresentations(document,item)) {
    if (item.mode === 'restore-duplicate-choice') content.blanks[content.blanks.findIndex(b => b.id === item.blankId)] = structuredClone(item.beforeBlank);
    else { content.options=structuredClone(item.beforeOptions);content.wordBank=structuredClone(item.beforeWordBank); }
  }
  for (const content of representations(document,plan.advert.target)) content.ads[content.ads.findIndex(a => a.id === 'G')] = structuredClone(plan.advert.before);
  const ids = new Set([...plan.items,...plan.extraRepairs,plan.advert].map(i=>C.targetId(i.target)));
  for (const index of Object.values(indexes)) for (const entry of index.entries) if (ids.has(C.targetId(entry.target))) entry.contentFingerprint = C.fingerprint(C.identityContent(entry.target,get(document,entry.target)));
  return {document,indexes};
}

test('all reviewed banks restore 15 real choices, preserving exact corrections and source variants',()=>{
  const before=baseline(),result=repairDocument(before.document,before.indexes);
  assert.equal(result.changes.filter(c=>c.type==='missing choices restored').length,15);
  assert.equal(result.changes.filter(c=>c.type==='word-bank metadata repaired').length,1);
  for(const item of plan.items) for(const content of representations(result.document,item.target)) {
    assert.equal(content.options.length,15);assert.equal(new Set(content.options.map(key)).size,15);
    assert.deepEqual(content.answers,get(before.document,item.target).answers);
    assert.equal(content.text,get(before.document,item.target).text);
    assert.deepEqual(content.wordBank.map(w=>w.text),content.options);
    for(const answer of content.answers)assert.ok(content.options.includes(answer.answer));
  }
  const miroslav=get(result.document,plan.items.find(i=>i.target.versionKey==='version-2').target);
  assert.ok(miroslav.options.includes('AUßERDEM'));
  const tamara=get(result.document,plan.items.find(i=>i.target.themeKey==='tamara-jakob').target);
  assert.ok(tamara.options.includes('ALS'));assert.ok(tamara.options.includes('WICHTIGEN'));assert.ok(tamara.options.includes('STATT'));assert.ok(!tamara.options.includes('BEIM'));
  const licht=get(result.document,plan.items.find(i=>i.target.themeKey==='licht').target);
  assert.ok(licht.options.includes('LÖSUNGEN'));assert.ok(licht.options.includes('STATT'));assert.ok(!licht.options.includes('STSTT'));
});

test('TAMARA G receives the seaside advert, matching translation and valid highlights; F and correction stay intact',()=>{
  const before=baseline(),after=repairDocument(before.document,before.indexes);
  for(const [i,content] of representations(after.document,plan.advert.target).entries()) {
    const g=content.ads.find(a=>a.id==='G'),f=content.ads.find(a=>a.id==='F');
    assert.equal(g.text,plan.advert.source.ad.text);assert.equal(g.translated,plan.advert.source.ad.fazit);assert.notEqual(g.text,f.text);
    assert.deepEqual(f,representations(before.document,plan.advert.target)[i].ads.find(a=>a.id==='F'));
    const answer=content.answers.find(a=>a.situationId===16);assert.equal(answer.adId,'G');
    for(const h of answer.highlights||[]) if(h.source==='ad')assert.equal(g.text.slice(h.start,h.end),h.text);
  }
});

test('reviewed wrong bank, duplicate choice and case mismatches are fixed without changing text or keys',()=>{
  const before=baseline(),result=repairDocument(before.document,before.indexes);
  for(const item of plan.extraRepairs) for(const content of extraRepresentations(result.document,item)) {
    assert.equal(content.text,get(before.document,item.target).text);assert.deepEqual(content.answers,get(before.document,item.target).answers);
    if(item.mode==='restore-duplicate-choice')assert.deepEqual(content.blanks.find(b=>b.id===item.blankId).options,['dein','deine','deinen']);
    else { assert.equal(content.options.length,15);for(const a of content.answers)assert.ok(content.options.includes(a.answer)); }
  }
  const andreas=get(result.document,plan.extraRepairs.find(i=>i.target.themeKey==='andreas').target);
  assert.ok(andreas.options.includes('INTERESSIERT'));assert.ok(!andreas.options.includes('BEQUEM'));
});

test('only reviewed choice fields, advert G, its highlight positions and name fingerprints change',()=>{
  const before=baseline(),result=repairDocument(before.document,before.indexes),restored=structuredClone(result.document);
  for(const item of plan.items) {
    const old=representations(before.document,item.target),newer=representations(restored,item.target);
    newer.forEach((content,i)=>{content.options=structuredClone(old[i].options);content.wordBank=structuredClone(old[i].wordBank);});
  }
  for(const item of plan.extraRepairs) extraRepresentations(restored,item).forEach((content,i)=>{
    const old=extraRepresentations(before.document,item)[i];
    if(item.mode==='restore-duplicate-choice')content.blanks=structuredClone(old.blanks);
    else {content.options=structuredClone(old.options);content.wordBank=structuredClone(old.wordBank);}
  });
  representations(restored,plan.advert.target).forEach((content,i)=>{
    const old=representations(before.document,plan.advert.target)[i];content.ads=structuredClone(old.ads);content.answers=structuredClone(old.answers);
  });
  assert.deepEqual(restored,before.document);
  assert.equal(result.staleNames.length,0);assert.equal(result.refreshedNames.length,16);
  for(const filename of Object.keys(names)) {
    const after=structuredClone(result.indexes[filename]);
    after.entries.forEach((entry,i)=>entry.contentFingerprint=before.indexes[filename].entries[i].contentFingerprint);
    assert.deepEqual(after,before.indexes[filename]);
    assert.equal(C.bindNames({'lesen.json':result.document},result.indexes[filename]).length,C.bindNames({'lesen.json':before.document},before.indexes[filename]).length);
  }
});

test('reruns are idempotent and later corrections are preserved; unreviewed text edits block pending imports',()=>{
  const before=baseline(),first=repairDocument(before.document,before.indexes),again=repairDocument(first.document,first.indexes);
  assert.equal(again.changes.length,0);assert.deepEqual(again.document,first.document);assert.deepEqual(again.indexes,first.indexes);
  get(first.document,plan.items[0].target).answers[0].answer='Manager edit';
  assert.deepEqual(repairDocument(first.document,first.indexes).document,first.document);
  get(before.document,plan.items[0].target).text+=' Manager edit';
  assert.throws(()=>repairDocument(before.document,before.indexes),/changed since source review/);
});

test('repair creates byte-exact backups and a second run performs no writes',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'sahla-choice-repair-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const before=baseline(),original={'lesen.json':before.document,...before.indexes};
  for(const [filename,document] of Object.entries(original))await fs.writeFile(path.join(directory,filename),JSON.stringify(document));
  const backupDir=path.join(directory,'backup');const dry=await repairDatabase({databaseDir:directory,dryRun:true});assert.equal(dry.changes.length,21);
  await assert.rejects(fs.stat(backupDir),{code:'ENOENT'});
  const result=await repairDatabase({databaseDir:directory,backupDir});assert.equal(result.changes.length,21);
  for(const filename of Object.keys(original))assert.equal(await fs.readFile(path.join(backupDir,filename),'utf8'),JSON.stringify(original[filename]));
  const bytes=await fs.readFile(path.join(directory,'lesen.json'),'utf8');const again=await repairDatabase({databaseDir:directory});assert.equal(again.changes.length,0);assert.equal(await fs.readFile(path.join(directory,'lesen.json'),'utf8'),bytes);
});
