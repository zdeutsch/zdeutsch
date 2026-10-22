"""Read-only B1/B2 content audit. Writes reports, never application data."""
import ast
import argparse
import collections
import datetime
import difflib
import gzip
import hashlib
import html
import json
from pathlib import Path
import re
import unicodedata
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / 'site/database'
OUT = ROOT / 'output/content-audit-2026-10-22'
ARCHIVE = Path('/Users/mac/Desktop/coding/reading/output/exports/sahla-2026-10-21/sahla-all-content-2026-10-21.zip')

def norm(value):
    value = unicodedata.normalize('NFKC', html.unescape(str(value))).casefold()
    return ' '.join(re.findall(r'\w+', value))

def normalized_body(value):
    return norm(re.sub(r'\[\[\s*\d+\s*\]\]|[._…]*\(\s*\d+\s*\)[._…]*', ' GAP ', value))

def qid(value):
    return re.sub(r'^Lücke\s*', '', str(value), flags=re.I).strip()

def text(value):
    if isinstance(value, str): return value
    if isinstance(value, dict): return str(value.get('text', value.get('prompt', '')))
    return str(value or '')

def pointer(document, location):
    for key in location.strip('/').split('/'):
        key = key.replace('~1', '/').replace('~0', '~')
        document = document[int(key)] if isinstance(document, list) else document[key]
    return document

def words(value): return [text(v) for v in value or []]

def split_pair(value): return [v.strip() for v in re.split(r'\s*(?:…|\.{3})\s*', str(value)) if v.strip()]

def resolved_answer(answer, options, occurrences=1):
    if answer in options: return answer
    pairs = [o for o in options if len(split_pair(o)) == occurrences and answer in split_pair(o)] if occurrences > 1 else []
    return pairs[0] if len(pairs) == 1 else answer

def extract_reading():
    result = []
    for level, data in docs['lesen.json']['levels'].items():
        if level not in ['b1', 'b2']: continue
        for theme_key, theme in data['themes'].items():
            for version_key, version in theme.get('versions', {}).items():
                for part, wrapper in version.get('lesen', {}).get('parts', {}).items():
                    result.append(dict(file='lesen.json', level=level, theme=theme_key, theme_title=theme['title'], version=version_key,
                        part=part, title=version.get('title', theme['title']), content=wrapper['content'],
                        pointer=f'/levels/{level}/themes/{theme_key}/versions/{version_key}/lesen/parts/{part}/content'))
    return result

def add(kind, severity, record, detail, evidence=None, certainty='confirmed data issue'):
    findings.append(dict(kind=kind, severity=severity, certainty=certainty,
        **{k: record.get(k, '') for k in ['file','level','theme','theme_title','title','version','part','pointer']},
        detail=detail, evidence=evidence or {}))

def walk_strings(value, location=''):
    if isinstance(value, str): yield location, value
    elif isinstance(value, dict):
        for k, v in value.items(): yield from walk_strings(v, location+'/'+str(k))
    elif isinstance(value, list):
        for i, v in enumerate(value): yield from walk_strings(v, location+'/'+str(i))

def structural_audit(record):
    content, part = record['content'], record['part']
    if part.startswith('sprachbausteine'):
        template = content.get('text', '')
        tokens = re.findall(r'\[\[\s*(\d+)\s*\]\]', template)
        occurrences = collections.Counter(tokens)
        answers = content.get('answers', [])
        blanks = content.get('blanks', [])
        if not template.strip() and not answers:
            add('empty exercise', 'high', record, 'The stored grammar part contains no text, gaps, choices or answer key.')
            return
        answer_map = {qid(a['id']): a.get('answer', '') for a in answers}
        if set(tokens) != set(answer_map):
            add('gap/key mismatch', 'high', record, 'Visible gaps and answer-key identifiers do not match.', {'visible': sorted(set(tokens)), 'keys': list(answer_map)})
        if len(set(tokens)) != 10:
            add('unexpected gap count', 'review', record, 'The grammar text does not contain ten distinct logical gaps.', {'count':len(set(tokens))})
        duplicates = [i for i, n in collections.Counter(qid(b['id']) for b in blanks).items() if n>1]
        if duplicates:
            add('duplicated logical blank rows', 'high', record, 'The same logical gap has multiple stored choice rows.', {'gapIds':duplicates, 'storedIds':[b['id'] for b in blanks]})
        duplicate_keys = {i:[a.get('answer') for a in answers if qid(a['id'])==i] for i,n in collections.Counter(qid(a['id']) for a in answers).items() if n>1}
        if duplicate_keys:
            add('paired-gap storage redundancy', 'note', record, 'Multiple correction entries represent a paired gap. The reader resolves the pair; this is a storage normalization note, not a confirmed grading error.', duplicate_keys, 'supported representation')
        if part.endswith('2'):
            options = words(content.get('options', []))
            missing = [{'gap':i,'answer':a} for i,a in answer_map.items() if a not in options]
            if missing: add('answer not selectable', 'high', record, 'A stored correct answer is absent from the visible word bank.', {'missing':missing})
            reused = {a:ids for a,ids in ((a,[i for i,v in answer_map.items() if v==a]) for a in set(answer_map.values())) if a and len(ids)>1}
            if reused: add('word required more than once', 'high', record, 'The key requires a bank word in multiple gaps, while the UI permits each word only once.', reused)
        else:
            distinct = [{'gap':b['id'],'options':b.get('options',[])} for b in blanks if len(set(words(b.get('options'))))<3]
            if distinct: add('duplicated/missing distractor', 'high', record, 'A multiple-choice gap has fewer than three distinct choices.', {'gaps':distinct})
            missing = []
            for b in blanks:
                i=qid(b['id']); a=answer_map.get(i)
                if a is not None and resolved_answer(a,words(b.get('options')),occurrences[i]) not in words(b.get('options')):
                    missing.append({'gap':i,'answer':a,'options':b.get('options',[])})
            if missing: add('answer not selectable', 'high', record, 'A stored correct answer does not match a visible choice, even after resolving paired gaps.', {'missing':missing})
        store_conflicts=[]
        for store in ['segments','blanks']:
            seen=collections.Counter()
            for item in content.get(store,[]):
                if 'answer' not in item: continue
                i=qid(item.get('id','')); a=answer_map.get(i)
                if a is None:continue
                options=next((words(b.get('options')) for b in blanks if qid(b['id'])==i),[])
                expected=resolved_answer(a,options,occurrences[i]);pair=split_pair(expected)
                index=seen[i];seen[i]+=1
                valid=[a,expected]+([pair[index]] if occurrences[i]>1 and len(pair)==occurrences[i] and index<len(pair) else [])
                if item['answer'] not in valid:
                    store_conflicts.append({'store':store,'gap':i,'secondary':item['answer'],'primary':a})
        if store_conflicts:add('secondary correction differs', 'medium', record, 'Secondary stored answers disagree with the active key. This can affect editors or future migrations.', {'conflicts':store_conflicts})
        translated=content.get('translated','')
        if isinstance(translated,str):
            tr_ids=set(re.findall(r'\[\[(\d+)\]\]',translated))
            if tr_ids and tr_ids!=set(tokens):add('translation gap markers differ', 'review', record, 'The Arabic translation uses different gap markers. This flags alignment for review; it does not establish missing or mistranslated meaning.', {'missing':sorted(set(tokens)-tr_ids),'extra':sorted(tr_ids-set(tokens))}, 'translation alignment review needed')
    elif part == 'teil-1':
        ts=content.get('texts',[]);heads=content.get('headlines',[]);answers=content.get('answers',[])
        if len(ts)!=5 or len(heads)!=10:add('nonstandard reading format', 'note', record, 'This part differs from the usual five texts / ten headings format. Löwe explicitly instructs learners to use five headings, so it is not classified as an accidental omission.',{'texts':len(ts),'headings':len(heads),'instruction':content.get('instruction','')}, 'format variation')
        for a in answers:
            if not any(str(t['id'])==str(a.get('textId')) for t in ts) or not any(h['id']==a.get('headlineId') for h in heads):add('unresolved correction', 'high', record, 'Text/heading answer points to a missing item.',a)
    elif part == 'teil-2':
        passage=content.get('passage',{})
        if not (passage.get('text') or passage.get('paragraphs')):add('missing passage','high',record,'Lesen Teil 2 has no reading passage.')
        for q in content.get('questions',[]):
            if not any(o['id']==q.get('answerId') for o in q.get('options',[])):add('unresolved correction','high',record,'Question answer points to a missing choice.',{'question':q.get('id')})
    elif part == 'teil-3':
        ads=content.get('ads',[]);situations=content.get('situations',[])
        missing_x=[]
        for a in content.get('answers',[]):
            if a.get('adId')=='X' and not any(ad['id']=='X' for ad in ads):missing_x.append(a['situationId'])
            elif not any(ad['id']==a.get('adId') for ad in ads) or not any(str(s['id'])==str(a.get('situationId')) for s in situations):add('unresolved correction','high',record,'Situation/advert answer points to a missing item.',a)
        if missing_x:add('missing no-match choice', 'high', record, 'The answer key requires X (no matching advert), but the ads array contains no X choice and the reader renders only the stored choices.', {'situations':missing_x,'availableChoices':[a['id'] for a in ads], 'renderer':'site/lesen.js: renderLesenTeil3'})
    for field in ['ads','headlines','texts','situations','questions']:
        grouped=collections.defaultdict(list)
        for q in content.get(field,[]):
            if len(norm(text(q)))>20:grouped[norm(text(q))].append(q.get('id'))
        for material,ids in grouped.items():
            if len(ids)>1:add('duplicated exercise material','high',record,f'Different {field} entries contain identical normalized text.',{'ids':ids,'text':material[:250]})
    for location,value in walk_strings(content):
        if any(k in location for k in ['/sourceImport/','/legacyImport/','/translated','/explanation','/reason','/keywords','/highlights']):continue
        if re.search(r'\bHere you go:|\bAs an AI\b|\[object Object\]',value):
            add('generation/serialization residue','medium',record,'A non-exam phrase or serialization artifact is stored in learning content.',{'field':location,'excerpt':value[:230]})

def canonical_for(record):
    result=canonical(record['content'],'Lesen',record['part'],'current')
    if record['part'].startswith('sprachbausteine'):
        occurrences=collections.Counter(re.findall(r'\[\[(\d+)\]\]',record['content'].get('text','')))
        for q in result['questions']:
            if record['part'].endswith('1'):q['answer']=resolved_answer(q['answer'],q['options'],occurrences[qid(q['key'])])
    return result

def duplicate_key_audit():
    groups=collections.defaultdict(list)
    for record in reading:
        c=canonical_for(record)
        signature=(record['level'],record['part'],tuple(norm(m['text']) for m in c['materials']),tuple((norm(q['prompt']),tuple(sorted(norm(o) for o in q['options']))) for q in c['questions']))
        if not c['questions']:continue
        groups[signature].append((record,c))
    for group in groups.values():
        if len(group)<2:continue
        values=[tuple(norm(q['answer']) for q in c['questions']) for r,c in group]
        if len(set(values))<2:continue
        differing=[]
        for i in range(min(len(c['questions']) for r,c in group)):
            answers=[dict(theme=r['theme'],version=r['version'],question=c['questions'][i]['key'],answer=c['questions'][i]['answer']) for r,c in group]
            if len({norm(a['answer']) for a in answers})>1:differing.append(answers)
        if differing:add('identical content / different keys','high',group[0][0],'Identical normalized passages, questions and choices have different saved corrections.',{'locations':[dict(theme=r['theme'],version=r['version'],pointer=r['pointer']) for r,c in group],'differences':differing})

def source_disagreements():
    by_pointer={r['pointer']:r for r in reading}
    seen=set()
    for row in old_audit['rows']:
        if row.get('zip') is None or row.get('current') is None:continue
        e=old_audit['entries'][row['current']];s=old_audit['entries'][row['zip']]
        if e['module']!='Lesen' or e['pointer'] not in by_pointer:continue
        r=by_pointer[e['pointer']];current=canonical_for(r)
        try:raw_source=pointer(sahla,s['pointer'])
        except (KeyError,IndexError):continue
        source=canonical(raw_source,'Lesen',r['part'],'zip')
        material_norm=normalized_body if r['part'].startswith('sprachbausteine') else norm
        if [material_norm(m['text']) for m in current['materials']] != [material_norm(m['text']) for m in source['materials']]:continue
        for cq,sq in zip(current['questions'],source['questions']):
            if norm(cq['prompt'])!=norm(sq['prompt']) or sorted(norm(o) for o in cq['options'])!=sorted(norm(o) for o in sq['options']):continue
            if cq['answer'] is None or sq['answer'] is None or norm(cq['answer'])==norm(sq['answer']):continue
            identity=(r['pointer'],cq['key'],norm(sq['answer']))
            if identity in seen:continue
            seen.add(identity)
            reviewed_reason=''
            if r['part']=='teil-1':reviewed_reason=next((a.get('reason','') for a in r['content'].get('answers',[]) if str(a.get('textId'))==cq['key']),'')
            add('same material / Sahla key disagreement','review',r,'Sahla and ZDeutsch choose different answers for the same written exercise. A source disagreement alone is not proof of an error.',
                {'question':cq['key'],'currentAnswer':cq['answer'],'sahlaAnswer':sq['answer'],'sourceTitle':s['title'],'sourcePointer':s['pointer'],'existingReason':reviewed_reason},'answer adjudication needed')

def hearing_audit():
    records=[]
    for filename in ['horen-codes.json','horen-audio.json']:
        for level,lv in docs[filename]['levels'].items():
            if level not in ['b1','b2']:continue
            for theme_key,theme in lv['themes'].items():
                for part,entry in theme['hören']['parts'].items():
                    for i,c in enumerate(entry.get('content',{}).get('topics',[])):
                        r=dict(file=filename,level=level,theme=theme_key,theme_title=theme['title'],title=c.get('title',''),version='',part=part,
                            pointer=f'/levels/{level}/themes/{theme_key}/hören/parts/{part}/content/topics/{i}',content=c)
                        records.append(r)
                        if c.get('audio',{}).get('src') and not (ROOT/'site'/c['audio']['src'].lstrip('/')).is_file():add('missing listening file','high',r,'The referenced local recording does not exist.',{'src':c['audio']['src']})
                        empty=[q.get('id') for q in c.get('statements',[]) if not text(q).strip()]
                        if empty:
                            intentional='no Aussage' in c.get('tag','')
                            add('code-only listening topic' if intentional else 'incomplete listening topic','note' if intentional else 'high',r,
                                'This mnemonic topic is explicitly tagged “no Aussage”: answer codes are stored without statement text. It cannot act as a complete sentence exercise.' if intentional else 'Listening statement text is missing.',
                                {'statements':empty,'tag':c.get('tag','')}, 'known source limitation' if intentional else 'confirmed data issue')
                        for q in c.get('statements',[]):
                            if not isinstance(q.get('correct'),bool):add('missing listening correction','high',r,'Listening statement boolean correction is missing.',{'statement':q.get('id')})
    groups=collections.defaultdict(list)
    for r in records:
        signature=(r['level'],r['part'],tuple(norm(text(s)) for s in r['content'].get('statements',[])))
        if signature[-1] and all(signature[-1]):groups[signature].append(r)
    for group in groups.values():
        keys=[tuple(s.get('correct') for s in r['content']['statements']) for r in group]
        if len(set(keys))>1:add('same statements / different listening keys','review',group[0], 'Identical written statements have different true/false keys. Recording identity must be checked before correcting them.',
            {'locations':[dict(file=r['file'],theme=r['theme_title'],title=r['title'],answers=[s.get('correct') for s in r['content']['statements']],audio=r['content'].get('audio',{}).get('src')) for r in group]},'audio verification needed')
    return records

def manual_text_findings():
    for r in reading:
        c=r['content'];body=c.get('text','') if r['part'].startswith('sprach') else c.get('passage',{}).get('text','')
        if r['version']=='telc-b1-265' and r['part']=='sprachbausteine-2' and ('und [[33]] zwar' in body or any(str(a['id']) in ['31','32'] and a['answer']=='DREI' for a in c.get('answers',[]))):
            add('malformed imported grammar exercise','high',r,'The key produces “beginnen DREI im Jahr”, “findet DREI pro Woche statt” and “und SO zwar montags”. These are malformed German constructions, beyond the separate word-reuse problem.',
                {'gaps':[31,32,33],'frequencyWordNeeded':'dreimal rather than drei for the three weekly meetings','review':'The imported text, bank and key must be reviewed together; no identical Sahla source was established.'},'manual language review confirmed')
        if r['version']=='telc-b1-267' and r['part']=='sprachbausteine-2' and ('Unternehmen, [[33]] Sie' in body or any(str(a['id'])=='37' and a['answer']=='WERDEN' for a in c.get('answers',[]))):
            add('malformed imported grammar exercise','high',r,'The key produces “das Unternehmen, BEI Sie sich bewerben möchten” and “WERDEN Sie gute Chancen auf eine Einladung”. The first lacks a relative pronoun; the second lacks haben or another complete predicate.',
                {'gaps':[33,37],'likelyReadings':['bei dem Sie sich bewerben möchten','haben Sie gute Chancen / werden Sie gute Chancen haben'],'review':'These phrases cannot be repaired by filling the existing key as stored; review the imported text, bank and key together.'},'manual language review confirmed')
        typos=[(wrong,suggestion) for wrong,suggestion in [('Raschläge','Ratschläge'),('Pubertätsporobleme','Pubertätsprobleme'),('inrer','ihrer'),('tiefer gehen Ende Unterlagen','tiefergehende Unterlagen'),('besonders Klage Schüler','besonders kluge Schüler'),('das alle Rom','das alte Rom'),('Federung durch Forderung','Förderung durch Forderung')] if wrong in body]
        if typos:add('visible spelling/OCR damage','medium',r,'The visible German text contains clear spelling/OCR damage. Proposed readings need a final check against the original document.',{'examples':[{'stored':a,'likelyReading':b} for a,b in typos]},'text proofreading needed')
        if 'Als' in words([a.get('answer') for a in c.get('answers',[])]) or 'ALS' in words([a.get('answer') for a in c.get('answers',[])]):
            if 'ich einer Zeitschrift durchsah' in body:add('ungrammatical gap context','high',r,'Filling the gap produces “Als ich einer Zeitschrift durchsah”. The noun phrase is malformed; Sahla has a different corrected gap layout for its TAMARA variant.',{'storedFragment':'[[33]] ich einer Zeitschrift durchsah','preserveVariant':'Review the whole clause rather than swapping a single answer.'},'manual language review confirmed')
        if r['theme']=='karla' and r['part']=='sprachbausteine-1':
            answer=next((a.get('answer') for a in c.get('answers',[]) if str(a['id'])=='22'),None)
            if answer=='mit' and '[[22]] Motorräder' in body:add('grammar/key conflicts with noun form','high',r,'The key produces “mit Motorräder”; mit requires the dative plural “Motorrädern”. Sahla selects “ohne”, which fits the stored noun form.',{'current':'mit Motorräder','sahla':'ohne Motorräder','sourcePointer':'/collections/4/records/13/fragen/1'},'manual language review confirmed')
        if r['theme']=='teleshopping-alt' and r['part']=='sprachbausteine-2':
            answer=next((a.get('answer') for a in c.get('answers',[]) if str(a['id'])=='38'),None)
            if answer=='EHER':add('wrong word in sentence context','high',r,'The stored key yields “dieses Recht gilt EHER unbefristet, wenn …”. Sahla uses SOGAR for the same clause; this is a strong correction candidate.',{'gap':38,'current':'EHER','sahla':'SOGAR','sourcePointer':'/collections/11/records/42/options'},'strong contextual correction candidate')

def render_report(result):
    def cell(s):return str(s).replace('|','\\|').replace('\n',' ')
    def location(f):return f"{f['level'].upper()} / {f['title']} / {f['version'] or '—'} / {f['part']}"
    lines=['# ZDeutsch — remaining content audit, 22 October 2026','',
        'Read-only audit of the current local B1/B2 database after the choice repairs. The existing repaired database was not modified.', '',
        f"Scope: {len(reading)} reading/grammar part versions and {len(hearing)} listening topics. The 67 writing tasks and 220 speaking topics were additionally scanned for generation/serialization residue; this is not a full linguistic review of their open-ended answers. C1 was excluded.", '',
        'Findings distinguish definite stored-data problems, probable language errors and unresolved source/audio disagreements. Shared questions, repeated paired gap markers and different named versions are not automatically errors. Structural checks cover all listed reading parts; Sahla key comparisons recheck existing matched records, not a claim that every part has an exact Sahla counterpart. German language review is targeted to the passages below, not a complete line-by-line linguistic certification.', '',
        '## Findings summary', '',
        'Counts below are findings, not distinct themes. Multiple findings can refer to one exercise.', '',
        '| Priority | Count |', '|---|---|',
        *[f"| {severity} | {count} |" for severity,count in result['summary'].items()], '',
        '## Original audit repair checklist', '',
        'The following table records what the original audit identified. It is historical context; the current remaining findings are listed in the tables below.', '',
        '| Thema | Part | What needs attention |', '|---|---|---|',
        '| B2 Bäder; B2 Autos; B1 Laura | Lesen 3 | X is a saved correct answer but is unavailable to select. Bäder: 14; Autos: 12, 15; Laura: 14, 16. |',
        '| B1 Alicia — Version 2 (version-1) | Sprachbausteine 1 | Ten gaps are duplicated as twenty answer rows, with sixty choice buttons. “Here you go:” is visible in the passage. Both reproduced in the browser. |',
        '| B1 Vera — WIR SIND FÜR SIE DA! (telc-b1-265) | Sprachbausteine 2 | Reused words conflict with the interface; three filled phrases are malformed, including “DREI pro Woche”. |',
        '| B1 Thomas / Anna — DIE PERFEKTE BEWERBUNG (telc-b1-267) | Sprachbausteine 2 | GERNE is absent; other words are required twice. Gap 33 lacks a relative pronoun, and gap 37 produces an incomplete predicate. |',
        '| B1 Karla | Sprachbausteine 1, gap 22 | Current mit + Motorräder is grammatically incompatible. Sahla uses ohne; alternatively the noun would need Motorrädern. |',
        '| B1 Tamara / Jakob; B1 Sonja | Sprachbausteine 2, gap 33 | “Als ich einer Zeitschrift durchsah” is malformed; also Raschläge instead of Ratschläge. Preserve the exercise variant when repairing it. |',
        '| B2 Liebe Karin | Sprachbausteine 1, gap 24 | anderen / anderen / andere gives two distinct choices instead of three. |',
        '| B1 Mara — Standard (mara-alt/default) | Sprachbausteine 1 | This advertised part has no text, choices or answers. |',
        '| B1 Paul; Tamara / Jakob; Jennifer | Lesen 2 | The shared Popper passage contains several obvious OCR errors, including Pubertätsporobleme and inrer. |',
        '| B1 Corina vs Caroline | Sprachbausteine 2, gap 39 | Same passage and bank, different keys: BEREITS / über. Sahla supports über. Requires answer review. |',
        '| B2 Mobarmijine; Tanzkurs (version-1); Insel | Lesen 3, question 20 | Identical adverts/situations have X / X / G. G describes mountain-rescue risks. Requires answer review. |',
        '| B2 Teleshopping (teleshopping-alt) | Sprachbausteine 2, gaps 31 and 38 | Current DEUTLICH / EHER differs from Sahla EHER / SOGAR. SOGAR is a strong contextual candidate for gap 38; do not replace both keys blindly. |', '',
        '## Highest-priority issues','',
        '| Location | Issue | Evidence |','|---|---|---|']
    for f in findings:
        if f['severity']=='high':lines.append('| '+' | '.join(map(cell,[location(f),f['kind']+' — '+f['detail'],json.dumps(f['evidence'],ensure_ascii=False)]))+' |')
    for severity,heading in [('medium','Text and secondary-field issues'),('review','Cases requiring source, translation or audio adjudication'),('note','Supported formats and known source limitations — not confirmed errors')]:
        lines += ['', '## '+heading, '', '| Location | Finding | Details |', '|---|---|---|']
        for f in findings:
            if f['severity']==severity:lines.append('| '+' | '.join(map(cell,[location(f),f['kind']+' — '+f['detail'],json.dumps(f['evidence'],ensure_ascii=False)]))+' |')
    lines += ['', '## Exact database locations', '', 'Each row in the JSON report includes `file` and JSON Pointer. Resolve versions first; the root `theme.lesen` projection is not necessarily the active content.', '',
        '## Interpretation', '',
        '- Karla: the current answer “mit” cannot be used with the stored “Motorräder”; changing either the noun ending or the answer requires review of the intended original exercise.',
        '- Corina and Caroline contain the same lottery passage. Corina uses BEREITS for gap 39; Caroline uses über. The written exercise should have one reviewed answer; Sahla supports über.',
        '- Mobarmijine, Tanzkurs Version 1 and Insel share the same TV adverts/situations; question 20 has X in the first two and G in Insel. Inspect the G mountaineering advert before unifying the correction.',
        '- Alex und Cora has an existing explanatory override for heading C. Its difference from Sahla F is not automatically an error; the saved explanation considers the broader paragraph meaning.',
        '- Listening key differences are not judged correct/incorrect without comparing the actual audio.',
        '- Kindertelefon question 8 differs from Sahla (current B, Sahla C). Both choices overlap with the passage, so the difference is reported for adjudication, not asserted as a confirmed ZDeutsch error.',
        '- Forty-five translation-marker warnings need alignment review. They do not establish forty-five incorrect translations.',
        '- Eight listening topics are deliberately tagged no Aussage and preserve only mnemonic answer codes. Their empty statement slots are a known source limitation, not forty independent broken questions.',
        '- Some visible OCR/spelling errors are present in Sahla too. Importing the source text blindly would retain those errors.',
        '- The 22 October choice repairs are retained and are not reported again as missing choices.', '',
        '## Input preservation','',f"Verified {len(result['inputHashes'])} JSON files and the Sahla archive unchanged before/after this audit.", '',
        'Machine-readable evidence: `content-findings.json`. No corrections, imports, commits, pushes or deployments were performed.','']
    return '\n'.join(lines)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output-dir',type=Path,default=OUT)
    OUT=parser.parse_args().output_dir
    before={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in DB.glob('*.json')}
    docs={name:json.loads((DB/name).read_text()) for name in before}
    archive_hash=hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
    with zipfile.ZipFile(ARCHIVE) as archive:sahla=json.loads(archive.read('sahla-content/data.json'))
    with gzip.open(ROOT/'output/sahla-audit-2026-10-21/full-comparison-data.json.gz','rt') as stream:old_audit=json.load(stream)
    # Reuse canonical extraction only; do not run the old report builder or its database/report writes.
    tree=ast.parse((ROOT/'output/sahla-audit-2026-10-21/build_comparison.py').read_text())
    functions={'norm','text','arr','unit','opt_id','question_key','opt_text','canonical'}
    namespace={'re':re,'html':html,'unicodedata':unicodedata}
    exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in functions],type_ignores=[]),'canonical-extraction','exec'),namespace)
    canonical=namespace['canonical']
    findings=[];reading=extract_reading()
    for record in reading:structural_audit(record)
    duplicate_key_audit();source_disagreements();hearing=hearing_audit();manual_text_findings()
    # Broader modules: obvious empty entries and leaked generation text only, not semantic grading of open responses.
    broader_counts=collections.Counter()
    for filename in ['shreiben.json','mundlich.json']:
        for level,lv in docs[filename]['levels'].items():
            if level not in ['b1','b2']:continue
            rows=[('task',i,c) for i,c in enumerate(lv.get('tasks',[]))] if filename=='shreiben.json' else [(part,i,c) for part,p in lv.get('parts',{}).items() for i,c in enumerate(p.get('topics',[]))]
            for part,i,c in rows:
                broader_counts[filename]+=1
                record=dict(file=filename,level=level,theme='',theme_title=c.get('title',''),title=c.get('title',''),version='',part=part,pointer=f'/levels/{level}/'+(f'tasks/{i}' if filename=='shreiben.json' else f'parts/{part}/topics/{i}'))
                for location,value in walk_strings(c):
                    if re.search(r'\bHere you go:|\bAs an AI\b|\[object Object\]',value):add('generation/serialization residue','medium',record,'Non-exam residue is present in the stored content.',{'field':location,'excerpt':value[:200]})
    for name,expected in before.items():assert hashlib.sha256((DB/name).read_bytes()).hexdigest()==expected,name
    assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()==archive_hash
    result=dict(createdAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),scope={'readingParts':len(reading),'listeningTopics':len(hearing),**dict(broader_counts)},summary=dict(collections.Counter(f['severity'] for f in findings)),kinds=dict(collections.Counter(f['kind'] for f in findings)),findings=findings,inputHashes=before,sourceArchiveSha256=archive_hash,databaseWrites=False)
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'content-findings.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    (OUT/'content-report.md').write_text(render_report(result))
    print(json.dumps({'scope':result['scope'],'summary':result['summary'],'kinds':result['kinds'],'filesUnchanged':len(before),'reports':str(OUT)},ensure_ascii=False,indent=2))
