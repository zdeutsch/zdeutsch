import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileImage, FilePenLine, Plus, Save, Search, Trash2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { apiRequest, mutationRequest } from "../api/client";
import { EmptyState, Field, LoadingState, Notice, PageHeader, Section } from "../components/UI";

const levels = ["b1", "b2"];

function emptyTask() {
  return { title: "", istructions: "", content: "", tasks: "" };
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Das Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

export function SchreibenPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(emptyTask());
  const [mode, setMode] = useState("edit");
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const level = levels.includes(params.get("level")) ? params.get("level") : "b1";

  const tasksQuery = useQuery({
    queryKey: ["schreiben-tasks", level],
    queryFn: ({ signal }) => apiRequest(`/shreiben/tasks?level=${level}`, { signal })
  });

  useEffect(() => {
    const tasks = tasksQuery.data || [];
    const requestedId = params.get("taskId");
    const next = tasks.find((task) => task.id === requestedId)
      || tasks.find((task) => task.id === selectedId)
      || tasks[0];
    if (next && mode !== "create") {
      setSelectedId(next.id);
      setDraft({ ...emptyTask(), ...next });
      setMode("edit");
    }
    if (!next && tasksQuery.isSuccess) {
      setSelectedId("");
      setDraft(emptyTask());
      setMode("create");
    }
  }, [tasksQuery.data, tasksQuery.isSuccess, level]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["schreiben-tasks", level] });
    await queryClient.invalidateQueries({ queryKey: ["overview"] });
    await queryClient.invalidateQueries({ queryKey: ["repository-status"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = { level, title: draft.title, istructions: draft.istructions, content: draft.content, tasks: draft.tasks };
      return mode === "create"
        ? mutationRequest("/shreiben/tasks", { method: "POST", body })
        : mutationRequest(`/shreiben/tasks/${encodeURIComponent(selectedId)}`, { method: "PUT", body });
    },
    onSuccess: async (result) => {
      setSelectedId(result.id);
      setMode("edit");
      setSaved(true);
      setParams({ level, taskId: result.id }, { replace: true });
      await refresh();
      window.setTimeout(() => setSaved(false), 2500);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => mutationRequest(`/shreiben/tasks/${encodeURIComponent(selectedId)}?level=${level}`, { method: "DELETE" }),
    onSuccess: async () => {
      setSelectedId("");
      setParams({ level }, { replace: true });
      await refresh();
    }
  });

  const extractMutation = useMutation({
    mutationFn: async (file) => mutationRequest("/shreiben/extract-task", { method: "POST", body: { imageDataUrl: await readAsDataUrl(file) } }),
    onSuccess: (result) => setDraft({ ...emptyTask(), ...result })
  });

  const tasks = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("de");
    return (tasksQuery.data || []).filter((task) => !needle || `${task.title} ${task.istructions}`.toLocaleLowerCase("de").includes(needle));
  }, [search, tasksQuery.data]);

  const selectTask = (task) => {
    setSelectedId(task.id);
    setDraft({ ...emptyTask(), ...task });
    setMode("edit");
    setParams({ level, taskId: task.id }, { replace: true });
  };

  const changeLevel = (nextLevel) => {
    setMode("edit");
    setSelectedId("");
    setParams({ level: nextLevel });
  };

  const error = tasksQuery.error || saveMutation.error || deleteMutation.error || extractMutation.error;

  return (
    <div className="page module-page">
      <PageHeader eyebrow="Schreiben" title="Schreibaufgaben verwalten" description="Bearbeiten Sie Aufgabenstellung, Ausgangstext und Leitpunkte in einem Arbeitsbereich." actions={<button className="button button--primary" type="button" onClick={() => { setMode("create"); setSelectedId(""); setDraft(emptyTask()); }}><Plus size={17} /> Neue Aufgabe</button>} />
      {error && <Notice type="error">{error.message}</Notice>}
      {saved && <Notice>Die Schreibaufgabe wurde gespeichert.</Notice>}

      <div className="toolbar">
        <div className="segmented" aria-label="Sprachniveau">{levels.map((item) => <button key={item} type="button" className={level === item ? "active" : ""} onClick={() => changeLevel(item)}>{item.toUpperCase()}</button>)}</div>
        <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Schreibaufgaben durchsuchen…" aria-label="Schreibaufgaben durchsuchen" /></label>
        <span className="count-badge">{tasks.length} Aufgaben</span>
      </div>

      {tasksQuery.isLoading ? <LoadingState label="Schreibaufgaben werden geladen…" /> : (
        <div className="content-workspace">
          <aside className="entity-list" aria-label="Schreibaufgaben">
            {tasks.map((task) => <button key={task.id} type="button" className={`entity-list__item ${selectedId === task.id ? "active" : ""}`} onClick={() => selectTask(task)}><span className="entity-list__icon"><FilePenLine size={17} /></span><span><strong>{task.title}</strong><small>{task.id}</small></span></button>)}
            {!tasks.length && <EmptyState title="Keine Schreibaufgaben gefunden" description="Legen Sie eine Aufgabe an oder ändern Sie den Suchbegriff." />}
          </aside>

          <section className="content-editor">
            <div className="content-editor__header"><div><span className="section-kicker">{mode === "create" ? "Neu" : level.toUpperCase()}</span><h2>{mode === "create" ? "Schreibaufgabe anlegen" : draft.title}</h2></div><div className="header-actions">{mode === "edit" && <button className="button button--danger-ghost" type="button" onClick={() => window.confirm("Diese Schreibaufgabe wirklich löschen?") && deleteMutation.mutate()}><Trash2 size={16} /> Löschen</button>}<button className="button button--primary" type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}><Save size={16} /> {saveMutation.isPending ? "Speichert…" : "Speichern"}</button></div></div>
            <div className="content-editor__body">
              <Section title="Aus Bild übernehmen" description="Eine Aufgabenabbildung kann automatisch in die vorhandenen vier Textfelder übertragen werden.">
                <label className="button button--secondary upload-button"><FileImage size={16} /> {extractMutation.isPending ? "Bild wird ausgewertet…" : "Aufgabenbild auswählen"}<input type="file" accept="image/*" disabled={extractMutation.isPending} onChange={(event) => event.target.files?.[0] && extractMutation.mutate(event.target.files[0])} /></label>
              </Section>
              <div className="form-stack schreiben-form">
                <Field label="Titel"><input value={draft.title || ""} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
                <Field label="Aufgabenstellung" hint="Markdown wird unterstützt."><textarea rows="7" value={draft.istructions || ""} onChange={(event) => setDraft({ ...draft, istructions: event.target.value })} /></Field>
                <Field label="Ausgangstext" hint="Zum Beispiel Brief, Anzeige oder Situation."><textarea rows="12" value={draft.content || ""} onChange={(event) => setDraft({ ...draft, content: event.target.value })} /></Field>
                <Field label="Leitpunkte und Anforderungen"><textarea rows="8" value={draft.tasks || ""} onChange={(event) => setDraft({ ...draft, tasks: event.target.value })} /></Field>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
