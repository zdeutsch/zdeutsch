import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, MessagesSquare, Plus, RefreshCw, Save } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { apiRequest, mutationRequest } from "../api/client";
import { AddButton, EmptyState, Field, LoadingState, Notice, PageHeader, RemoveButton, Section } from "../components/UI";

const speakingLevels = ["b1", "b2"];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function StringListEditor({ title, description, values = [], onChange }) {
  return (
    <Section title={title} description={description} action={<AddButton onClick={() => onChange([...values, ""])}>Eintrag hinzufügen</AddButton>}>
      <div className="simple-list">{values.map((value, index) => <div className="simple-list__row" key={index}><span>{index + 1}</span><input value={value} onChange={(event) => { const next = [...values]; next[index] = event.target.value; onChange(next); }} /><RemoveButton onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} /></div>)}</div>
    </Section>
  );
}

function DiscussionTopics({ topics = [], onChange }) {
  const update = (index, patch) => {
    const next = [...topics];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  return (
    <Section title="Diskussionsthemen" description={`${topics.length} Themen mit zwei Positionen`} action={<AddButton onClick={() => onChange([...topics, { id: `diskussion-${Date.now()}`, title: "", personA: { speaker: "", opinion: "" }, personB: { speaker: "", opinion: "" } }])}>Thema hinzufügen</AddButton>}>
      <div className="item-list">{topics.map((topic, index) => <details className="topic-editor" key={topic.id || index}><summary><span><MessagesSquare size={16} /><strong>{topic.title || `Thema ${index + 1}`}</strong></span><code>{topic.id}</code></summary><div className="topic-editor__body"><div className="form-grid"><Field label="Kennung"><input value={topic.id || ""} onChange={(event) => update(index, { id: event.target.value })} /></Field><Field label="Titel"><input value={topic.title || ""} onChange={(event) => update(index, { title: event.target.value })} /></Field><Field label="Person A" className="field--wide"><input value={topic.personA?.speaker || ""} onChange={(event) => update(index, { personA: { ...topic.personA, speaker: event.target.value } })} /></Field><Field label="Position A" className="field--wide"><textarea rows="5" value={topic.personA?.opinion || ""} onChange={(event) => update(index, { personA: { ...topic.personA, opinion: event.target.value } })} /></Field><Field label="Person B" className="field--wide"><input value={topic.personB?.speaker || ""} onChange={(event) => update(index, { personB: { ...topic.personB, speaker: event.target.value } })} /></Field><Field label="Position B" className="field--wide"><textarea rows="5" value={topic.personB?.opinion || ""} onChange={(event) => update(index, { personB: { ...topic.personB, opinion: event.target.value } })} /></Field></div><div className="item-actions"><button className="button button--danger-ghost button--small" type="button" onClick={() => onChange(topics.filter((_, itemIndex) => itemIndex !== index))}>Thema entfernen</button></div></div></details>)}</div>
    </Section>
  );
}

function PlanningTopics({ topics = [], onChange }) {
  const update = (index, patch) => {
    const next = [...topics];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };
  return (
    <Section title="Planungsaufgaben" description={`${topics.length} gemeinsame Planungssituationen`} action={<AddButton onClick={() => onChange([...topics, { id: `planung-${Date.now()}`, title: "", prompt: "", notes: [] }])}>Aufgabe hinzufügen</AddButton>}>
      <div className="item-list">{topics.map((topic, index) => <details className="topic-editor" key={topic.id || index}><summary><span><MessagesSquare size={16} /><strong>{topic.title || `Aufgabe ${index + 1}`}</strong></span><code>{topic.id}</code></summary><div className="topic-editor__body"><div className="form-grid"><Field label="Kennung"><input value={topic.id || ""} onChange={(event) => update(index, { id: event.target.value })} /></Field><Field label="Titel"><input value={topic.title || ""} onChange={(event) => update(index, { title: event.target.value })} /></Field><Field label="Situation" className="field--wide"><textarea rows="6" value={topic.prompt || ""} onChange={(event) => update(index, { prompt: event.target.value })} /></Field></div><StringListEditor title="Notizen" description="Stichpunkte für das Gespräch" values={topic.notes || []} onChange={(notes) => update(index, { notes })} /><div className="item-actions"><button className="button button--danger-ghost button--small" type="button" onClick={() => onChange(topics.filter((_, itemIndex) => itemIndex !== index))}>Aufgabe entfernen</button></div></div></details>)}</div>
    </Section>
  );
}

export function SprechenPage() {
  const [params, setParams] = useSearchParams();
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [revision, setRevision] = useState("");
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const requestedLevel = params.get("level");
  const level = speakingLevels.includes(requestedLevel) ? requestedLevel : "b1";
  const partKey = params.get("part") || "teil-1";

  const contextQuery = useQuery({
    queryKey: ["sprechen-context", level, partKey],
    queryFn: ({ signal }) => apiRequest(`/sprechen/editor-context?level=${level}&partKey=${partKey}`, { signal })
  });

  useEffect(() => {
    if (!contextQuery.data) return;
    setRevision(contextQuery.data.revision || "");
    if (contextQuery.data.part) {
      const next = clone(contextQuery.data.part);
      setDraft(next);
      setOriginal(next);
    } else {
      setDraft(null);
      setOriginal(null);
    }
    if (contextQuery.data.level !== level || (contextQuery.data.part && contextQuery.data.partKey !== partKey)) {
      setParams({ level: contextQuery.data.level, part: contextQuery.data.partKey || partKey }, { replace: true });
    }
  }, [contextQuery.data]);

  const dirty = useMemo(() => Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original)), [draft, original]);

  const saveMutation = useMutation({
    mutationFn: () => mutationRequest("/sprechen/part", { method: "PUT", body: { level: contextQuery.data.level, partKey: contextQuery.data.partKey, revision, part: draft } }),
    onSuccess: async (result) => {
      setDraft(clone(result.part));
      setOriginal(clone(result.part));
      setRevision(result.revision);
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      await queryClient.invalidateQueries({ queryKey: ["repository-status"] });
      window.setTimeout(() => setSaved(false), 2500);
    }
  });

  const visibilityMutation = useMutation({
    mutationFn: (part) => mutationRequest("/sprechen/part/visibility", { method: "PUT", body: { level: contextQuery.data.level, partKey: part.key, visible: !part.visible, revision } }),
    onSuccess: async () => {
      await contextQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      await queryClient.invalidateQueries({ queryKey: ["repository-status"] });
    }
  });

  const createLevelMutation = useMutation({
    mutationFn: () => mutationRequest("/sprechen/level", { method: "POST", body: { level, revision } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sprechen-context"] });
      await contextQuery.refetch();
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      await queryClient.invalidateQueries({ queryKey: ["repository-status"] });
    }
  });

  const changeLevel = (nextLevel) => {
    if (nextLevel === level) return;
    if (dirty && !window.confirm("Ungespeicherte Änderungen verwerfen und das Niveau wechseln?")) return;
    setParams({ level: nextLevel, part: "teil-1" });
  };

  const changePart = (nextPart) => {
    if (dirty && !window.confirm("Ungespeicherte Änderungen verwerfen und einen anderen Teil öffnen?")) return;
    setParams({ level: contextQuery.data?.level || level, part: nextPart });
  };

  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const error = contextQuery.error || saveMutation.error || visibilityMutation.error || createLevelMutation.error;
  const levelOptions = contextQuery.data?.levelOptions || speakingLevels.map((key) => ({ key, available: key === "b1" }));
  const levelAvailable = contextQuery.data?.levelAvailable;

  return (
    <div className="page editor-page">
      <PageHeader eyebrow="Sprechen" title="Mündliche Prüfung verwalten" description="Verwalten Sie die mündliche Prüfung getrennt nach B1 und B2." actions={<div className="header-actions"><button className="button button--secondary" type="button" onClick={() => contextQuery.refetch()}><RefreshCw size={16} /> Neu laden</button><button className="button button--primary" type="button" disabled={!dirty || saveMutation.isPending || !levelAvailable} onClick={() => saveMutation.mutate()}><Save size={16} /> {saveMutation.isPending ? "Speichert…" : "Speichern"}</button></div>} />
      {error && <Notice type="error">{error.message}{saveMutation.error?.status === 409 ? " Die Daten wurden zwischenzeitlich geändert. Bitte neu laden." : ""}</Notice>}
      {saved && <Notice>Der Prüfungsteil wurde gespeichert.</Notice>}

      <div className="toolbar sprechen-level-toolbar"><span className="toolbar-label">Niveau</span><div className="segmented">{levelOptions.map((option) => <button type="button" key={option.key} className={`${option.key === level ? "active" : ""} ${option.available ? "" : "is-empty"}`} onClick={() => changeLevel(option.key)}>{option.key.toUpperCase()}{option.available ? "" : " · leer"}</button>)}</div></div>

      {levelAvailable && <>
        <div className="editor-context sprechen-context"><div className="part-tabs">{(contextQuery.data?.parts || []).map((part) => <button type="button" key={part.key} className={`${part.key === contextQuery.data?.partKey ? "active" : ""} ${part.visible ? "" : "is-muted"}`} onClick={() => changePart(part.key)}><strong>{part.title}</strong><small>{part.itemCount} Einträge · {part.durationMinutes} Min.{part.visible ? "" : " · ausgeblendet"}</small></button>)}</div></div>
        <div className="part-visibility-bar"><span>Sichtbarkeit in der mündlichen Prüfung</span><div>{(contextQuery.data?.parts || []).map((part) => <button className={`visibility-chip ${part.visible ? "" : "visibility-chip--hidden"}`} type="button" key={part.key} disabled={dirty || visibilityMutation.isPending} title={dirty ? "Bitte speichern oder neu laden, bevor Sie die Sichtbarkeit ändern." : ""} onClick={() => visibilityMutation.mutate(part)}>{part.visible ? <EyeOff size={14} /> : <Eye size={14} />}{part.shortTitle || part.title} {part.visible ? "ausblenden" : "einblenden"}</button>)}</div></div>
      </>}

      {contextQuery.isLoading ? <LoadingState label="Sprechprüfung wird geladen…" /> : !levelAvailable ? <EmptyState title={`${level.toUpperCase()} ist noch nicht angelegt`} description={`Legen Sie eine leere ${level.toUpperCase()}-Sprechprüfung mit drei Prüfungsteilen an. Vorhandene Inhalte anderer Niveaus bleiben unverändert.`} action={<button className="button button--primary" type="button" disabled={createLevelMutation.isPending} onClick={() => createLevelMutation.mutate()}><Plus size={16} /> {createLevelMutation.isPending ? "Wird angelegt…" : `${level.toUpperCase()}-Niveau anlegen`}</button>} /> : !draft || !contextQuery.data?.part ? <EmptyState title="Prüfungsteil nicht gefunden" /> : (
        <div className="editor-sections">
          <Section title="Prüfungsteil" description={`${contextQuery.data.levelTitle} · ${contextQuery.data.partKey}`}>
            <div className="form-grid"><Field label="Titel"><input value={draft.title || ""} onChange={(event) => update("title", event.target.value)} /></Field><Field label="Kurzbezeichnung"><input value={draft.shortTitle || ""} onChange={(event) => update("shortTitle", event.target.value)} /></Field><Field label="Dauer in Minuten"><input type="number" min="0" value={draft.durationMinutes || 0} onChange={(event) => update("durationMinutes", Number(event.target.value))} /></Field><Field label="Quellen-URL"><input value={draft.sourceUrl || ""} onChange={(event) => update("sourceUrl", event.target.value)} /></Field><Field label="Arbeitsanweisung" className="field--wide"><textarea rows="4" value={draft.instruction || ""} onChange={(event) => update("instruction", event.target.value)} /></Field></div>
          </Section>
          {contextQuery.data.partKey === "teil-1" && <><StringListEditor title="Gesprächsimpulse" description="Themen für die persönliche Vorstellung" values={draft.prompts || []} onChange={(values) => update("prompts", values)} /><StringListEditor title="Rückfragen" description="Mögliche vertiefende Fragen" values={draft.followUps || []} onChange={(values) => update("followUps", values)} /></>}
          {contextQuery.data.partKey === "teil-2" && <DiscussionTopics topics={draft.topics || []} onChange={(topics) => update("topics", topics)} />}
          {contextQuery.data.partKey === "teil-3" && <PlanningTopics topics={draft.topics || []} onChange={(topics) => update("topics", topics)} />}
        </div>
      )}
    </div>
  );
}
