import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BookOpenText,
  CheckCircle2,
  CircleAlert,
  FileJson2,
  FilePenLine,
  Headphones,
  Languages,
  MessagesSquare,
  RefreshCw,
  Rows3
} from "lucide-react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { Notice, PageHeader, SkeletonCards } from "../components/UI";

function formatBytes(size) {
  if (!Number.isFinite(size)) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function OverviewPage() {
  const overview = useQuery({ queryKey: ["overview"], queryFn: ({ signal }) => apiRequest("/overview", { signal }) });
  const health = useQuery({ queryKey: ["health"], queryFn: ({ signal }) => apiRequest("/health", { signal }), staleTime: 15_000 });

  const refresh = () => {
    overview.refetch();
    health.refetch();
  };
  const analytics = overview.data?.analytics;
  const lesen = analytics?.lesen;
  const horen = analytics?.horen;
  const schreiben = analytics?.shreiben;
  const sprechen = analytics?.sprechen;
  const practiceItems = (lesen?.answers || 0) + (horen?.statements || 0) + (schreiben?.tasks || 0) + (sprechen?.topics || 0) + (sprechen?.prompts || 0);
  const untranslatedItems = Math.max(0, (lesen?.translatableItems || 0) - (lesen?.translatedItems || 0));

  const modules = [
    { label: "Lesen", detail: `${lesen?.themes || 0} Themen · ${lesen?.versions || 0} Versionen`, value: `${lesen?.partCoveragePercent || 0}%`, valueLabel: "Teilabdeckung", icon: BookOpenText, tone: "coral", to: "/dashboard/lesen" },
    { label: "Hören", detail: `${horen?.topics || 0} Themen · ${horen?.statements || 0} Aussagen`, value: horen?.missingIds === 0 ? "Bereit" : `${horen?.missingIds} Lücken`, valueLabel: "Kennungsprüfung", icon: Headphones, tone: "blue", to: "/dashboard/hoeren" },
    { label: "Schreiben", detail: `${schreiben?.tasks || 0} Schreibaufgaben`, value: `${schreiben?.completenessPercent || 0}%`, valueLabel: "Pflichtfelder", icon: FilePenLine, tone: "lime", to: "/dashboard/schreiben" },
    { label: "Sprechen", detail: `${sprechen?.parts || 0} Teile · ${sprechen?.topics || 0} Themen`, value: `${sprechen?.prompts || 0}`, valueLabel: "Gesprächsimpulse", icon: MessagesSquare, tone: "violet", to: "/dashboard/sprechen" }
  ];

  const levelRows = ["b1", "b2"].map((level) => ({
    level: level.toUpperCase(),
    themes: lesen?.byLevel?.[level]?.themes || 0,
    readingCoverage: lesen?.byLevel?.[level]?.partCoveragePercent || 0,
    listeningTopics: horen?.byLevel?.[level]?.topics || 0,
    writingTasks: schreiben?.byLevel?.[level]?.tasks || 0,
    speakingTopics: sprechen?.byLevel?.[level]?.topics || 0
  }));

  return (
    <div className="page overview-page">
      <PageHeader eyebrow="ZDeutsch-Arbeitsbereich" title="Inhaltsübersicht" description="Prüfen Sie die Abdeckung für Lesen, Hören, Schreiben und Sprechen und öffnen Sie anschließend den nächsten Arbeitsbereich." actions={<div className="header-actions"><span className={`health-chip ${health.isError ? "health-chip--error" : health.isSuccess ? "health-chip--ok" : ""}`}><span /> {health.isError ? "API nicht erreichbar" : health.isSuccess ? "Live" : "Wird geprüft"}</span><button className="button button--secondary" type="button" onClick={refresh} disabled={overview.isFetching || health.isFetching}><RefreshCw className={overview.isFetching ? "spin" : ""} size={17} /> Aktualisieren</button></div>} />

      {overview.isError && <Notice type="error">{overview.error.message}</Notice>}
      {overview.isLoading ? <SkeletonCards /> : <>
        <section className="command-grid" aria-label="Zusammenfassung der Prüfungsinhalte">
          <article className="pulse-card"><div className="pulse-card__top"><span className="live-label"><span /> Live-Datenbestand</span><Rows3 size={20} /></div><div className="pulse-card__value">{practiceItems.toLocaleString("de-DE")}</div><div className="pulse-card__label">Übungsinhalte in vier Prüfungsbereichen</div><div className="pulse-card__meter" aria-label={`${lesen?.partCoveragePercent || 0} Prozent Abdeckung der Leseteile`}><span style={{ width: `${lesen?.partCoveragePercent || 0}%` }} /></div><div className="pulse-card__foot"><strong>{lesen?.parts || 0} von {lesen?.expectedParts || 0}</strong><span>Leseteilen vorhanden</span></div></article>
          <div className="module-stack">{modules.map(({ label, detail, value, valueLabel, icon: Icon, tone, to }) => <Link className="module-row" to={to} key={label}><span className={`module-row__icon module-row__icon--${tone}`}><Icon size={19} /></span><span className="module-row__copy"><strong>{label}</strong><small>{detail}</small></span><span className="module-row__metric"><strong>{value}</strong><small>{valueLabel}</small></span><ArrowUpRight size={17} /></Link>)}</div>
        </section>

        <section className="insight-grid">
          <article className="focus-panel"><div className="section-heading"><div><span className="section-kicker">Prioritäten</span><h2>Nächste Aufgaben</h2></div><span className="soft-badge">Live-Auswertung</span></div><div className="focus-list"><div className="focus-item focus-item--urgent"><CircleAlert size={18} /><div><strong>{lesen?.missingParts || 0} Leseteile fehlen</strong><span>Davon entfallen {lesen?.byLevel?.b2?.missingParts || 0} auf B2. Diese Lücken sollten zuerst geschlossen werden.</span></div><span>{lesen?.partCoveragePercent || 0}%</span></div><div className="focus-item"><Languages size={18} /><div><strong>Übersetzungsabdeckung: {lesen?.translationCoveragePercent || 0}%</strong><span>{lesen?.translatedItems || 0} von {lesen?.translatableItems || 0} erfassten Leseelementen enthalten eine Übersetzung.</span></div><span>{untranslatedItems} offen</span></div><div className="focus-item focus-item--good"><CheckCircle2 size={18} /><div><strong>Schreibaufgaben vollständig</strong><span>Alle {schreiben?.completeTasks || 0} Aufgaben enthalten Titel, Anweisung, Ausgangstext und Leitpunkte.</span></div><span>{schreiben?.completenessPercent || 0}%</span></div></div></article>
          <article className="level-panel"><div className="section-heading"><div><span className="section-kicker">Abdeckung</span><h2>Nach Niveau</h2></div></div><div className="level-table level-table--five"><div className="level-table__head"><span>Niveau</span><span>Lesen</span><span>Hören</span><span>Schreiben</span><span>Sprechen</span></div>{levelRows.map((row) => <div className="level-table__row" key={row.level}><strong>{row.level}</strong><span><b>{row.themes}</b> Themen<small>{row.readingCoverage}% Teile</small></span><span><b>{row.listeningTopics}</b> Themen</span><span><b>{row.writingTasks}</b> Aufgaben</span><span><b>{row.speakingTopics}</b> Themen</span></div>)}</div></article>
        </section>
      </>}

      <section className="panel files-panel"><div className="panel__header"><div><span className="section-kicker">Datenquellen</span><h2>Datenbankdateien</h2><p>Schreibgeschützte Größen- und Änderungsinformationen der vorhandenen JSON-Quellen.</p></div><span className="count-badge">{overview.data?.files?.length || 0} Dateien</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Datensatz</th><th>Datei</th><th>Größe</th><th>Zuletzt geändert</th></tr></thead><tbody>{(overview.data?.files || []).map((file) => <tr key={file.fileKey}><td><span className="dataset-name"><FileJson2 size={16} />{file.fileKey}</span></td><td><code>{file.fileName}</code></td><td>{formatBytes(file.sizeBytes)}</td><td>{formatDate(file.updatedAt)}</td></tr>)}{!overview.isLoading && !(overview.data?.files || []).length && <tr><td colSpan="4" className="table-empty">Keine Datenbankdateien gefunden.</td></tr>}</tbody></table></div></section>
    </div>
  );
}
