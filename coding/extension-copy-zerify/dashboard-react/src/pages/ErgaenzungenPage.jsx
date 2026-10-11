import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save } from "lucide-react";
import { apiRequest } from "../api/client";
import { Field, LoadingState, Notice, PageHeader, Section } from "../components/UI";

const clone = value => JSON.parse(JSON.stringify(value));
const lines = text => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
function ExerciseEditor({ item, revision, onSaved }) {
  const [draft, setDraft] = useState(() => clone(item));
  const [audioPath, setAudioPath] = useState(item.audio?.src || "");
  const [audioNote, setAudioNote] = useState(item.audio?.note || "");
  const save = useMutation({
    mutationFn: () => apiRequest(`/exercise-catalog/additions/${encodeURIComponent(item.id)}?level=${item.level || item.target.level}`, { method: "PUT", body: { revision, patch: {
      title: draft.title, names: draft.names, payload: draft.payload, enabled: draft.enabled, review: draft.review,
      audio: audioPath.trim() ? { src: audioPath.trim(), status: "verified", note: audioNote } : null
    } } }), onSuccess: onSaved
  });
  function payload(update) { setDraft(current => ({ ...current, payload: update(clone(current.payload)), review: { answerStatus: "unverified", note: "" } })); }
  return <Section title={draft.title} description={item.target ? `Im Themenbestand: ${item.contextTitle} · ${item.versionLabel || item.module}` : "Diese Änderungen betreffen nur die zusätzliche Einzelübung."} action={<button className="button button--primary" disabled={save.isPending} onClick={() => save.mutate()}><Save size={16} />Speichern</button>}>
    {save.error && <Notice type="error">{save.error.message}</Notice>}
    <div className="form-grid">
      <Field label="Übungsname"><input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} /></Field>
      <Field label="Weitere Namen" hint="Ein Name pro Zeile"><textarea rows="3" value={draft.names.join("\n")} onChange={e => setDraft({ ...draft, names: lines(e.target.value) })} /></Field>
      <Field label="Sichtbarkeit"><select value={draft.enabled ? "visible" : "hidden"} onChange={e => setDraft({ ...draft, enabled: e.target.value === "visible" })}><option value="visible">In der Bibliothek sichtbar</option><option value="hidden">Ausgeblendet</option></select></Field>
      <Field label="Lösungsprüfung"><select value={draft.review.answerStatus} onChange={e => setDraft({ ...draft, review: { ...draft.review, answerStatus: e.target.value } })}><option value="unverified">Originale Lösungen noch nicht geprüft</option><option value="verified">Lösungen geprüft</option></select></Field>
      <Field label="Prüfnotiz" hint="Bei geprüften Lösungen erforderlich." className="field--wide"><textarea value={draft.review.note} onChange={e => setDraft({ ...draft, review: { ...draft.review, note: e.target.value } })} /></Field>
    </div>
    {draft.module === "lesen" && <>
      <Field label="Lückentext"><textarea rows="12" value={draft.payload.text} onChange={e => payload(p => ({ ...p, text: e.target.value }))} /></Field>
      <p>Die Lücken {draft.partKey === "sprachbausteine-2" ? "[[31]] bis [[40]]" : "[[21]] bis [[30]]"} bleiben mit den entsprechenden Antworten verknüpft.</p>
      {draft.partKey === "sprachbausteine-2" && <Field label="Wortbank" hint="Ein Wort pro Zeile"><textarea rows="8" value={draft.payload.options.join("\n")} onChange={e => payload(p => { p.options = lines(e.target.value); p.wordBank = p.options.map((text, index) => ({ id: String.fromCharCode(97 + index), text })); return p; })} /></Field>}
      {draft.payload.blanks.map((gap, index) => <div className="form-grid" key={gap.id}>
        {draft.partKey === "sprachbausteine-1" && <Field label={`Lücke ${gap.id}: Auswahl`} hint="Drei Möglichkeiten, eine pro Zeile"><textarea rows="3" value={gap.options.join("\n")} onChange={e => payload(p => { p.blanks[index].options = lines(e.target.value); return p; })} /></Field>}
        <Field label={`Lücke ${gap.id}: richtige Lösung`}><input value={draft.payload.answers.find(a => a.id === gap.id)?.answer || ""} onChange={e => payload(p => { p.answers.find(a => a.id === gap.id).answer = e.target.value; return p; })} /></Field>
      </div>)}
    </>}
    {draft.module === "horen" && <>
      {draft.payload.statements.map((statement, index) => <div className="form-grid" key={statement.id}>
        <Field label={`Aussage ${statement.number}`}><textarea value={statement.text} onChange={e => payload(p => { p.statements[index].text = e.target.value; return p; })} /></Field>
        <Field label="Lösung"><select value={String(statement.correct)} onChange={e => payload(p => { p.statements[index].correct = e.target.value === "true"; return p; })}><option value="true">Richtig</option><option value="false">Falsch</option></select></Field>
      </div>)}
      <div className="form-grid"><Field label="Geprüfte Aufnahme" hint="Pfad einer vorhandenen lokalen Audiodatei, z. B. assets/audio/horen/meine-aufnahme.mp3"><input value={audioPath} onChange={e => setAudioPath(e.target.value)} /></Field><Field label="Prüfnotiz zur Aufnahme" hint="Beschreiben Sie, dass Aufnahme und Aussagen übereinstimmen."><textarea value={audioNote} onChange={e => setAudioNote(e.target.value)} /></Field></div>
    </>}
    {draft.module === "shreiben" && [ ["istructions", "Arbeitsanweisung"], ["content", "Anzeige"], ["tasks", "Leitpunkte"] ].map(([key, label]) => <Field label={label} key={key}><textarea rows="8" value={draft.payload[key]} onChange={e => payload(p => ({ ...p, [key]: e.target.value }))} /></Field>)}
    <p className="field__hint">Originalquelle: {item.provenance.url}</p>
  </Section>;
}
function NamesEditor({ item, revision, onSaved }) {
  const [labels, setLabels] = useState(item.names?.map(n => n.label).join("\n") || "");
  const [subtitle, setSubtitle] = useState(item.subtitle || "");
  const [rebind, setRebind] = useState(false), [reviewNote, setReviewNote] = useState("");
  const save = useMutation({ mutationFn: () => apiRequest(`/exercise-catalog/names/${encodeURIComponent(item.id)}?level=${item.level || item.target.level}`, { method: "PUT", body: { revision, labels: lines(labels), subtitle, target: item.target, rebind, reviewNote } }), onSuccess: onSaved });
  return <Section title={item.context || item.label} description={item.target.kind === "theme" ? "Alternative Namen für das komplette Thema; der aktuelle Titel bleibt bestehen." : "Namen für diesen Teil; das komplette Thema behält seinen aktuellen Titel."} action={<button className="button button--primary" disabled={save.isPending || (item.available === false && (!rebind || !reviewNote.trim()))} onClick={() => save.mutate()}><Save size={16} />Namen speichern</button>}>
    {save.error && <Notice type="error">{save.error.message}</Notice>}
    {item.available === false && <Notice type="error">Der Inhalt dieser Referenz hat sich geändert. Prüfen Sie die Zuordnung, bevor Sie Namen hinzufügen.</Notice>}
    {item.available === false && <><Field label="Zuordnung erneut geprüft"><input type="checkbox" checked={rebind} onChange={e => setRebind(e.target.checked)} /></Field><Field label="Notiz zur Zuordnungsprüfung"><textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} /></Field></>}
    <Field label={item.target.kind === "theme" ? "Zusätzliche Beschreibung" : "Untertitel des Teils"}><input value={subtitle} onChange={e => setSubtitle(e.target.value)} /></Field>
    <Field label="Alternative Namen" hint="Ein Name pro Zeile. Gleiche Namen sind bei mehreren Übungen erlaubt."><textarea rows="8" value={labels} onChange={e => setLabels(e.target.value)} /></Field>
    <p className="field__hint">{item.target.level.toUpperCase()} · {item.label || "Thema"}</p>
  </Section>;
}
export function ErgaenzungenPage() {
  const client = useQueryClient();
  const [level, setLevel] = useState("b2");
  const query = useQuery({ queryKey: ["exercise-catalog", level], queryFn: ({ signal }) => apiRequest(`/exercise-catalog?level=${level}`, { signal }) });
  const targets = useQuery({ queryKey: ["exercise-name-targets", level], queryFn: ({ signal }) => apiRequest(`/exercise-catalog/targets?level=${level}`, { signal }) });
  const [tab, setTab] = useState("additions"), [search, setSearch] = useState(""), [selectedId, setSelectedId] = useState(null), [newTargetId, setNewTargetId] = useState("");
  const [newItem, setNewItem] = useState(null), [saved, setSaved] = useState(false);
  const all = query.data?.[tab] || [];
  const items = useMemo(() => all.filter(item => [item.title, item.subtitle, item.context, ...(item.names || []).map(name => typeof name === "string" ? name : name.label)].join(" ").toLowerCase().includes(search.toLowerCase())), [all, search]);
  const selected = newItem || all.find(item => item.id === selectedId) || items[0];
  const onSaved = () => { setSaved(true); setNewItem(null); client.invalidateQueries({ queryKey: ["exercise-catalog"] }); };
  return <div className="page-stack">
    <PageHeader eyebrow={`${level.toUpperCase()} · Themenbestand`} title="Importierte Übungen und Namen" description="Importierte Übungen im Themenbestand, ihre Lösungen und alternative Namen verwalten." />
    <Field label="Niveau"><select value={level} onChange={e => { setLevel(e.target.value); setSelectedId(null); setNewItem(null); setNewTargetId(""); setSearch(""); setSaved(false); }}><option value="b2">B2</option><option value="b1">B1</option></select></Field>
    {query.isLoading && <LoadingState />}{query.error && <Notice type="error">{query.error.message}</Notice>}{saved && <Notice>Gespeichert.</Notice>}
    <div className="exercise-admin-tabs"><button type="button" className="button button--secondary" aria-pressed={tab === "additions"} onClick={() => { setTab("additions"); setSelectedId(null); setNewItem(null); setSearch(""); }}>Importierte Übungen ({query.data?.additions.length || 0})</button><button type="button" className="button button--secondary" aria-pressed={tab === "names"} onClick={() => { setTab("names"); setSelectedId(null); setNewItem(null); setSearch(""); }}>Namen und Zuordnungen</button></div>
    {tab === "names" && <div className="exercise-admin-tabs"><select aria-label="Neues Thema oder Teil für alternative Namen" value={newTargetId} onChange={e => setNewTargetId(e.target.value)}><option value="">Thema oder Teil wählen…</option>{(targets.data || []).map(target => <option key={target.id} value={target.id}>{target.label}</option>)}</select><button className="button button--secondary" disabled={!newTargetId} onClick={() => { const existing = all.find(item => item.id === newTargetId); if (existing) { setNewItem(null); setSelectedId(existing.id); } else { const target = targets.data.find(t => t.id === newTargetId); setNewItem({ ...target, context: target.label, names: [], subtitle: "", available: true }); } setSaved(false); }}><Plus size={16} />Namen hinzufügen</button></div>}
    {query.data && <div className="exercise-admin-layout"><Section title="Auswahl"><Field label="Suchen"><input type="search" value={search} onChange={e => setSearch(e.target.value)} /></Field><div className="exercise-admin-list">{items.map(item => <button className="button button--subtle" key={item.id} aria-pressed={item.id === selected?.id} onClick={() => { setSelectedId(item.id); setNewItem(null); setSaved(false); }}><span>{item.title || item.subtitle || item.context}</span><small>{[item.context, item.versionLabel, item.label || item.module, item.target?.kind === "theme" ? "Komplettes Thema" : ""].filter(Boolean).join(" · ")}</small></button>)}</div></Section>
      {selected && (tab === "additions" ? <ExerciseEditor key={`${selected.id}:${query.data.additionsRevision}`} item={selected} revision={query.data.additionsRevision} onSaved={onSaved} /> : <NamesEditor key={`${selected.id}:${query.data.namesRevision}`} item={selected} revision={query.data.namesRevision} onSaved={onSaved} />)}</div>}
  </div>;
}
