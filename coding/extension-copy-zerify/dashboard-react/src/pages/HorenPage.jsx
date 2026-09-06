import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff, Headphones, Plus, Save, Search, Trash2, Upload } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { apiRequest, mutationRequest, uploadBinaryRequest } from "../api/client";
import { AddButton, EmptyState, Field, LoadingState, Notice, PageHeader, RemoveButton, Section } from "../components/UI";

const levels = ["b1", "b2"];
const partKeys = ["teil-1", "teil-2", "teil-3"];

function emptyTopic() {
  return { title: "", tag: "", statements: [] };
}

export function HorenPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(emptyTopic());
  const [mode, setMode] = useState("edit");
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const level = levels.includes(params.get("level")) ? params.get("level") : "b1";
  const part = partKeys.includes(params.get("part")) ? params.get("part") : "teil-1";

  const partsQuery = useQuery({
    queryKey: ["hoeren-parts", level],
    queryFn: ({ signal }) => apiRequest(`/horen/meta?level=${level}`, { signal })
  });

  const topicsQuery = useQuery({
    queryKey: ["hoeren-topics", level, part],
    queryFn: ({ signal }) => apiRequest(`/horen/topics?level=${level}&part=${part}`, { signal })
  });

  useEffect(() => {
    const topics = topicsQuery.data?.topics || [];
    const requestedId = params.get("topicId");
    const next = topics.find((topic) => topic.id === requestedId)
      || topics.find((topic) => topic.id === selectedId)
      || topics[0];
    if (next && mode !== "create") {
      setSelectedId(next.id);
      setDraft(JSON.parse(JSON.stringify(next)));
      setMode("edit");
    }
    if (!next && topicsQuery.isSuccess) {
      setSelectedId("");
      setDraft(emptyTopic());
      setMode("create");
    }
  }, [topicsQuery.data, topicsQuery.isSuccess, level, part]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["hoeren-topics", level, part] });
    await queryClient.invalidateQueries({ queryKey: ["overview"] });
    await queryClient.invalidateQueries({ queryKey: ["repository-status"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!draft.title.trim()) throw new Error("Ein Titel ist erforderlich.");
      const body = { level, part, themeKey: topicsQuery.data?.themeKey, title: draft.title, tag: draft.tag, statements: draft.statements };
      return mode === "create"
        ? mutationRequest("/horen/topics", { method: "POST", body })
        : mutationRequest(`/horen/topics/${encodeURIComponent(selectedId)}`, { method: "PUT", body });
    },
    onSuccess: async (result) => {
      setSelectedId(result.topic.id);
      setMode("edit");
      setSaved(true);
      setParams({ level, part, topicId: result.topic.id }, { replace: true });
      await refresh();
      window.setTimeout(() => setSaved(false), 2500);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => mutationRequest(`/horen/topics/${encodeURIComponent(selectedId)}?level=${level}&part=${part}&themeKey=${encodeURIComponent(topicsQuery.data?.themeKey || "")}`, { method: "DELETE" }),
    onSuccess: async () => {
      setSelectedId("");
      setMode("edit");
      setParams({ level, part }, { replace: true });
      await refresh();
    }
  });

  const uploadMutation = useMutation({
    mutationFn: (file) => uploadBinaryRequest(`/horen/topics/${encodeURIComponent(selectedId)}/audio?level=${level}&part=${part}&themeKey=${encodeURIComponent(topicsQuery.data?.themeKey || "")}`, file),
    onSuccess: refresh
  });

  const removeAudioMutation = useMutation({
    mutationFn: () => mutationRequest(`/horen/topics/${encodeURIComponent(selectedId)}/audio?level=${level}&part=${part}&themeKey=${encodeURIComponent(topicsQuery.data?.themeKey || "")}`, { method: "DELETE" }),
    onSuccess: refresh
  });

  const partVisibilityMutation = useMutation({
    mutationFn: (partState) => mutationRequest("/horen/parts/visibility", { method: "PUT", body: { level, themeKey: partsQuery.data?.themeKey, partKey: partState.key, visible: !partState.visible } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["hoeren-parts", level] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      await queryClient.invalidateQueries({ queryKey: ["repository-status"] });
    }
  });

  const topics = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("de");
    return (topicsQuery.data?.topics || []).filter((topic) => !needle || `${topic.title} ${topic.tag}`.toLocaleLowerCase("de").includes(needle));
  }, [search, topicsQuery.data]);

  const selectTopic = (topic) => {
    setSelectedId(topic.id);
    setDraft(JSON.parse(JSON.stringify(topic)));
    setMode("edit");
    setParams({ level, part, topicId: topic.id }, { replace: true });
  };

  const changeContext = (key, value) => {
    const next = new URLSearchParams(params);
    next.set(key, value);
    next.delete("topicId");
    setMode("edit");
    setSelectedId("");
    setParams(next);
  };

  const updateStatement = (index, patch) => {
    const statements = [...(draft.statements || [])];
    statements[index] = { ...statements[index], ...patch };
    setDraft({ ...draft, statements });
  };

  const partStates = partsQuery.data?.parts || partKeys.map((key, index) => ({ key, label: `Teil ${index + 1}`, available: true, visible: true }));
  const error = topicsQuery.error || partsQuery.error || saveMutation.error || deleteMutation.error || uploadMutation.error || removeAudioMutation.error || partVisibilityMutation.error;

  return (
    <div className="page module-page">
      <PageHeader eyebrow="Hören" title="Hörverstehen verwalten" description="Bearbeiten Sie Themen, Aussagen, Lösungen und Audiodateien direkt in der React-App." actions={<button className="button button--primary" type="button" onClick={() => { setMode("create"); setSelectedId(""); setDraft(emptyTopic()); }}><Plus size={17} /> Neues Thema</button>} />
      {error && <Notice type="error">{error.message}</Notice>}
      {saved && <Notice>Das Hörthema wurde gespeichert.</Notice>}

      <div className="toolbar">
        <div className="segmented" aria-label="Sprachniveau">{levels.map((item) => <button key={item} type="button" className={level === item ? "active" : ""} onClick={() => changeContext("level", item)}>{item.toUpperCase()}</button>)}</div>
        <div className="segmented" aria-label="Prüfungsteil">{partStates.map((item) => <button key={item.key} type="button" className={`${part === item.key ? "active" : ""} ${item.visible ? "" : "is-muted"}`} onClick={() => changeContext("part", item.key)}>{item.label}{item.visible ? "" : " · aus"}</button>)}</div>
        <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hörthemen durchsuchen…" aria-label="Hörthemen durchsuchen" /></label>
        <span className="count-badge">{topics.length} Themen</span>
      </div>
      <div className="part-visibility-bar"><span>Sichtbarkeit in der Hörprüfung</span><div>{partStates.filter((item) => item.available).map((item) => <button className={`visibility-chip ${item.visible ? "" : "visibility-chip--hidden"}`} type="button" key={item.key} disabled={partVisibilityMutation.isPending} onClick={() => partVisibilityMutation.mutate(item)}>{item.visible ? <EyeOff size={14} /> : <Eye size={14} />}{item.label} {item.visible ? "ausblenden" : "einblenden"}</button>)}</div></div>

      {topicsQuery.isLoading ? <LoadingState label="Hörthemen werden geladen…" /> : (
        <div className="content-workspace">
          <aside className="entity-list" aria-label="Hörthemen">
            {topics.map((topic) => <button key={topic.id} type="button" className={`entity-list__item ${selectedId === topic.id ? "active" : ""}`} onClick={() => selectTopic(topic)}><span className="entity-list__icon"><Headphones size={17} /></span><span><strong>{topic.title}</strong><small>{topic.tag || topic.id}</small></span><b>{topic.statementsCount}</b></button>)}
            {!topics.length && <EmptyState title="Keine Hörthemen gefunden" description="Legen Sie ein neues Thema an oder ändern Sie den Suchbegriff." />}
          </aside>

          <section className="content-editor">
            <div className="content-editor__header"><div><span className="section-kicker">{mode === "create" ? "Neu" : `${level.toUpperCase()} · ${part.replace("-", " ")}`}</span><h2>{mode === "create" ? "Hörthema anlegen" : draft.title}</h2></div><div className="header-actions">{mode === "edit" && <button className="button button--danger-ghost" type="button" onClick={() => window.confirm("Dieses Hörthema wirklich löschen?") && deleteMutation.mutate()}><Trash2 size={16} /> Löschen</button>}<button className="button button--primary" type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}><Save size={16} /> {saveMutation.isPending ? "Speichert…" : "Speichern"}</button></div></div>
            <div className="content-editor__body">
              <div className="form-grid"><Field label="Titel"><input value={draft.title || ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field><Field label="Kennzeichnung"><input value={draft.tag || ""} onChange={(event) => setDraft({ ...draft, tag: event.target.value })} /></Field></div>

              {mode === "edit" && <Section title="Audiodatei" description={draft.audio?.fileName || "Noch keine Audiodatei hinterlegt."} action={<div className="header-actions"><label className="button button--secondary button--small upload-button"><Upload size={15} /> Audio hochladen<input type="file" accept="audio/*" onChange={(event) => event.target.files?.[0] && uploadMutation.mutate(event.target.files[0])} /></label>{draft.audio && <button className="button button--danger-ghost button--small" type="button" onClick={() => removeAudioMutation.mutate()}>Entfernen</button>}</div>}>{draft.audio?.src && <audio controls preload="metadata" src={`/site-assets/${draft.audio.src.replace(/^assets\//, "")}`} />}</Section>}

              <Section title="Aussagen" description="Markieren Sie für jede Aussage, ob sie richtig oder falsch ist." action={<AddButton onClick={() => setDraft({ ...draft, statements: [...(draft.statements || []), { number: (draft.statements || []).length + 1, text: "", correct: false }] })}>Aussage hinzufügen</AddButton>}>
                <div className="statement-list">{(draft.statements || []).map((statement, index) => <div className="statement-row" key={statement.id || index}><Field label="Nr."><input type="number" value={statement.number || index + 1} onChange={(event) => updateStatement(index, { number: Number(event.target.value) })} /></Field><Field label="Aussage"><textarea rows="2" value={statement.text || ""} onChange={(event) => updateStatement(index, { text: event.target.value })} /></Field><label className="boolean-field"><input type="checkbox" checked={Boolean(statement.correct)} onChange={(event) => updateStatement(index, { correct: event.target.checked })} /><span><Check size={15} /> Richtig</span></label><RemoveButton label="Aussage entfernen" onClick={() => setDraft({ ...draft, statements: draft.statements.filter((_, itemIndex) => itemIndex !== index) })} /></div>)}</div>
              </Section>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
