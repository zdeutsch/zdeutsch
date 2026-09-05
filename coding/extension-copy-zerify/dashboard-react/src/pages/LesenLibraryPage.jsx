import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BookOpenText, Edit3, Plus, Search, Trash2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { apiRequest, mutationRequest } from "../api/client";
import { EmptyState, Field, Notice, PageHeader, SkeletonCards } from "../components/UI";

const levels = ["b1", "b2"];

export function LesenLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ themeKey: "", title: "", newThemeKey: "" });
  const [mode, setMode] = useState("create");
  const queryClient = useQueryClient();
  const level = levels.includes(searchParams.get("level")) ? searchParams.get("level") : "b1";

  const themes = useQuery({
    queryKey: ["lesen-themes", level],
    queryFn: ({ signal }) => apiRequest(`/lesen/themes?level=${level}`, { signal })
  });

  useEffect(() => {
    const requested = searchParams.get("themeKey");
    const match = themes.data?.find((theme) => theme.key === requested);
    if (match) {
      setSelected(match);
      setMode("edit");
      setForm({ themeKey: match.key, title: match.title || "", newThemeKey: "" });
    }
  }, [searchParams, themes.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("A theme title is required.");
      if (mode === "create") {
        if (!form.themeKey.trim()) throw new Error("A unique theme key is required.");
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

  const filteredThemes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (themes.data || []).filter((theme) => !needle || `${theme.title} ${theme.key}`.toLocaleLowerCase().includes(needle));
  }, [search, themes.data]);

  const selectTheme = (theme) => {
    setSelected(theme);
    setMode("edit");
    setForm({ themeKey: theme.key, title: theme.title || "", newThemeKey: "" });
    setSearchParams({ level, themeKey: theme.key }, { replace: true });
  };
  const createNew = () => {
    setSelected(null);
    setMode("create");
    setForm({ themeKey: "", title: "", newThemeKey: "" });
  };

  const error = saveMutation.error || deleteMutation.error || themes.error;

  return (
    <div className="page">
      <PageHeader eyebrow="Lesen content" title="Reading theme library" description="Find a theme quickly, manage its identity, then edit each exam part in a focused workspace." actions={
        <button className="button button--primary" type="button" onClick={createNew}><Plus size={17} /> New theme</button>
      } />
      {error && <Notice type="error">{error.message}</Notice>}

      <div className="toolbar">
        <div className="segmented" aria-label="Language level">
          {levels.map((item) => <button key={item} type="button" className={item === level ? "active" : ""} onClick={() => { setSearchParams({ level: item }); createNew(); }}>{item.toUpperCase()}</button>)}
        </div>
        <label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search themes…" aria-label="Search themes" /></label>
        <span className="count-badge">{filteredThemes.length} themes</span>
      </div>

      <div className="library-layout">
        <section>
          {themes.isLoading ? <SkeletonCards /> : filteredThemes.length ? (
            <div className="theme-grid">
              {filteredThemes.map((theme) => (
                <article key={theme.key} className={`theme-card ${selected?.key === theme.key ? "theme-card--selected" : ""}`}>
                  <button className="theme-card__select" type="button" onClick={() => selectTheme(theme)} aria-label={`Select ${theme.title}`}>
                    <span className="theme-card__icon"><BookOpenText size={20} /></span>
                    <span className="theme-card__body"><strong>{theme.title}</strong><code>{theme.key}</code></span>
                    <span className="version-badge">{theme.versionCount} version{theme.versionCount === 1 ? "" : "s"}</span>
                  </button>
                  <Link className="theme-card__open" to={`/dashboard/lesen/teil-1?level=${level}&themeKey=${encodeURIComponent(theme.key)}&versionKey=default`}>
                    Open editor <ArrowRight size={16} />
                  </Link>
                </article>
              ))}
            </div>
          ) : <EmptyState title="No themes found" description={search ? "Try a different search term." : `Create the first ${level.toUpperCase()} reading theme.`} />}
        </section>

        <aside className="editor-panel">
          <div className="editor-panel__heading"><span className="theme-card__icon">{mode === "create" ? <Plus size={19} /> : <Edit3 size={19} />}</span><div><h2>{mode === "create" ? "Create theme" : "Edit theme"}</h2><p>{mode === "create" ? `Add a new ${level.toUpperCase()} exam set.` : `Update ${selected?.key}.`}</p></div></div>
          <div className="form-stack">
            {mode === "create" ? (
              <Field label="Theme key" hint="Stable URL-safe identifier, for example reisen-und-freizeit."><input value={form.themeKey} onChange={(event) => setForm({ ...form, themeKey: event.target.value })} placeholder="theme-key" /></Field>
            ) : (
              <Field label="Current key"><input value={selected?.key || ""} readOnly /></Field>
            )}
            <Field label="Display title"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Theme title" /></Field>
            {mode === "edit" && <Field label="New key" hint="Optional. Leave empty to keep the current key."><input value={form.newThemeKey} onChange={(event) => setForm({ ...form, newThemeKey: event.target.value })} placeholder="Keep current key" /></Field>}
          </div>
          <div className="editor-panel__actions">
            {mode === "edit" && <button className="button button--danger-ghost" type="button" disabled={deleteMutation.isPending} onClick={() => window.confirm(`Delete “${selected.title}”? This cannot be undone.`) && deleteMutation.mutate()}><Trash2 size={16} /> Delete</button>}
            <button className="button button--primary" type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>{saveMutation.isPending ? "Saving…" : mode === "create" ? "Create theme" : "Save changes"}</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
