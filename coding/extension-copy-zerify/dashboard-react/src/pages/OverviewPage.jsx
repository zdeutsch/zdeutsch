import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenText, Database, FileJson2, FilePenLine, Headphones, RefreshCw } from "lucide-react";
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
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function OverviewPage() {
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: ({ signal }) => apiRequest("/overview", { signal })
  });
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => apiRequest("/health", { signal }),
    staleTime: 15_000
  });

  const refresh = () => {
    overview.refetch();
    health.refetch();
  };
  const counts = overview.data?.counts;
  const cards = [
    { label: "Active modules", value: counts?.modules ?? 0, note: "Configured learning areas", icon: Database, tone: "blue" },
    { label: "Lesen themes", value: counts?.lesenThemes?.total ?? 0, note: "Across B1 and B2", icon: BookOpenText, tone: "violet", to: "/dashboard/lesen" },
    { label: "Hören topics", value: counts?.horenTopics?.total ?? 0, note: "Listening exercises", icon: Headphones, tone: "amber", href: "/dashboard/horen.html" },
    { label: "Schreiben tasks", value: counts?.shreibenTasks?.total ?? 0, note: "Writing prompts", icon: FilePenLine, tone: "green", href: "/dashboard/shreiben.html" }
  ];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace overview"
        title="Good data makes better learning."
        description="Monitor content health, jump into an exam module, and keep every published dataset under control."
        actions={
          <div className="header-actions">
            <span className={`health-chip ${health.isError ? "health-chip--error" : health.isSuccess ? "health-chip--ok" : ""}`}>
              <span /> {health.isError ? "API unavailable" : health.isSuccess ? "API healthy" : "Checking API"}
            </span>
            <button className="button button--secondary" type="button" onClick={refresh} disabled={overview.isFetching || health.isFetching}>
              <RefreshCw className={overview.isFetching ? "spin" : ""} size={17} /> Refresh
            </button>
          </div>
        }
      />

      {overview.isError && <Notice type="error">{overview.error.message}</Notice>}
      {overview.isLoading ? <SkeletonCards /> : (
        <div className="metric-grid">
          {cards.map(({ label, value, note, icon: Icon, tone, to, href }) => {
            const body = (
              <>
                <div className={`metric-icon metric-icon--${tone}`}><Icon size={21} /></div>
                <div className="metric-value">{value}</div>
                <div className="metric-label">{label}</div>
                <div className="metric-note">{note}</div>
                {(to || href) && <ArrowRight className="metric-arrow" size={18} />}
              </>
            );
            if (to) return <Link className="metric-card metric-card--link" to={to} key={label}>{body}</Link>;
            if (href) return <a className="metric-card metric-card--link" href={href} key={label}>{body}</a>;
            return <div className="metric-card" key={label}>{body}</div>;
          })}
        </div>
      )}

      <section className="panel files-panel">
        <div className="panel__header">
          <div><h2>Database files</h2><p>Live size and update metadata for the JSON source of truth.</p></div>
          <span className="count-badge">{overview.data?.files?.length || 0} files</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Dataset</th><th>File</th><th>Size</th><th>Last updated</th></tr></thead>
            <tbody>
              {(overview.data?.files || []).map((file) => (
                <tr key={file.fileKey}>
                  <td><span className="dataset-name"><FileJson2 size={16} />{file.fileKey}</span></td>
                  <td><code>{file.fileName}</code></td>
                  <td>{formatBytes(file.sizeBytes)}</td>
                  <td>{formatDate(file.updatedAt)}</td>
                </tr>
              ))}
              {!overview.isLoading && !(overview.data?.files || []).length && <tr><td colSpan="4" className="table-empty">No database files found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
