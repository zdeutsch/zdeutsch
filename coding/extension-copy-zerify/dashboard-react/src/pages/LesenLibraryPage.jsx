import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, BrainCircuit, CopyPlus, Edit3, Eye, EyeOff, Layers3, MoveRight, Plus, Save, Search, Star, Trash2 } from "lucide-react";
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

function suggestVersionKey(theme) {
  const existing = new Set((theme?.versions || []).map((version) => version.key));
  let number = 1;
  while (existing.has(`version-${number}`)) number += 1;
  return `version-${number}`;
}

export function LesenLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ themeKey: "", title: "", newThemeKey: "" });
  const [mode, setMode] = useState("create");
  const [targetLevel, setTargetLevel] = useState("b2");
  const [selectedVersionKey, setSelectedVersionKey] = useState("default");
  const [versionForm, setVersionForm] = useState({ label: "", title: "" });
  const [newVersionForm, setNewVersionForm] = useState({ versionKey: "", label: "", title: "", copyFromVersionKey: "" });
  const [moveVersionForm, setMoveVersionForm] = useState({ targetThemeKey: "", targetVersionKey: "", label: "", title: "" });
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

  useEffect(() => {
    if (!selected) return;
    const activeVersion = selected.versions?.find((version) => version.key === selectedVersionKey)
      || selected.versions?.[0];
    if (!activeVersion) return;
    const targets = (themes.data || []).filter((theme) => theme.key !== selected.key);
    const currentTarget = targets.find((theme) => theme.key === moveVersionForm.targetThemeKey) || targets[0] || null;
    setVersionForm({ label: activeVersion.label || activeVersion.key, title: activeVersion.title || selected.title || "" });
    setNewVersionForm((current) => ({
      ...current,
      versionKey: current.versionKey || suggestVersionKey(selected),
      label: current.label || `Version ${(selected.versions || []).length + 1}`,
      copyFromVersionKey: current.copyFromVersionKey || activeVersion.key
    }));
    setMoveVersionForm({
      targetThemeKey: currentTarget?.key || "",
      targetVersionKey: currentTarget ? suggestVersionKey(currentTarget) : "",
      label: activeVersion.label || activeVersion.key,
      title: activeVersion.title || selected.title || ""
    });
  }, [selected?.key, selectedVersionKey, themes.data]);

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

  const createVersionMutation = useMutation({
    mutationFn: () => {
      if (!newVersionForm.versionKey.trim()) throw new Error("Ein eindeutiger Versionsschlüssel ist erforderlich.");
      if (!newVersionForm.label.trim()) throw new Error("Eine Versionsbezeichnung ist erforderlich.");
      return mutationRequest("/lesen/version", {
        method: "POST",
        body: {
          level,
          themeKey: selected.key,
          versionKey: newVersionForm.versionKey.trim(),
          label: newVersionForm.label.trim(),
          title: newVersionForm.title.trim(),
          copyFromVersionKey: newVersionForm.copyFromVersionKey
        }
      });
    },
    onSuccess: async (result) => {
      setSelectedVersionKey(result.version.key);
      await refreshLibrary();
      const nextTheme = { versions: [...(selected.versions || []), { key: result.version.key }] };
      setNewVersionForm({
        versionKey: suggestVersionKey(nextTheme),
        label: `Version ${(selected.versions || []).length + 2}`,
        title: "",
        copyFromVersionKey: result.version.key
      });
    }
  });

  const updateVersionMutation = useMutation({
    mutationFn: (makeDefault = false) => mutationRequest("/lesen/version", {
      method: "PUT",
      body: {
        level,
        themeKey: selected.key,
        versionKey: selectedVersionKey,
        label: versionForm.label.trim(),
        title: versionForm.title.trim(),
        isDefault: makeDefault
      }
    }),
    onSuccess: refreshLibrary
  });

  const deleteVersionMutation = useMutation({
    mutationFn: () => mutationRequest("/lesen/version", {
      method: "DELETE",
      body: { level, themeKey: selected.key, versionKey: selectedVersionKey }
    }),
    onSuccess: async (result) => {
      setSelectedVersionKey(result.defaultVersionKey);
      await refreshLibrary();
    }
  });

  const moveVersionMutation = useMutation({
    mutationFn: () => {
      if (!moveVersionForm.targetThemeKey) throw new Error("Wählen Sie ein Zielthema.");
      if (!moveVersionForm.targetVersionKey.trim()) throw new Error("Ein Versionsschlüssel im Zielthema ist erforderlich.");
      return mutationRequest("/lesen/version/theme", {
        method: "PUT",
        body: {
          level,
          sourceThemeKey: selected.key,
          sourceVersionKey: selectedVersionKey,
          targetThemeKey: moveVersionForm.targetThemeKey,
          targetVersionKey: moveVersionForm.targetVersionKey.trim(),
          label: moveVersionForm.label.trim(),
          title: moveVersionForm.title.trim()
        }
      });
    },
    onSuccess: async (result) => {
      await refreshLibrary();
      setSelectedVersionKey(result.targetVersionKey);
      setSearchParams({ level, themeKey: result.targetThemeKey }, { replace: true });
    }
  });

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
    setNewVersionForm({ versionKey: "", label: "", title: "", copyFromVersionKey: theme.defaultVersionKey || "default" });
    setMoveVersionForm({ targetThemeKey: "", targetVersionKey: "", label: "", title: "" });
    setForm({ themeKey: theme.key, title: theme.title || "", newThemeKey: "" });
    setSearchParams({ level, themeKey: theme.key }, { replace: true });
  };

  const createNew = () => {
    setSelected(null);
    setMode("create");
    setForm({ themeKey: "", title: "", newThemeKey: "" });
    setNewVersionForm({ versionKey: "", label: "", title: "", copyFromVersionKey: "" });
    setMoveVersionForm({ targetThemeKey: "", targetVersionKey: "", label: "", title: "" });
  };

  const managementPending = visibilityMutation.isPending || moveMutation.isPending || partMutation.isPending || createVersionMutation.isPending || updateVersionMutation.isPending || deleteVersionMutation.isPending || moveVersionMutation.isPending;
  const selectedVersion = selected?.versions?.find((version) => version.key === selectedVersionKey);
  const moveTargetThemes = (themes.data || []).filter((theme) => theme.key !== selected?.key);
  const error = saveMutation.error || deleteMutation.error || visibilityMutation.error || moveMutation.error || partMutation.error || createVersionMutation.error || updateVersionMutation.error || deleteVersionMutation.error || moveVersionMutation.error || themes.error;

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
            <div className="management-block__heading">
              <div><strong>Versionen</strong><span>Alle fünf Prüfungsteile gehören zur ausgewählten Version.</span></div>
              <span className="version-badge"><Layers3 size={13} /> {selected.versionCount}</span>
            </div>

            <div className="version-switch-row">
              <Field label="Version auswählen">
                <select value={selectedVersionKey} onChange={(event) => setSelectedVersionKey(event.target.value)}>
                  {selected.versions.map((version) => <option key={version.key} value={version.key}>{version.label}{version.key === selected.defaultVersionKey ? " · Standard" : ""}</option>)}
                </select>
              </Field>
              {selectedVersionKey !== selected.defaultVersionKey && <button className="button button--subtle button--small" type="button" disabled={managementPending} onClick={() => updateVersionMutation.mutate(true)}><Star size={14} /> Standard</button>}
            </div>

            <div className="version-details">
              <Field label="Versionsname"><input value={versionForm.label} onChange={(event) => setVersionForm({ ...versionForm, label: event.target.value })} /></Field>
              <Field label="Versionstitel"><input value={versionForm.title} onChange={(event) => setVersionForm({ ...versionForm, title: event.target.value })} /></Field>
              <div className="inline-actions">
                <button className="button button--secondary button--small" type="button" disabled={managementPending} onClick={() => updateVersionMutation.mutate(false)}><Save size={14} /> Versionsdaten speichern</button>
                {selected.versionCount > 1 && <button className="icon-button icon-button--danger" type="button" disabled={managementPending} aria-label="Version löschen" title="Version dauerhaft löschen" onClick={() => window.confirm(`Version „${selectedVersion?.label || selectedVersionKey}“ mit allen fünf Prüfungsteilen wirklich dauerhaft löschen?`) && deleteVersionMutation.mutate()}><Trash2 size={14} /></button>}
              </div>
            </div>

            <details className="management-disclosure">
              <summary><CopyPlus size={15} /> Neue Version hinzufügen</summary>
              <div className="management-disclosure__body">
                <Field label="Versionsschlüssel" hint="Zum Beispiel version-2."><input value={newVersionForm.versionKey} onChange={(event) => setNewVersionForm({ ...newVersionForm, versionKey: event.target.value })} /></Field>
                <Field label="Bezeichnung"><input value={newVersionForm.label} onChange={(event) => setNewVersionForm({ ...newVersionForm, label: event.target.value })} placeholder="Änderung 2" /></Field>
                <Field label="Titel" hint="Optional; erscheint in der Prüfung."><input value={newVersionForm.title} onChange={(event) => setNewVersionForm({ ...newVersionForm, title: event.target.value })} placeholder={`${selected.title} · ${newVersionForm.label || "Neue Version"}`} /></Field>
                <Field label="Startinhalt">
                  <select value={newVersionForm.copyFromVersionKey} onChange={(event) => setNewVersionForm({ ...newVersionForm, copyFromVersionKey: event.target.value })}>
                    <option value="">Leere Version mit fünf Teilen</option>
                    {selected.versions.map((version) => <option key={version.key} value={version.key}>„{version.label}“ kopieren</option>)}
                  </select>
                </Field>
                <button className="button button--primary button--small" type="button" disabled={managementPending} onClick={() => createVersionMutation.mutate()}><Plus size={14} /> Version hinzufügen</button>
              </div>
            </details>

            {moveTargetThemes.length > 0 && <details className="management-disclosure">
              <summary><MoveRight size={15} /> Version unter anderes Thema verschieben</summary>
              <div className="management-disclosure__body">
                <Field label="Zielthema">
                  <select value={moveVersionForm.targetThemeKey} onChange={(event) => {
                    const targetTheme = moveTargetThemes.find((theme) => theme.key === event.target.value);
                    setMoveVersionForm({ ...moveVersionForm, targetThemeKey: event.target.value, targetVersionKey: suggestVersionKey(targetTheme) });
                  }}>
                    {moveTargetThemes.map((theme) => <option key={theme.key} value={theme.key}>{theme.title}</option>)}
                  </select>
                </Field>
                <Field label="Neuer Versionsschlüssel"><input value={moveVersionForm.targetVersionKey} onChange={(event) => setMoveVersionForm({ ...moveVersionForm, targetVersionKey: event.target.value })} /></Field>
                <Field label="Bezeichnung im Ziel"><input value={moveVersionForm.label} onChange={(event) => setMoveVersionForm({ ...moveVersionForm, label: event.target.value })} /></Field>
                <button className="button button--secondary button--small" type="button" disabled={managementPending} onClick={() => window.confirm(`Version „${selectedVersion?.label || selectedVersionKey}“ nach „${moveTargetThemes.find((theme) => theme.key === moveVersionForm.targetThemeKey)?.title || moveVersionForm.targetThemeKey}“ verschieben?${selected.versionCount === 1 ? " Das bisherige Thema wird danach entfernt." : ""}`) && moveVersionMutation.mutate()}><MoveRight size={14} /> Version gruppieren</button>
              </div>
            </details>}

            <div className="part-manager">
              <span className="field__label">Prüfungsteile · {selectedVersion?.label || selectedVersionKey}</span>
              {(selectedVersion?.parts || selected.parts || []).map((part) => <div className="part-manager__row" key={part.key}><span><strong>{partLabels[part.key]}</strong><small>{!part.available ? "Nicht vorhanden" : part.visible ? "Sichtbar" : "Ausgeblendet"}</small></span><div>{!part.available ? <button className="button button--secondary button--small" type="button" disabled={managementPending} onClick={() => partMutation.mutate({ action: "add", part })}><Plus size={14} /> Hinzufügen</button> : <><Link className="button button--secondary button--small" to={`/dashboard/lesen/${part.key}?level=${level}&themeKey=${encodeURIComponent(selected.key)}&versionKey=${encodeURIComponent(selectedVersionKey)}`}><Edit3 size={14} /> Bearbeiten</Link><button className="button button--subtle button--small" type="button" disabled={managementPending} onClick={() => partMutation.mutate({ action: "visibility", part })}>{part.visible ? <EyeOff size={14} /> : <Eye size={14} />}{part.visible ? "Aus" : "Ein"}</button><button className="icon-button icon-button--danger" type="button" disabled={managementPending} aria-label={`${partLabels[part.key]} entfernen`} title="Dauerhaft entfernen" onClick={() => window.confirm(`${partLabels[part.key]} aus Version „${selectedVersion?.label || selectedVersionKey}“ wirklich dauerhaft entfernen?`) && partMutation.mutate({ action: "remove", part })}><Trash2 size={14} /></button></>}</div></div>)}
            </div>

            <div className="management-block__heading"><div><strong>Sichtbarkeit und Niveau</strong><span>Ausblenden behält alle Versionen und Inhalte.</span></div><button className="button button--subtle button--small" type="button" disabled={managementPending} onClick={() => visibilityMutation.mutate(!selected.visible)}>{selected.visible ? <EyeOff size={15} /> : <Eye size={15} />}{selected.visible ? "Thema ausblenden" : "Thema einblenden"}</button></div>
            <div className="move-control"><Field label="Mit allen Versionen in anderes Niveau verschieben"><select value={targetLevel} onChange={(event) => setTargetLevel(event.target.value)}>{levels.filter((item) => item !== level).map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></Field><button className="button button--secondary button--small" type="button" disabled={managementPending} onClick={() => window.confirm(`„${selected.title}“ mit allen Versionen von ${level.toUpperCase()} nach ${targetLevel.toUpperCase()} verschieben?`) && moveMutation.mutate()}><MoveRight size={15} /> Verschieben</button></div>
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
