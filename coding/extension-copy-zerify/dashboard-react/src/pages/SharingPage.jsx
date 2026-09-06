import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogIn, LogOut, RefreshCw, Share2 } from "lucide-react";
import { apiRequest } from "../api/client";
import { EmptyState, Field, LoadingState, Notice, PageHeader, Section } from "../components/UI";

function formatCount(value) {
  return new Intl.NumberFormat("de-DE").format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function SharingPage() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["share-session"],
    queryFn: ({ signal }) => apiRequest("/share/admin/session", { signal }),
    retry: false
  });
  const authenticated = Boolean(sessionQuery.data?.authenticated);

  const overviewQuery = useQuery({
    queryKey: ["share-overview"],
    queryFn: ({ signal }) => apiRequest("/share/admin/overview", { signal }),
    enabled: authenticated,
    retry: false
  });

  useEffect(() => {
    if (overviewQuery.error?.status === 401) {
      queryClient.setQueryData(["share-session"], { authenticated: false });
    }
  }, [overviewQuery.error, queryClient]);

  const loginMutation = useMutation({
    mutationFn: () => apiRequest("/share/admin/login", { method: "POST", body: credentials }),
    onSuccess: async (result) => {
      setCredentials({ username: "", password: "" });
      queryClient.setQueryData(["share-session"], result);
      await queryClient.invalidateQueries({ queryKey: ["share-overview"] });
    }
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("/share/admin/logout", { method: "POST", body: {} }),
    onSuccess: () => {
      queryClient.setQueryData(["share-session"], { authenticated: false });
      queryClient.removeQueries({ queryKey: ["share-overview"] });
    }
  });

  const totals = overviewQuery.data?.totals || {};
  const topSharers = overviewQuery.data?.topSharers || [];
  const recentReferrals = overviewQuery.data?.recentReferrals || [];
  const sessionError = sessionQuery.error;
  const loginError = loginMutation.error;
  const overviewError = overviewQuery.error?.status === 401 ? null : overviewQuery.error;

  if (sessionQuery.isLoading) {
    return <div className="page module-page"><LoadingState label="Anmeldung wird geprüft…" /></div>;
  }

  if (!authenticated) {
    return (
      <div className="page module-page">
        <PageHeader eyebrow="Freigaben" title="Empfehlungen auswerten" description="Dieser Bereich ist geschützt. Melden Sie sich mit dem Administrationskonto für die Freigabestatistik an." />
        {(sessionError || loginError) && <Notice type="error">{loginError?.status === 401 ? "Benutzername oder Passwort ist nicht korrekt." : (loginError || sessionError).message}</Notice>}
        <Section title="Anmelden" description="Die Zugangsdaten gelten nur für diese geschützte Auswertung." className="share-login-panel">
          <form className="share-login-form" onSubmit={(event) => { event.preventDefault(); loginMutation.mutate(); }}>
            <Field label="Benutzername"><input type="text" autoComplete="username" required value={credentials.username} onChange={(event) => setCredentials({ ...credentials, username: event.target.value })} /></Field>
            <Field label="Passwort"><input type="password" autoComplete="current-password" required value={credentials.password} onChange={(event) => setCredentials({ ...credentials, password: event.target.value })} /></Field>
            <button className="button button--primary" type="submit" disabled={loginMutation.isPending}><LogIn size={16} /> {loginMutation.isPending ? "Anmeldung läuft…" : "Auswertung öffnen"}</button>
          </form>
        </Section>
      </div>
    );
  }

  return (
    <div className="page module-page">
      <PageHeader eyebrow="Freigaben" title="Empfehlungen auswerten" description="Überblick über geteilte Links, eindeutige Besucher und freigeschaltete Nutzer." actions={<div className="header-actions"><button className="button button--secondary" type="button" onClick={() => overviewQuery.refetch()} disabled={overviewQuery.isFetching}><RefreshCw size={16} /> Aktualisieren</button><button className="button button--danger-ghost" type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}><LogOut size={16} /> Abmelden</button></div>} />
      {overviewError && <Notice type="error">{overviewError.message}</Notice>}

      {overviewQuery.isLoading ? <LoadingState label="Freigabestatistik wird geladen…" /> : <>
        <div className="review-summary share-summary">
          <div><span>Erfasste Nutzer</span><strong>{formatCount(totals.totalUsers)}</strong></div>
          <div><span>Eindeutige Empfehlungen</span><strong>{formatCount(totals.totalReferrals)}</strong></div>
          <div><span>Freigeschaltet</span><strong>{formatCount(totals.unlockedUsers)}</strong></div>
          <div><span>Grenzwert</span><strong>{formatCount(totals.unlockThreshold)} <small>Besucher</small></strong></div>
        </div>

        <Section title="Aktivste Empfehlende" description="Nutzer mit den meisten unterschiedlichen Besuchern." action={<span className="count-badge">Top {topSharers.length}</span>}>
          {topSharers.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Nutzer-ID</th><th>Besucher</th><th>Status</th><th>Letzter Aufruf</th></tr></thead><tbody>{topSharers.map((row) => <tr key={row.userId}><td><span className="dataset-name"><Share2 size={15} />{row.userId}</span></td><td>{formatCount(row.uniqueVisitors)}</td><td><span className={`status-badge ${row.unlocked ? "status-badge--accepted" : "status-badge--pending"}`}>{row.unlocked ? "Freigeschaltet" : "Ausstehend"}</span></td><td>{formatDate(row.lastVisitAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="Noch keine Empfehlungen" description="Sobald geteilte Links besucht werden, erscheinen die aktivsten Nutzer hier." />}
        </Section>

        <Section title="Letzte Zugriffe" description="Zuletzt erfasste Kombinationen aus empfehlendem Nutzer und Besucher." action={<span className="count-badge">{recentReferrals.length} Zugriffe</span>}>
          {recentReferrals.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Empfehlender</th><th>Besucher</th><th>Pfad</th><th>Aufrufe</th><th>IP</th><th>Letzter Aufruf</th></tr></thead><tbody>{recentReferrals.map((row) => <tr key={`${row.referrerUserId}:${row.visitorUserId}`}><td>{row.referrerUserId}</td><td>{row.visitorUserId}</td><td><code>{row.landingPath || "/"}</code></td><td>{formatCount(row.visitCount)}</td><td><code>{row.lastIpAddress || "—"}</code></td><td>{formatDate(row.lastSeenAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="Noch keine Zugriffe" description="Neue eindeutige Besucher erscheinen automatisch in dieser Liste." />}
        </Section>
      </>}
    </div>
  );
}
