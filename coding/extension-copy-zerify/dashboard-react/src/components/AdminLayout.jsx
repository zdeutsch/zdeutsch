import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BookOpenText,
  CheckCircle2,
  ClipboardCheck,
  Cloud,
  CloudUpload,
  FilePenLine,
  Grid2X2,
  Headphones,
  MessagesSquare,
  Menu,
  RotateCcw,
  Share2,
  Settings2,
  X,
  XCircle
} from "lucide-react";
import { apiRequest, resetRepositoryReady } from "../api/client";

const navigation = [
  { label: "Übersicht", description: "Datenbestand", to: "/dashboard", icon: Grid2X2 },
  { label: "Lesen", description: "Themen und Prüfungsteile", to: "/dashboard/lesen", icon: BookOpenText },
  { label: "Hören", description: "Themen und Aussagen", to: "/dashboard/hoeren", icon: Headphones },
  { label: "Schreiben", description: "Aufgaben und Texte", to: "/dashboard/schreiben", icon: FilePenLine },
  { label: "Sprechen", description: "Mündliche Prüfung", to: "/dashboard/sprechen", icon: MessagesSquare },
  { label: "Beiträge", description: "Korrekturen prüfen", to: "/dashboard/beitraege", icon: ClipboardCheck },
  { label: "Freigaben", description: "Empfehlungen auswerten", to: "/dashboard/sharing", icon: Share2 }
];

const dashboardSections = Object.freeze({
  uebersicht: "/dashboard",
  lesen: "/dashboard/lesen",
  hoeren: "/dashboard/hoeren",
  schreiben: "/dashboard/schreiben",
  sprechen: "/dashboard/sprechen",
  beitraege: "/dashboard/beitraege",
  freigaben: "/dashboard/sharing",
  einstellungen: "/dashboard/einstellungen"
});

function useDashboardWebMcp(navigate) {
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return undefined;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(context.registerTool({
        name: "navigate_dashboard_section",
        title: "Dashboard-Bereich öffnen",
        description: "Öffnet einen vorhandenen Bereich der deutschen TELC-Prüfungsverwaltung.",
        inputSchema: {
          type: "object",
          properties: {
            section: { type: "string", enum: Object.keys(dashboardSections) }
          },
          required: ["section"],
          additionalProperties: false
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute(input) {
          const section = String(input?.section || "");
          const path = dashboardSections[section];
          if (!path) throw new Error("Unbekannter Dashboard-Bereich");
          navigate(path);
          return { section, path };
        }
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch (_error) {
      lifecycle.abort();
      return undefined;
    }
    return () => lifecycle.abort();
  }, [navigate]);
}

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
  const repositoryError = action.error || statusQuery.error;
  const repositoryErrorDetails = Array.isArray(repositoryError?.details)
    ? repositoryError.details.join(", ")
    : String(repositoryError?.details || "").trim();
  const repositoryErrorLabel = repositoryError?.message === "Git command failed"
    ? "Git-Befehl fehlgeschlagen"
    : repositoryError?.message;
  const hasChanges = Number(status?.changeCount || 0) > 0 || Number(status?.ahead || 0) > 0;
  const busy = statusQuery.isLoading || action.isPending;

  const sync = () => action.mutate({ path: "/repository/sync", body: {} });
  const publish = () => {
    if (window.confirm("Alle gespeicherten Datenänderungen veröffentlichen?")) {
      action.mutate({ path: "/repository/publish", body: { message: "Prüfungsdaten im Dashboard aktualisieren" } });
    }
  };
  const discard = () => {
    if (window.confirm("Alle unveröffentlichten Datenänderungen verwerfen? Dies kann nicht rückgängig gemacht werden.")) {
      action.mutate({ path: "/repository/discard", body: {} });
    }
  };

  return (
    <div className="repo-control" aria-live="polite">
      <div className="repo-control__title">
        <Cloud size={16} /> Datenstand
      </div>
      {statusQuery.isError || action.isError ? (
        <div className="repo-state repo-state--error">
          <XCircle size={16} />
          <span>{repositoryErrorLabel}{repositoryErrorDetails ? `: ${repositoryErrorDetails}` : ""}</span>
        </div>
      ) : hasChanges ? (
        <div className="repo-state repo-state--pending">
          <CloudUpload size={16} />
          <span>{status?.changeCount || status?.ahead} Änderung{Number(status?.changeCount || status?.ahead) === 1 ? "" : "en"} bereit</span>
        </div>
      ) : (
        <div className="repo-state repo-state--clean">
          <CheckCircle2 size={16} />
          <span>{busy ? "Wird geprüft…" : "Alles ist aktuell"}</span>
        </div>
      )}

      <div className="repo-actions">
        <button className="button button--subtle button--small" type="button" onClick={hasChanges ? publish : sync} disabled={busy}>
          {hasChanges ? "Veröffentlichen" : "Synchronisieren"}
        </button>
        {hasChanges && (
          <button className="icon-button icon-button--danger" type="button" onClick={discard} disabled={busy} aria-label="Änderungen verwerfen" title="Änderungen verwerfen">
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
  const navigate = useNavigate();
  useDashboardWebMcp(navigate);

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar--open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark" aria-hidden="true"><span>Z</span></div>
          <div>
            <div className="brand-name">ZDeutsch</div>
            <div className="brand-caption">TELC-Prüfungsverwaltung</div>
          </div>
          <button className="icon-button sidebar-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Menü schließen">
            <X size={18} />
          </button>
        </div>

        <nav className="primary-nav" aria-label="Hauptnavigation">
          <div className="nav-label">Prüfungsinhalte</div>
          {navigation.map(({ label, description, to, icon: Icon }) => {
            const active = to === "/dashboard" ? location.pathname === to : location.pathname.startsWith(to);
            const content = <><span className="nav-item__icon"><Icon size={18} /></span><span className="nav-item__copy"><strong>{label}</strong><small>{description}</small></span></>;
            return <Link key={label} to={to} className={`nav-item ${active ? "nav-item--active" : ""}`} onClick={() => setMenuOpen(false)}>{content}</Link>;
          })}
        </nav>

        <Link className="settings-link" to="/dashboard/einstellungen"><Settings2 size={16} /><span>Einstellungen</span></Link>

        <RepositoryControl />
      </aside>

      {menuOpen && <button className="sidebar-backdrop" type="button" onClick={() => setMenuOpen(false)} aria-label="Navigation schließen" />}

      <main className="workspace">
        <div className="mobile-bar">
          <button className="icon-button" type="button" onClick={() => setMenuOpen(true)} aria-label="Menü öffnen"><Menu size={20} /></button>
          <span>ZDeutsch Studio</span>
        </div>
        <Outlet />
      </main>
    </div>
  );
}
