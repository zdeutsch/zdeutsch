"""Prepare reviewed, guarded patches. Does not write application databases."""
import copy
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
input_bytes = (ROOT / 'site/database/lesen.json').read_bytes()
if hashlib.sha256(input_bytes).hexdigest() != 'eaee3a544ee906c1adeed2a71a7dbcdd078fc254b914c2b28689867f4d6d77d9':
    raise RuntimeError('The reviewed baseline changed. Do not regenerate the approved repair plan from later content.')
before = json.loads(input_bytes)
after = copy.deepcopy(before)
items = []

def grammar_segments(c):
    for entry in c.get('answers',[]) + c.get('blanks',[]):
        if isinstance(entry.get('id'),str) and entry['id'].startswith('Lücke '):
            entry['id']=int(entry['id'].removeprefix('Lücke ').strip())
    answers = {str(a['id']): a['answer'] for a in c['answers']}
    for b in c.get('blanks', []):
        if 'answer' in b: b['answer'] = answers[str(b['id'])]
    segments = []; cursor = 0
    for m in re.finditer(r'\[\[(\d+)\]\]', c['text']):
        if m.start() > cursor: segments.append({'type':'text','value':c['text'][cursor:m.start()]})
        segments.append({'type':'luecke','id':int(m[1]),'answer':answers[m[1]]}); cursor=m.end()
    if cursor < len(c['text']): segments.append({'type':'text','value':c['text'][cursor:]})
    c['segments'] = segments

def set_keys(c, changes):
    for a in c['answers']:
        if str(a['id']) in changes: a['answer'] = changes[str(a['id'])]
    grammar_segments(c)

def bank(c, replacements):
    c['options'] = [replacements.get(w,w) for w in c['options']]
    for w in c['wordBank']: w['text'] = replacements.get(w['text'],w['text'])

def diff(old, new, path=''):
    if old == new: return []
    if isinstance(old,dict) and isinstance(new,dict):
        patches=[]
        for k in sorted(old.keys() | new.keys()):
            p=path+'/'+k.replace('~','~0').replace('/','~1')
            if k not in old: patches.append({'path':p,'operation':'add','after':new[k]})
            elif k not in new: patches.append({'path':p,'operation':'remove','before':old[k]})
            else: patches.extend(diff(old[k],new[k],p))
        return patches
    return [{'path':path,'operation':'replace','before':old,'after':new}]

def repair(level, theme, version, part, title, reason, fn, source=None):
    target=dict(file='lesen.json',level=level,kind='part',themeKey=theme,versionKey=version,partKey=part)
    t=after['levels'][level]['themes'][theme]
    base=f'/levels/{level}/themes/{theme}'
    pointers=[base+f'/versions/{version}/lesen/parts/{part}/content']
    records=[t['versions'][version]['lesen']['parts'][part]['content']]
    if t.get('defaultVersion')==version and part in t.get('lesen',{}).get('parts',{}):
        pointers.append(base+f'/lesen/parts/{part}/content'); records.append(t['lesen']['parts'][part]['content'])
    patches=[]
    for ptr,c in zip(pointers,records):
        old=copy.deepcopy(c);fn(c)
        patches.extend({**p,'path':ptr+p['path']} for p in diff(old,c))
    if patches: items.append(dict(target=target,title=title,reason=reason,source=source or 'Reviewed ZDeutsch content correction',patches=patches))

for level,theme in [('b2','baeder-teil-1'),('b2','autos-teil-3'),('b1','laura')]:
    def no_match(c):
        if not any(a['id']=='X' for a in c['ads']):c['ads'].append({'id':'X','text':'Keine passende Anzeige','translated':'لا يوجد إعلان مناسب'})
    repair(level,theme,'default','teil-3','Restore X choice','The existing key requires X; expose the missing no-match choice.',no_match)

def alicia(c):
    c['text']=c['text'].removeprefix('Here you go:\n\n')
    unique={}
    for b in c['blanks']:
        i=int(re.sub(r'^Lücke\s*','',str(b['id']),flags=re.I)); unique.setdefault(i,{**b,'id':i})
    c['blanks']=list(unique.values());grammar_segments(c)
repair('b1','alicia','version-1','sprachbausteine-1','Alicia duplicate questions','Keep one numeric row per gap and remove generation residue.',alicia)

def karin(c):
    b=next(b for b in c['blanks'] if b['id']==24)
    b['options']=['anderen','anderem','andere']
repair('b2','telc-b2-g1-24','default','sprachbausteine-1','Liebe Karin distractor','Replace a duplicated incorrect-choice slot with the distinct dative-singular distractor anderem. The correct answer anderen is unchanged.',karin,
       'Editorial distractor repair; Sahla Liebe Karin records contain a different passage')

def vera(c):
    c['text']=c['text'].replace('statt, und [[33]] zwar','statt, [[33]] zwar').replace('Darin sind alle Lehrmaterialien [[34]] enthalten.','Darin sind [[34]] Lehrmaterialien enthalten.')
    bank(c,{'DREI':'DREIMAL','SO':'UND','ALLES':'ALLE'})
    set_keys(c,{'31':'MEHRMALS','32':'DREIMAL','33':'UND','34':'ALLE'})
    c['legacyImport']['review']={'answerStatus':'reviewed','note':'Corrected the malformed frequency phrases and und zwar construction; ten distinct selectable answers. Original sourceIssues are retained in provenance.'}
repair('b1','vera','telc-b1-265','sprachbausteine-2','Vera imported grammar','Repair text and key together: MEHRMALS, DREIMAL, UND and ALLE remove malformed phrases and repeated required words.',vera,
       'Editorial correction of telc.site quiz 265; the cached original contains the same defects')

def thomas(c):
    c['text']=c['text'].replace('das Unternehmen, [[33]] Sie','das Unternehmen, bei [[33]] Sie')
    bank(c,{'AN':'DEM','DENN':'FALLS','GENAU':'GERNE','WERDEN':'HABEN'})
    set_keys(c,{'33':'DEM','37':'HABEN','39':'FALLS'})
    c['legacyImport']['review']={'answerStatus':'reviewed','note':'Corrected bei dem, haben Sie gute Chancen, added GERNE and distinguished WENN/FALLS. All ten answers are selectable and used once. Original sourceIssues are retained in provenance.'}
repair('b1','thomas-anna','telc-b1-267','sprachbausteine-2','Thomas/Anna imported grammar','Repair missing relative pronoun, incomplete predicate, absent GERNE and repeated bank-word requirements.',thomas,
       'Editorial correction of telc.site quiz 267; the cached original contains the same defects')

def karla(c):
    set_keys(c,{'22':'ohne'})
    c['translated']=c.get('translated','').replace('هنا أيضًا على دراجات نارية [[22]]','هنا أيضًا بدون دراجات نارية [[22]]')
repair('b1','karla','default','sprachbausteine-1','Karla gap 22','Use ohne with the stored accusative plural Motorräder; update the translation consistently.',karla,'Sahla /collections/4/records/13/fragen/1 selects c = ohne')

def nutrition(c):
    c['text']=c['text'].replace('Raschläge','Ratschläge').replace('ich einer Zeitschrift durchsah','ich eine Zeitschrift durchsah').replace('gegen Milch. so [[32]]','gegen Milch. So [[32]]')
    grammar_segments(c)
for theme in ['sonja','tamara-jakob']:
    repair('b1',theme,'default','sprachbausteine-2','Nutrition letter proofreading','Preserve ALS/WICHTIGEN/STATT and the current gap layout; repair accusative eine Zeitschrift and spelling.',nutrition)

def corina(c):set_keys(c,{'39':'ÜBER'})
repair('b1','corina','default','sprachbausteine-2','Lottery gap 39','Align the same passage with Caroline and both matching Sahla keys.',corina,'Sahla /collections/5/records/16: über; matching Caroline source: Über')
# The old root projection still has BEREITS although the active Caroline version was already repaired.
caroline=after['levels']['b1']['themes']['caroline']
active=caroline['versions']['default']['lesen']['parts']['sprachbausteine-2']['content']
def caroline_projection(c):
    if c is active:return
    c['options']=copy.deepcopy(active['options']);c['wordBank']=copy.deepcopy(active['wordBank']);set_keys(c,{'39':'über'})
repair('b1','caroline','default','sprachbausteine-2','Caroline root projection','Synchronize the stale root lottery key with the existing active version.',caroline_projection)

def mountain(c):
    a=next(a for a in c['answers'] if a['situationId']==20);a['adId']='G'
    ad=next(a for a in c['ads'] if a['id']=='G')
    phrase='Vierzig Menschen verunglücken jedes Jahr tödlich am Montblanc'
    start=ad['text'].index(phrase)
    a['highlights']=[h for h in a.get('highlights',[]) if h['source']!='ad']+[{'source':'ad','start':start,'end':start+len(phrase),'text':phrase}]
for theme,version in [('mobarmijine','default'),('tanzkurs','version-1')]:
    repair('b2',theme,version,'teil-3','Mountaineering advert match','Question 20 asks about mountaineering risks. G discusses fatal mountain accidents and rescue services; match the existing Insel correction.',mountain,'Sahla /collections/9/records/0 and /1: situation 10 -> g')

def teleshopping(c):set_keys(c,{'31':'EHER','38':'SOGAR'})
repair('b2','teleshopping-alt','default','sprachbausteine-2','Teleshopping key alignment','Use Qualität eher enttäuschend and dieses Recht gilt sogar unbefristet; both answers remain distinct and selectable.',teleshopping,'Sahla /collections/11/records/42')

paragraphs=[
    'Ein Schulversuch für besonders kluge Schüler',
    'WIEN. Es ist eine ganz normale Schulstunde – Geschichte – in einer ganz normalen Klasse. Während der Lehrer einen Vortrag über das alte Rom hält, unterhalten sich die Schüler über den Schulball, kritisieren die Kleidung des Lehrers oder reichen Zettel unter der Schulbank weiter.',
    'Ganz normale Kinder',
    'Auch überdurchschnittlich intelligente Kinder sind ganz normale Kinder, betont Elfriede Wegricht, Psychologin in der Sir-Karl-Popper-Schule, die im vergangenen September ihren Betrieb aufgenommen hat. Nur weil sie in der Schule gut sind, heißt das nicht, dass sie nicht genauso wie alle anderen Schüler Liebeskummer, Ärger mit den Eltern und andere Pubertätsprobleme haben. Der Unterschied zwischen normalen und hochbegabten Schülern besteht darin, dass sich die Hochbegabten in ihrer bisherigen Schulkarriere nicht besonders anstrengen mussten und es nicht gewohnt sind, mit ihrer Zeit gut hauszuhalten.',
    'Förderung durch Forderung',
    'Um überdurchschnittlich intelligente Kinder nun entsprechend zu fördern, sieht das Konzept der Sir-Karl-Popper-Schule mehr Fremdsprachen, projektorientiertes Arbeiten in kleinen Klassen und vor allem mehr Eigenverantwortung für die Lernenden vor. Dazu kommt die Förderung der individuellen Fähigkeiten: Wer in einem Fach gut ist und sich besonders für ein Thema interessiert, bekommt Sonderaufgaben und tiefergehende Unterlagen. Anfangs war der plötzliche Mehraufwand ein Schock für die Schüler, die eine 40-Stunden-Woche zu bewältigen haben. Aber es ist besser, sie erleben den Schock jetzt als zu Beginn des Studiums, meint Herr Peters, Lehrer und Schülerbetreuer an der Popper-Schule, denn oft scheitern besonders kluge Menschen später, weil sie mit ihrer Intelligenz nichts anzufangen wissen. Denn zumeist erreichten sie mit wenig Aufwand und Mitarbeit relativ gute Ergebnisse.',
    'Wer ist hochbegabt?',
    'Zielgruppe der Sir-Karl-Popper-Schule sind Kinder, die in mindestens einem Fach hochbegabt sind und überdurchschnittlich gute Ergebnisse haben; das sind 20–30 Prozent der Schüler. Nach einer Aufnahmeprüfung wurden aus 64 Bewerbern 28 ausgewählt, die von insgesamt 28 Lehrern betreut werden. In diesen Klassen können die überdurchschnittlich intelligenten Schüler dann endlich so sein, wie sie sind, ohne bei jeder Wortmeldung von ihren Klassenkameraden beschimpft zu werden, meint die Schulpsychologin. Ziel des Schulversuchs sei es jedoch laut Peters nicht, besonders kluge Schüler von normalen Kindern zu trennen, sondern Erfahrungen im Umgang mit überdurchschnittlich begabten Schülern zu sammeln und die Begabtenförderung in die Normalschule zu übernehmen.'
]
def popper(c):
    c['passage']['paragraphs']=paragraphs.copy();c['passage']['text']='\n\n'.join(paragraphs)
    tr=c['passage'].get('translated')
    if isinstance(tr,list) and len(tr)==8:
        tr[1]='فيينا. إنها حصة دراسية عادية تمامًا في مادة التاريخ، داخل صف عادي تمامًا. بينما يلقي المعلم محاضرة عن روما القديمة، يتحدث الطلاب عن حفلة المدرسة، وينتقدون ملابس المعلم، أو يمررون أوراقًا تحت المقاعد.'
        tr[4]='الدعم من خلال التحدي'
    for q in c['questions']:
        for h in q.get('highlights',[]):
            if not h.get('source','').startswith('passage:'):continue
            p=paragraphs[int(h['source'].split(':')[1])]
            h['text']=h['text'].replace('plötzlich Mehr aufwand','plötzliche Mehraufwand')
            start=p.find(h['text'])
            assert start>=0,(q['id'],h)
            h['start']=start;h['end']=start+len(h['text'])
for theme in ['paul','tamara-jakob','jennifer']:
    repair('b1',theme,'default','teil-2','Popper passage proofreading','Repair OCR damage, missing grammatical links and punctuation while preserving all question choices and answer letters. Synchronize paragraphs, full text, affected Arabic translation and highlight offsets.',popper,
           'Editorial restoration of the existing passage and its Arabic meaning; not a verbatim replacement imported from Sahla (which shares the OCR defects)')

for level,theme,version in [('b2','jens-alt','default'),('b1','nicole','default'),('b1','caroline','version-3')]:
    fn=(lambda c:set_keys(c,{'30':'Freundliche'})) if theme=='nicole' else grammar_segments
    repair(level,theme,version,'sprachbausteine-1','Secondary key synchronization','Rebuild derived segments from the active text and primary answer key. Normalize Caroline Version 4 identifiers; synchronize Nicole’s stale root projection with the existing active key.',fn)

# Remove an empty placeholder, not an exercise. Both ZDeutsch and Sahla lack the text/questions.
theme=after['levels']['b1']['themes']['mara-alt'];old=copy.deepcopy(theme)
for lesen in [theme['versions']['default']['lesen']]+([theme['lesen']] if 'lesen' in theme else []):
    c=lesen['parts']['sprachbausteine-1']['content']
    assert not c['text'] and not c['blanks'] and not c['answers']
    del lesen['parts']['sprachbausteine-1']
    lesen['partOrder']=[p for p in lesen['partOrder'] if p!='sprachbausteine-1']
    lesen.setdefault('counts',{})['parts']=len(lesen['parts'])
theme['counts']={**theme.get('counts',{}),'parts':len(theme['versions']['default']['lesen']['parts']),'versions':len(theme['versions'])}
items.append(dict(target=dict(file='lesen.json',level='b1',kind='part',themeKey='mara-alt',versionKey='default',partKey='sprachbausteine-1'),title='Mara empty placeholder',reason='Remove the unavailable empty grammar tab; preserve the real reading parts and other version.',source='Sahla /collections/4/records/26: text غير مسرب, no questions',patches=[{**p,'path':'/levels/b1/themes/mara-alt'+p['path']} for p in diff(old,theme)]))
lv=after['levels']['b1'];lv['counts']['parts']=sum(len(v['lesen']['parts']) for t in lv['themes'].values() for v in t['versions'].values())
items[-1]['patches'].extend({**p,'path':'/levels/b1/counts'+p['path']} for p in diff(before['levels']['b1']['counts'],lv['counts']))

plan={'batchId':'zdeutsch-content-repair-2026-10-22','items':items,'deferred':[
    'Kindertelefon question 8 and Alex und Cora heading 2: the existing keys have defensible text support; do not overwrite with Sahla automatically.',
    'Praktikum/Praktikanten and Herr Bachinger/Buch schreiben listening key differences require recording verification.',
    'Translation marker mismatches are alignment review warnings, not proof of missing translations.',
    'Paired-gap storage and explicitly code-only listening topics are supported formats, not confirmed defects.'
]}
path=ROOT/'scripts/data/content-repair-2026-10-22.json';path.write_text(json.dumps(plan,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'items':len(items),'patches':sum(len(i['patches']) for i in items),'bytes':path.stat().st_size,'path':str(path)}))
