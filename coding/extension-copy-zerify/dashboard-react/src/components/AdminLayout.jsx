import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  CloudUpload,
  FilePenLine,
  Gauge,
  Headphones,
  Menu,
  RotateCcw,
  Settings2,
  X,
  XCircle
} from "lucide-react";
import { apiRequest, resetRepositoryReady } from "../api/client";

const navigation = [
  { label: "Overview", to: "/dashboard", icon: Gauge, type: "route" },
  { label: "Lesen", to: "/dashboard/lesen", icon: BookOpenText, type: "route" },
  { label: "Contributions", to: "/dashboard/contributions.html", icon: ClipboardCheck, type: "legacy" },
  { label: "Hören", to: "/dashboard/horen.html", icon: Headphones, type: "legacy" },
  { label: "Schreiben", to: "/dashboard/shreiben.html", icon: FilePenLine, type: "legacy" },
  { label: "Configuration", to: "/dashboard/config.html", icon: Settings2, type: "legacy" }
];

function RepositoryControl() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ["repository-status"],
    queryFn: ({ signal }) => apiRequest("/repository/status", { signal }),
    refetchInterval: 15_000
  });

  const action = useMutation({
    mutationFn: ({ path, body }) => apiRequest(path, { method: "POST", body }),
    onSuccess: (result) => {
      resetRepositoryReady();
      queryClient.setQueryData(["repository-status"], result?.status || result);
      queryClient.invalidateQueries({ queryKey: ["repository-status"] });
    }
  });

  const status = statusQuery.data;
  const hasChanges = Number(status?.changeCount || 0) > 0 || Number(status?.ahead || 0) > 0;
  const busy = statusQuery.isLoading || action.isPending;

  const sync = () => action.mutate({ path: "/repository/sync", body: {} });
  const publish = () => {
    if (window.confirm("Commit and publish all saved database changes?")) {
      action.mutate({ path: "/repository/publish", body: { message: "Update exam data from dashboard" } });
    }
  };
  const discard = () => {
    if (window.confirm("Discard every unpushed database change? This cannot be undone.")) {
      action.mutate({ path: "/repository/discard", body: {} });
    }
  };

  return (
    <div className="repo-control" aria-live="polite">
      <div className="repo-control__title">
        <Cloud size={16} /> Data repository
      </div>
      {statusQuery.isError || action.isError ? (
        <div className="repo-state repo-state--error">
          <XCircle size={16} />
          <span>{action.error?.message || statusQuery.error?.message}</span>
        </div>
      ) : hasChanges ? (
        <div className="repo-state repo-state--pending">
          <CloudUpload size={16} />
          <span>{status?.changeCount || status?.ahead} change{Number(status?.changeCount || status?.ahead) === 1 ? "" : "s"} ready</span>
        </div>
      ) : (
        <div className="repo-state repo-state--clean">
          <CheckCircle2 size={16} />
          <span>{busy ? "Checking…" : "Everything is current"}</span>
        </div>
      )}

      <div className="repo-actions">
        <button className="button button--subtle button--small" type="button" onClick={hasChanges ? publish : sync} disabled={busy}>
          {hasChanges ? "Publish" : "Sync now"}
        </button>
        {hasChanges && (
          <button className="icon-button icon-button--danger" type="button" onClick={discard} disabled={busy} aria-label="Discard changes" title="Discard changes">
            <RotateCcw size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const lesenActive = location.pathname.startsWith("/dashboard/lesen");

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true">Z</div>
          <div>
            <div className="brand-name">ZDeutsch</div>
            <div className="brand-caption">Content studio</div>
          </div>
          <button className="icon-button sidebar-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="primary-nav" aria-label="Admin navigation">
          <div className="nav-label">Workspace</div>
          {navigation.map(({ label, to, icon: Icon, type }) => {
            const active = label === "Lesen" ? lesenActive : location.pathname === to;
            const content = <><Icon size={18} /><span>{label}</span></>;
            return type === "route" ? (
              <Link key={label} to={to} className={`nav-item ${active ? "nav-item--active" : ""}`} onClick={() => setMenuOpen(false)}>{content}</Link>
            ) : (
              <a key={label} href={to} className="nav-item">{content}</a>
            );
          })}
        </nav>

        <RepositoryControl />
      </aside>

      {menuOpen && <button className="sidebar-backdrop" type="button" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}

      <main className="workspace">
        <div className="mobile-bar">
          <button className="icon-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <span>ZDeutsch Admin</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
