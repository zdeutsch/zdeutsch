import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { apiRequest, mutationRequest } from "../api/client";
import { AddButton, Field, LoadingState, Notice, PageHeader, RemoveButton, Section } from "../components/UI";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function EinstellungenPage() {
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const configQuery = useQuery({ queryKey: ["config"], queryFn: ({ signal }) => apiRequest("/config", { signal }) });

  useEffect(() => {
    if (configQuery.data) setDraft(clone(configQuery.data));
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => mutationRequest("/config", { method: "PUT", body: draft }),
    onSuccess: async (result) => {
      setDraft(clone(result));
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["config"] });
      await queryClient.invalidateQueries({ queryKey: ["overview"] });
      await queryClient.invalidateQueries({ queryKey: ["repository-status"] });
      window.setTimeout(() => setSaved(false), 2500);
    }
  });

  const updateModule = (index, patch) => {
    const modules = [...(draft.modules || [])];
    modules[index] = { ...modules[index], ...patch };
    setDraft({ ...draft, modules });
  };

  const updateAd = (slot, patch) => setDraft({ ...draft, ads: { ...draft.ads, [slot]: { ...draft.ads?.[slot], ...patch } } });
  const error = configQuery.error || saveMutation.error;

  return (
    <div className="page editor-page">
      <PageHeader eyebrow="Einstellungen" title="Prüfungskonfiguration" description="Verwalten Sie Module, Zeitvorgaben, Bestehensgrenzen und Anzeigen mit der bestehenden Datenstruktur." actions={<button className="button button--primary" type="button" disabled={!draft || saveMutation.isPending} onClick={() => saveMutation.mutate()}><Save size={16} /> {saveMutation.isPending ? "Speichert…" : "Konfiguration speichern"}</button>} />
      {error && <Notice type="error">{error.message}</Notice>}
      {saved && <Notice>Die Konfiguration wurde gespeichert.</Notice>}
      {!draft ? <LoadingState label="Konfiguration wird geladen…" /> : <div className="editor-sections">
        <Section title="Darstellung und Startseite">
          <div className="form-grid"><Field label="Schriftfaktor"><input type="number" min="0.5" step="0.1" value={draft.fontScale || 1} onChange={(event) => setDraft({ ...draft, fontScale: Number(event.target.value) })} /></Field><Field label="Breite der Seitenleiste"><input value={draft.asideWidth || ""} onChange={(event) => setDraft({ ...draft, asideWidth: event.target.value })} /></Field><Field label="Standardmodul"><select value={draft.defaultModule || ""} onChange={(event) => setDraft({ ...draft, defaultModule: event.target.value })}>{(draft.modules || []).map((module) => <option key={module.name} value={module.name}>{module.name}</option>)}</select></Field><label className="boolean-field"><input type="checkbox" checked={Boolean(draft.homepagePromo?.enabled)} onChange={(event) => setDraft({ ...draft, homepagePromo: { ...draft.homepagePromo, enabled: event.target.checked } })} /><span>Startseitenhinweis aktiv</span></label></div>
        </Section>

        <Section title="Prüfungsmodule" description="Die Modulnamen müssen mit dem Standardmodul übereinstimmen." action={<AddButton onClick={() => setDraft({ ...draft, modules: [...(draft.modules || []), { name: "Neues Modul", dataFile: "database/datei.json", timer: { enabled: false, durationMinutes: 0 }, scoreConfig: { passPercent: 60, parts: {} } }] })}>Modul hinzufügen</AddButton>}>
          <div className="module-config-list">{(draft.modules || []).map((module, index) => <div className="module-config-row" key={`${module.name}-${index}`}><Field label="Name"><input value={module.name || ""} onChange={(event) => updateModule(index, { name: event.target.value })} /></Field><Field label="Datendatei"><input value={module.dataFile || ""} onChange={(event) => updateModule(index, { dataFile: event.target.value })} /></Field><label className="boolean-field"><input type="checkbox" checked={Boolean(module.timer?.enabled)} onChange={(event) => updateModule(index, { timer: { ...module.timer, enabled: event.target.checked } })} /><span>Timer aktiv</span></label><Field label="Minuten"><input type="number" min="0" value={module.timer?.durationMinutes || 0} onChange={(event) => updateModule(index, { timer: { ...module.timer, durationMinutes: Number(event.target.value) } })} /></Field><Field label="Bestehen ab %"><input type="number" min="0" max="100" value={module.scoreConfig?.passPercent || 0} onChange={(event) => updateModule(index, { scoreConfig: { ...module.scoreConfig, passPercent: Number(event.target.value) } })} /></Field><RemoveButton label="Modul entfernen" onClick={() => setDraft({ ...draft, modules: draft.modules.filter((_, itemIndex) => itemIndex !== index) })} /></div>)}</div>
        </Section>

        {[
          ["top", "Obere Anzeige"],
          ["bottom", "Untere Anzeige"]
        ].map(([slot, label]) => <Section key={slot} title={label}><div className="form-grid"><label className="boolean-field"><input type="checkbox" checked={Boolean(draft.ads?.[slot]?.enabled)} onChange={(event) => updateAd(slot, { enabled: event.target.checked })} /><span>Anzeige aktiv</span></label><Field label="Ziel-URL"><input value={draft.ads?.[slot]?.clickUrl || ""} onChange={(event) => updateAd(slot, { clickUrl: event.target.value })} /></Field><Field label="Desktop-Bild"><input value={draft.ads?.[slot]?.desktopImage || ""} onChange={(event) => updateAd(slot, { desktopImage: event.target.value })} /></Field><Field label="Mobil-Bild"><input value={draft.ads?.[slot]?.mobileImage || ""} onChange={(event) => updateAd(slot, { mobileImage: event.target.value })} /></Field>{slot === "bottom" && <Field label="Anzeigeintervall in Stunden"><input type="number" min="0" value={draft.ads?.bottom?.displayIntervalHours || 0} onChange={(event) => updateAd("bottom", { displayIntervalHours: Number(event.target.value) })} /></Field>}</div></Section>)}
      </div>}
    </div>
  );
}
