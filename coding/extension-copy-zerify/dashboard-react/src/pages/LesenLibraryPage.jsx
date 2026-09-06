import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, BrainCircuit, Edit3, Eye, EyeOff, MoveRight, Plus, Search, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest, mutationRequest } from "../api/client";
import { EmptyState, Field, Notice, PageHeader, SkeletonCards } from "../components/UI";
import { getStoredAiModel, resolveAiModel, storeAiModel } from "../utils/aiModels.mjs";

const levels = ["b1", "b2"];
const partLabels = {
  "teil-1": "Lesen 1",
  "teil-2": "Lesen 2",
  "teil-3": "Lesen 3",
  "sprachbausteine-1": "Sprachbausteine 1",
  "sprachbausteine-2": "Sprachbausteine 2"
};

export function LesenLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ themeKey: "", title: "", newThemeKey: "" });
  const [mode, setMode] = useState("create");
  const [targetLevel, setTargetLevel] = useState("b2");
  const [selectedVersionKey, setSelectedVersionKey] = useState("default");
  const [aiModel, setAiModel] = useState(getStoredAiModel);
  const queryClient = useQueryClient();
  const level = levels.includes(searchParams.get("level")) ? searchParams.get("level") : "b1";

  const themes = useQuery({
    queryKey: ["lesen-themes", level],
    queryFn: ({ signal }) => apiRequest(`/lesen/themes?level=${level}`, { signal })
  });
  const aiConfig = useQuery({
    queryKey: ["lesen-ai-config"],
    queryFn: ({ signal }) => apiRequest("/lesen/ai-config", { signal }),
    retry: false
  });
  const { models, selectedModel, selectedModelInfo } = resolveAiModel(aiConfig.data, aiModel);
  const changeAiModel = (model) => {
    setAiModel(model);
    storeAiModel(model);
  };

  useEffect(() => {
    const requested = searchParams.get("themeKey");
    const match = themes.data?.find((theme) => theme.key === requested);
    if (match) {
      setSelected(match);
      setMode("edit");
      setTargetLevel(level === "b1" ? "b2" : "b1");
      setSelectedVersionKey((current) => match.versions?.some((version) => version.key === current) ? current : match.defaultVersionKey || "default");
      setForm({ themeKey: match.key, title: match.title || "", newThemeKey: "" });
    }
  }, [searchParams, themes.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Ein Thementitel ist erforderlich.");
      if (mode === "create") {
        if (!form.themeKey.trim()) throw new Error("Ein eindeutiger Themenschlüssel ist erforderlich.");
        return mutationRequest("/lesen/theme", { method: "POST", body: { level, themeKey: form.themeKey.trim(), title: form.title.trim() } });
      }
      return mutationRequest("/lesen/theme", {
        method: "PUT",
        body: { level, themeKey: selected.key, newThemeKey: form.newThemeKey.trim(), title: form.title.trim() }
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["lesen-themes", level] });
      const key = result?.key || form.themeKey;
      setSearchParams({ level, ...(key ? { themeKey: key } : {}) }, { replace: true });
      setForm({ themeKey: "", title: "", newThemeKey: "" });
      setSelected(null);
      setMode("create");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => mutationRequest("/lesen/theme", { method: "DELETE", body: { level, themeKey: selected.key } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lesen-themes", level] });
      setSelected(null);
      setMode("create");
      setForm({ themeKey: "", title: "", newThemeKey: "" });
      setSearchParams({ level }, { replace: true });
    }
  });

  const refreshLibrary = async () => {
    await Promise.all(levels.map((item) => queryClient.invalidateQueries({ queryKey: ["lesen-themes", item] })));
    await queryClient.invalidateQueries({ queryKey: ["overview"] });
    await queryClient.invalidateQueries({ queryKey: ["repository-status"] });
  };

  const visibilityMutation = useMutation({
    mutationFn: (visible) => mutationRequest("/lesen/theme/visibility", { method: "PUT", body: { level, themeKey: selected.key, visible } }),
    onSuccess: refreshLibrary
  });

  const moveMutation = useMutation({
    mutationFn: () => mutationRequest("/lesen/theme/level", { method: "PUT", body: { sourceLevel: level, targetLevel, themeKey: selected.key } }),
    onSuccess: async (result) => {
      await refreshLibrary();
      setSearchParams({ level: result.targetLevel, themeKey: result.themeKey }, { replace: true });
    }
  });

  const partMutation = useMutation({
    mutationFn: ({ action, part }) => {
      const body = { level, themeKey: selected.key, versionKey: selectedVersionKey, partKey: part.key };
      if (action === "add") return mutationRequest("/lesen/part", { method: "POST", body });
      if (action === "remove") return mutationRequest("/lesen/part", { method: "DELETE", body });
      return mutationRequest("/lesen/part/visibility", { method: "PUT", body: { ...body, visible: !part.visible } });
    },
    onSuccess: refreshLibrary
  });

  const filteredThemes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("de");
    return (themes.data || []).filter((theme) => !needle || `${theme.title} ${theme.key}`.toLocaleLowerCase("de").includes(needle));
  }, [search, themes.data]);

  const selectTheme = (theme) => {
    setSelected(theme);
    setMode("edit");
    setTargetLevel(level === "b1" ? "b2" : "b1");
    setSelectedVersionKey(theme.defaultVersionKey || "default");
    setForm({ themeKey: theme.key, title: theme.title || "", newThemeKey: "" });
    setSearchParams({ level, themeKey: theme.key }, { replace: true });
  };

  const createNew = () => {
    setSelected(null);
    setMode("create");
    setForm({ themeKey: "", title: "", newThemeKey: "" });
  };

  const managementPending = visibilityMutation.isPending || moveMutation.isPending || partMutation.isPending;
  const selectedVersion = selected?.versions?.find((version) => version.key === selectedVersionKey);
  const error = saveMutation.error || deleteMutation.error || visibilityMutation.error || moveMutation.error || partMutation.error || themes.error;

  return (
    <div className="page">
      <PageHeader eyebrow="Lesen" title="Themenbibliothek" description="Öffnen Sie für jedes Thema direkt einen der fünf TELC-Prüfungsteile." actions={
        <button className="button button--primary" type="button" onClick={createNew}><Plus size={17} /> Neues Thema</button>
      } />
      {error && <Notice type="error">{error.message}</Notice>}

      <section className="ai-model-toolbar">
        <div className="ai-model-toolbar__copy"><span><BrainCircuit size={19} /></span><div><strong>KI-Prüfmodell</strong><small>{selectedModelInfo.description} Die Auswahl bleibt für Lesen und Beiträge gespeichert.</small></div></div>
        <label className="compact-field"><span>Modell</span><select value={selectedModel} onChange={(event) => changeAiModel(event.target.value)}>{models.map((model) => <option value={model.id} key={model.id}>{model.label}{model.recommended ? " · Empfohlen" : ""}</option>)}</select></label>
      </section>

      <div className="toolbar">
        <div className="segmented" aria-label="Sprachniveau">
          {levels.map((item) => <button key={item} type="button" className={item === level ? "active" : ""} onClick={() => { setSearchParams({ level: item }); createNew(); }}>{item.toUpperCase()}</button>)}
        </div>
        <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Themen durchsuchen…" aria-label="Themen durchsuchen" /></label>
        <span className="count-badge">{filteredThemes.length} Themen</span>
      </div>

      <div className="library-layout">
        <section>
          {themes.isLoading ? <SkeletonCards /> : filteredThemes.length ? (
            <div className="theme-grid">
              {filteredThemes.map((theme) => (
                <article key={theme.key} className={`theme-card ${selected?.key === theme.key ? "theme-card--selected" : ""} ${theme.visible ? "" : "theme-card--hidden"}`}>
                  <button className="theme-card__select" type="button" onClick={() => selectTheme(theme)} aria-label={`${theme.title} auswählen`}>
                    <span className="theme-card__icon"><BookOpenText size={20} /></span>
                    <span className="theme-card__body"><strong>{theme.title}</strong><code>{theme.key}</code></span>
                    <span className={`version-badge ${theme.visible ? "" : "version-badge--hidden"}`}>{theme.visible ? `${theme.versionCount} Version${theme.versionCount === 1 ? "" : "en"}` : "Ausgeblendet"}</span>
                  </button>
                  <div className="theme-card__parts" aria-label={`Prüfungsteile für ${theme.title}`}>
                    {(theme.parts || []).map((part) => part.available ? (
                      <Link key={part.key} className={`part-link ${part.visible ? "" : "part-link--hidden"}`} to={`/dashboard/lesen/${part.key}?level=${level}&themeKey=${encodeURIComponent(theme.key)}&versionKey=${encodeURIComponent(theme.defaultVersionKey || "default")}`}>
                        {partLabels[part.key]}{part.visible ? "" : " · aus"}
                      </Link>
                    ) : (
                      <span key={part.key} className="part-link part-link--missing" title="Für dieses Thema noch nicht vorhanden">{partLabels[part.key]} · fehlt</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState title="Keine Themen gefunden" description={search ? "Versuchen Sie einen anderen Suchbegriff." : `Legen Sie das erste Lesethema für ${level.toUpperCase()} an.`} />}
        </section>

        <aside className="editor-panel">
          <div className="editor-panel__heading"><span className="theme-card__icon">{mode === "create" ? <Plus size={19} /> : <Edit3 size={19} />}</span><div><h2>{mode === "create" ? "Thema anlegen" : "Thema bearbeiten"}</h2><p>{mode === "create" ? `Neue Prüfung für ${level.toUpperCase()} anlegen.` : `${selected?.key} bearbeiten.`}</p></div></div>
          <div className="form-stack">
            {mode === "create" ? (
              <Field label="Themenschlüssel" hint="Stabile Kennung ohne Leerzeichen, zum Beispiel reisen-und-freizeit."><input value={form.themeKey} onChange={(event) => setForm({ ...form, themeKey: event.target.value })} placeholder="themenschluessel" /></Field>
            ) : (
              <Field label="Aktueller Schlüssel"><input value={selected?.key || ""} readOnly /></Field>
            )}
            <Field label="Anzeigename"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Thementitel" /></Field>
            {mode === "edit" && <Field label="Neuer Schlüssel" hint="Optional. Leer lassen, um den aktuellen Schlüssel zu behalten."><input value={form.newThemeKey} onChange={(event) => setForm({ ...form, newThemeKey: event.target.value })} placeholder="Aktuellen Schlüssel behalten" /></Field>}
          </div>
          {mode === "edit" && <div className="management-block">
            <div className="management-block__heading"><div><strong>Sichtbarkeit und Niveau</strong><span>Ausblenden behält alle Inhalte.</span></div><button className="button button--subtle button--small" type="button" disabled={managementPending} onClick={() => visibilityMutation.mutate(!selected.visible)}>{selected.visible ? <EyeOff size={15} /> : <Eye size={15} />}{selected.visible ? "Thema ausblenden" : "Thema einblenden"}</button></div>
            <div className="move-control"><Field label="In ein anderes Niveau verschieben"><select value={targetLevel} onChange={(event) => setTargetLevel(event.target.value)}>{levels.filter((item) => item !== level).map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></Field><button className="button button--secondary button--small" type="button" disabled={managementPending} onClick={() => window.confirm(`„${selected.title}“ von ${level.toUpperCase()} nach ${targetLevel.toUpperCase()} verschieben?`) && moveMutation.mutate()}><MoveRight size={15} /> Verschieben</button></div>
            <div className="part-manager">{(selected.versions || []).length > 1 && <Field label="Version"><select value={selectedVersionKey} onChange={(event) => setSelectedVersionKey(event.target.value)}>{selected.versions.map((version) => <option key={version.key} value={version.key}>{version.label}</option>)}</select></Field>}<span className="field__label">Prüfungsteile</span>{(selectedVersion?.parts || selected.parts || []).map((part) => <div className="part-manager__row" key={part.key}><span><strong>{partLabels[part.key]}</strong><small>{!part.available ? "Nicht vorhanden" : part.visible ? "Sichtbar" : "Ausgeblendet"}</small></span><div>{!part.available ? <button className="button button--secondary button--small" type="button" disabled={managementPending} onClick={() => partMutation.mutate({ action: "add", part })}><Plus size={14} /> Hinzufügen</button> : <><button className="button button--subtle button--small" type="button" disabled={managementPending} onClick={() => partMutation.mutate({ action: "visibility", part })}>{part.visible ? <EyeOff size={14} /> : <Eye size={14} />}{part.visible ? "Ausblenden" : "Einblenden"}</button><button className="icon-button icon-button--danger" type="button" disabled={managementPending} aria-label={`${partLabels[part.key]} entfernen`} title="Dauerhaft entfernen" onClick={() => window.confirm(`${partLabels[part.key]} aus Version „${selectedVersion?.label || selectedVersionKey}“ wirklich dauerhaft entfernen?`) && partMutation.mutate({ action: "remove", part })}><Trash2 size={14} /></button></>}</div></div>)}</div>
          </div>}
          <div className="editor-panel__actions">
            {mode === "edit" && <button className="button button--danger-ghost" type="button" disabled={deleteMutation.isPending} onClick={() => window.confirm(`„${selected.title}“ wirklich löschen? Dies kann nicht rückgängig gemacht werden.`) && deleteMutation.mutate()}><Trash2 size={16} /> Löschen</button>}
            <button className="button button--primary" type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? "Wird gespeichert…" : mode === "create" ? "Thema anlegen" : "Änderungen speichern"}</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
