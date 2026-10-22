const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { repairDocument, repairDatabase } = require('../scripts/repair-content.cjs');
const plan = require('../scripts/data/content-repair-2026-10-22.json');
const C = require('../site/exercise-catalog');
const current = require('../site/database/lesen.json');
const names = { 'exercise-names.b1.json': require('../site/database/exercise-names.b1.json'), 'exercise-names.b2.json': require('../site/database/exercise-names.b2.json') };
function ref(document, pointer) {
  const keys = pointer.slice(1).split('/').map(k => k.replace(/~1/g,'/').replace(/~0/g,'~'));
  const key=keys.pop();return { parent: keys.reduce((obj,k)=>obj[k],document), key };
}
function baseline() {
  const document=structuredClone(current), indexes=structuredClone(names);
  // Restore only the reviewed fields, so this test remains valid before/after application.
  for(const item of [...plan.items].reverse()) for(const patch of [...item.patches].reverse()) {
    const {parent,key}=ref(document,patch.path);
    if(patch.operation==='add')delete parent[key];else parent[key]=structuredClone(patch.before);
  }
  for(const index of Object.values(indexes))for(const entry of index.entries) {
    const resolved=C.resolveTarget({'lesen.json':document},entry.target);
    if(resolved)entry.contentFingerprint=C.fingerprint(C.identityContent(entry.target,resolved.record));
  }
  return {document,indexes};
}
const part=(doc,l,t,v,p)=>doc.levels[l].themes[t].versions[v].lesen.parts[p]?.content;

test('all repaired exercises are completable; Mara retains every real part',()=>{
  const b=baseline(),r=repairDocument(b.document,b.indexes);
  assert.equal(r.changes.length,22);
  for(const item of plan.items) {
    const c=C.resolveTarget({'lesen.json':r.document},item.target)?.record;
    if(c)assert.ok(C.hasAnswerKey({module:'lesen',payload:c}),JSON.stringify(item.target));
  }
  for(const [l,t] of [['b2','baeder-teil-1'],['b2','autos-teil-3'],['b1','laura']]) {
    const c=part(r.document,l,t,'default','teil-3');assert.equal(c.ads.filter(a=>a.id==='X').length,1);
    assert.deepEqual(c.answers,part(b.document,l,t,'default','teil-3').answers);
  }
  const m=r.document.levels.b1.themes['mara-alt'];assert.deepEqual(m.versions.default.lesen.partOrder,['teil-1','teil-2','teil-3']);
  for(const p of ['teil-1','teil-2','teil-3'])assert.deepEqual(m.versions.default.lesen.parts[p],b.document.levels.b1.themes['mara-alt'].versions.default.lesen.parts[p]);
  assert.deepEqual(m.versions['version-1'],b.document.levels.b1.themes['mara-alt'].versions['version-1']);
});

test('grammar identifiers, banks and derived segments agree with the real visible gaps',()=>{
  const b=baseline(),r=repairDocument(b.document,b.indexes);
  for(const item of plan.items.filter(i=>i.target.partKey.startsWith('sprachbausteine'))) {
    const c=C.resolveTarget({'lesen.json':r.document},item.target)?.record;if(!c)continue;
    assert.equal(c.blanks.length,10);assert.equal(c.answers.length,10);
    assert.ok(c.blanks.every(b=>String(b.id).match(/^\d+$/)));
    const keys=new Map(c.answers.map(a=>[String(a.id),a.answer]));
    assert.deepEqual(new Set([...c.text.matchAll(/\[\[(\d+)\]\]/g)].map(m=>m[1])),new Set(keys.keys()));
    for(const s of c.segments)if(s.type==='luecke')assert.equal(s.answer,keys.get(String(s.id)));
    if(item.target.partKey.endsWith('2')){
      assert.equal(c.options.length,15);assert.equal(new Set(c.options).size,15);assert.equal(new Set(keys.values()).size,10);
      assert.deepEqual(c.wordBank.map(w=>w.text),c.options);
    }
  }
  const a=part(r.document,'b1','alicia','version-1','sprachbausteine-1');assert.ok(!a.text.includes('Here you go:'));
  const t=part(r.document,'b1','thomas-anna','telc-b1-267','sprachbausteine-2');assert.ok(t.text.includes('bei [[33]] Sie'));assert.ok(t.options.includes('GERNE'));assert.equal(t.answers.find(a=>a.id===37).answer,'HABEN');
});

test('reviewed keys agree across copies and corrected passage highlights remain exact',()=>{
  const b=baseline(),r=repairDocument(b.document,b.indexes);
  for(const [t,v] of [['mobarmijine','default'],['tanzkurs','version-1'],['insel','default']])assert.equal(part(r.document,'b2',t,v,'teil-3').answers.find(a=>a.situationId===20).adId,'G');
  assert.equal(part(r.document,'b1','karla','default','sprachbausteine-1').answers.find(a=>a.id===22).answer,'ohne');
  for(const t of ['paul','tamara-jakob','jennifer']){
    const c=part(r.document,'b1',t,'default','teil-2'),old=part(b.document,'b1',t,'default','teil-2');
    assert.equal(c.passage.text,c.passage.paragraphs.join('\n\n'));
    assert.ok(!/Pubertätsporobleme|inrer|tiefer gehen Ende|Klage Schüler/.test(c.passage.text));
    assert.deepEqual(c.questions.map(q=>[q.id,q.answerId,q.options]),old.questions.map(q=>[q.id,q.answerId,q.options]));
    for(const q of c.questions)for(const h of q.highlights||[])if(h.source.startsWith('passage:'))assert.equal(c.passage.paragraphs[Number(h.source.split(':')[1])].slice(h.start,h.end),h.text);
  }
});

test('changes are limited to the reviewed fields and matching alias fingerprints',()=>{
  const b=baseline(),r=repairDocument(b.document,b.indexes),restored=structuredClone(r.document);
  for(const item of [...plan.items].reverse())for(const patch of [...item.patches].reverse()){
    const {parent,key}=ref(restored,patch.path);if(patch.operation==='add')delete parent[key];else parent[key]=structuredClone(patch.before);
  }
  assert.deepEqual(restored,b.document);assert.equal(r.staleNames.length,0);
  for(const file of Object.keys(names)){
    const oldBound=C.bindNames({'lesen.json':b.document},b.indexes[file]);
    const newBound=C.bindNames({'lesen.json':r.document},r.indexes[file]);assert.equal(newBound.length,oldBound.length);
    const restoredIndex=structuredClone(r.indexes[file]);restoredIndex.entries.forEach((e,i)=>e.contentFingerprint=b.indexes[file].entries[i].contentFingerprint);
    assert.deepEqual(restoredIndex,b.indexes[file]);
  }
  for(const t of ['alex-und-cora','kindertelefon']){
    const l=t==='kindertelefon'?'b2':'b1';assert.deepEqual(r.document.levels[l].themes[t],b.document.levels[l].themes[t]);
  }
});

test('reruns do nothing and unexpected edits block pending changes',()=>{
  const b=baseline(),first=repairDocument(b.document,b.indexes),again=repairDocument(first.document,first.indexes);
  assert.equal(again.changes.length,0);assert.deepEqual(again.document,first.document);assert.deepEqual(again.indexes,first.indexes);
  part(b.document,'b1','alicia','version-1','sprachbausteine-1').text+=' Manager edit';
  assert.throws(()=>repairDocument(b.document,b.indexes),/changed since review/);
});

test('writes byte-exact recovery files and does not write on a repeated run',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'zdeutsch-content-repair-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const b=baseline(),data={'lesen.json':b.document,...b.indexes};
  for(const [f,d] of Object.entries(data))await fs.writeFile(path.join(dir,f),JSON.stringify(d));
  const dry=await repairDatabase({databaseDir:dir,dryRun:true});assert.equal(dry.changes.length,22);
  const backupDir=path.join(dir,'backup');await repairDatabase({databaseDir:dir,backupDir});
  for(const f of dry.files.map(f=>f.file))assert.equal(await fs.readFile(path.join(backupDir,f),'utf8'),JSON.stringify(data[f]));
  const bytes=await fs.readFile(path.join(dir,'lesen.json'));assert.equal((await repairDatabase({databaseDir:dir})).changes.length,0);assert.deepEqual(await fs.readFile(path.join(dir,'lesen.json')),bytes);
});
