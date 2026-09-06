import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BrainCircuit, Check, Edit3, RefreshCw, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { apiRequest, mutationRequest } from "../api/client";
import { EmptyState, LoadingState, Notice, PageHeader } from "../components/UI";
import { getStoredAiModel, resolveAiModel, storeAiModel } from "../utils/aiModels.mjs";
import { buildPublicThemeUrl, getContributionRows, groupContributionItems } from "../utils/contributions.mjs";

const statusLabels = { pending: "Offen", accepted: "Angenommen", rejected: "Abgelehnt" };
const answerSetLabels = { current: "Aktuelle Lösung", suggested: "Vorschlag" };
const verdictLabels = { correct: "Richtig", incorrect: "Falsch", uncertain: "Unsicher" };

function formatDate(value) {
  if (!value) return "Ohne Zeitangabe";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Ohne Zeitangabe";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function toEvaluationMap(result) {
  return new Map((result?.evaluations || []).map((evaluation) => [String(evaluation.itemNumber), evaluation]));
}

function AiConfidence({ label, evaluation }) {
  if (!evaluation) return null;
  return (
    <span className="ai-evaluation-output">
      <span
        className={`ai-confidence ai-confidence--${evaluation.verdict || "uncertain"}`}
        title={`${label} · ${verdictLabels[evaluation.verdict] || "Unsicher"}: ${evaluation.reason || "Keine Begründung verfügbar."}`}
      >
        <span>{label} · {verdictLabels[evaluation.verdict] || "Unsicher"}</span>
        <strong>{evaluation.confidence}%</strong>
      </span>
      {evaluation.verdict === "incorrect" && evaluation.recommendedAnswer && (
        <span className="ai-answer-suggestion"><span>KI-Lösung</span><strong>{evaluation.recommendedAnswer}</strong></span>
      )}
    </span>
  );
}

function ReviewActions({ item, review, onEdit }) {
  if (item.reviewStatus === "pending") {
    return (
      <>
        <button className="button button--secondary button--small" type="button" disabled={review.isPending} onClick={onEdit}>
          <Edit3 size={15} /> Vorschlag bearbeiten
        </button>
        <button className="button button--danger-ghost button--small" type="button" disabled={review.isPending} onClick={() => review.mutate({ reviewKey: item.reviewKey, action: "reject" })}>
          <X size={15} /> Ablehnen
        </button>
        <button className="button button--primary button--small" type="button" disabled={review.isPending || item.canAccept === false} onClick={() => review.mutate({ reviewKey: item.reviewKey, action: "accept" })}>
          <Check size={15} /> Annehmen
        </button>
      </>
    );
  }
  if (item.reviewStatus === "accepted") {
    return (
      <button className="button button--secondary button--small" type="button" disabled={review.isPending} onClick={() => window.confirm("Diese Annahme wirklich rückgängig machen?") && review.mutate({ reviewKey: item.reviewKey, action: "revert" })}>
        <RotateCcw size={15} /> Rückgängig
      </button>
    );
  }
  return null;
}

function Comparison({ item, aiChecks }) {
  const rows = getContributionRows(item);
  const currentEvaluations = useMemo(() => toEvaluationMap(aiChecks.current), [aiChecks.current]);
  const suggestedEvaluations = useMemo(() => toEvaluationMap(aiChecks.suggested), [aiChecks.suggested]);

  return (
    <div className="comparison-table">
      <div className="comparison-table__head"><span>Aufgabe / KI</span><span>Aktuelle Lösung</span><span>Vorgeschlagene Lösung</span></div>
      {rows.map((row) => (
        <div className={`comparison-table__row ${row.isDifferent ? "comparison-table__row--different" : ""}`} key={row.itemNumber}>
          <strong className="comparison-task">
            <span className="comparison-task__number">{row.itemNumber}</span>
            <span className="ai-confidence-list">
              <AiConfidence label="Aktuell" evaluation={currentEvaluations.get(String(row.itemNumber))} />
              <AiConfidence label="Vorschlag" evaluation={suggestedEvaluations.get(String(row.itemNumber))} />
            </span>
            {row.isDifferent && <small>Abweichung</small>}
          </strong>
          <span>{row.isDifferent ? <mark className="answer-difference answer-difference--current">{row.currentValue || "—"}</mark> : (row.currentValue || "—")}</span>
          <span>{row.isDifferent ? <mark className="answer-difference answer-difference--suggested">{row.submittedValue || "—"}</mark> : (row.submittedValue || "—")}</span>
        </div>
      ))}
    </div>
  );
}

function AiResultDetails({ result }) {
  if (!result) return null;
  return (
    <details className="ai-result-details">
      <summary>
        <span><Sparkles size={14} /> {answerSetLabels[result.answerSet]}</span>
        <code>{result.model}</code>
      </summary>
      <div className="ai-result-details__body">
        {result.evaluations.map((evaluation) => (
          <div className="ai-result-line" key={evaluation.itemNumber}>
            <span className={`ai-score-dot ai-score-dot--${evaluation.verdict}`} />
            <strong>Aufgabe {evaluation.itemNumber} · {evaluation.confidence}% · {verdictLabels[evaluation.verdict] || "Unsicher"}</strong>
            <p>{evaluation.reason}</p>
            {evaluation.verdict === "incorrect" && evaluation.recommendedAnswer && <small className="ai-result-line__answer">Empfohlene Lösung: <strong>{evaluation.recommendedAnswer}</strong></small>}
            {evaluation.evidence && <small>Beleg: {evaluation.evidence}</small>}
          </div>
        ))}
        {result.overallNote && <p className="ai-overall-note">{result.overallNote}</p>}
      </div>
    </details>
  );
}

function AiCheckPanel({ item, model, aiChecks, setAiChecks }) {
  const [activeAnswerSet, setActiveAnswerSet] = useState("");
  const mutation = useMutation({
    mutationFn: (answerSet) => apiRequest("/contributions/lesen/ai-check", {
      method: "POST",
      body: { reviewKey: item.reviewKey, answerSet, model }
    })
  });

  const runCheck = (answerSet) => {
    setActiveAnswerSet(answerSet);
    mutation.mutate(answerSet, {
      onSuccess: (result) => setAiChecks((current) => ({ ...current, [answerSet]: result }))
    });
  };

  return (
    <section className="ai-check-panel" aria-label="KI-Prüfung der Antworten">
      <div className="ai-check-panel__copy">
        <span className="ai-check-panel__icon"><BrainCircuit size={18} /></span>
        <div><strong>Unabhängige KI-Prüfung</strong><span>Die KI erhält den teilgerechten Vollkontext. Prozent = Wahrscheinlichkeit, dass die Lösung richtig ist.</span></div>
      </div>
      <div className="ai-check-panel__actions">
        <button className="button button--secondary button--small" type="button" disabled={mutation.isPending || item.canAccept === false} onClick={() => runCheck("current")}>
          <Sparkles className={mutation.isPending && activeAnswerSet === "current" ? "spin" : ""} size={15} />
          {mutation.isPending && activeAnswerSet === "current" ? "Prüft…" : "Aktuelle Lösung prüfen"}
        </button>
        <button className="button button--ai button--small" type="button" disabled={mutation.isPending || item.canAccept === false} onClick={() => runCheck("suggested")}>
          <Sparkles className={mutation.isPending && activeAnswerSet === "suggested" ? "spin" : ""} size={15} />
          {mutation.isPending && activeAnswerSet === "suggested" ? "Prüft…" : "Vorschlag prüfen"}
        </button>
      </div>
      {mutation.error && <div className="ai-review-error ai-check-panel__error">{mutation.error.message}</div>}
      {(aiChecks.current || aiChecks.suggested) && (
        <div className="ai-result-list">
          <AiResultDetails result={aiChecks.current} />
          <AiResultDetails result={aiChecks.suggested} />
        </div>
      )}
    </section>
  );
}

function SuggestionEditor({ item, edit, onClose }) {
  const rows = getContributionRows(item);
  const [answerValues, setAnswerValues] = useState(() => Object.fromEntries(rows.map((row) => [String(row.itemNumber), String(row.submittedValue || "")])));

  const save = () => edit.mutate({ reviewKey: item.reviewKey, answerValues }, { onSuccess: onClose });
  const reset = () => edit.mutate({ reviewKey: item.reviewKey, reset: true }, { onSuccess: onClose });

  return (
    <div className="suggestion-editor">
      <div className="suggestion-editor__heading">
        <div><strong>Vorschlag von {item.email || "unbekannter Person"} bearbeiten</strong><span>Groß- und Kleinschreibung bleibt bei Sprachbausteinen erhalten.</span></div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Bearbeitung schließen"><X size={16} /></button>
      </div>
      <div className="suggestion-editor__grid">
        {rows.map((row) => {
          const itemNumber = String(row.itemNumber);
          const allowedValues = Array.from(new Set([...(row.allowedValues || []), answerValues[itemNumber]].filter(Boolean)));
          return (
            <label className="suggestion-answer-field" key={itemNumber}>
              <span>Aufgabe {itemNumber}</span>
              {allowedValues.length ? (
                <select value={answerValues[itemNumber] || ""} onChange={(event) => setAnswerValues((current) => ({ ...current, [itemNumber]: event.target.value }))}>
                  {allowedValues.map((value) => <option value={value} key={value}>{value}</option>)}
                </select>
              ) : (
                <input value={answerValues[itemNumber] || ""} onChange={(event) => setAnswerValues((current) => ({ ...current, [itemNumber]: event.target.value }))} />
              )}
              <small>Aktuell: {row.currentValue || "—"}</small>
            </label>
          );
        })}
      </div>
      {edit.error && <div className="ai-review-error">{edit.error.message}</div>}
      <div className="suggestion-editor__actions">
        {item.hasLocalEdits && <button className="button button--secondary button--small" type="button" disabled={edit.isPending} onClick={reset}><RotateCcw size={15} /> Original wiederherstellen</button>}
        <button className="button button--secondary button--small" type="button" disabled={edit.isPending} onClick={onClose}>Abbrechen</button>
        <button className="button button--primary button--small" type="button" disabled={edit.isPending} onClick={save}><Save size={15} /> {edit.isPending ? "Speichert…" : "Änderung speichern"}</button>
      </div>
    </div>
  );
}

function ContributionGroupCard({ group, review, edit, aiModel }) {
  const sample = group.sampleItem;
  const publicThemeUrl = buildPublicThemeUrl(sample);
  const differenceCount = getContributionRows(sample).filter((row) => row.isDifferent).length;
  const repeated = group.items.length > 1;
  const [editingReviewKey, setEditingReviewKey] = useState("");
  const [aiChecks, setAiChecks] = useState({ current: null, suggested: null });

  useEffect(() => {
    setAiChecks({ current: null, suggested: null });
  }, [aiModel, sample.reviewKey]);

  return (
    <article className={`review-card ${repeated ? "review-card--repeated" : ""}`}>
      <div className="review-card__header">
        <div>
          <div className="review-card__badges">
            <span className="status-badge status-badge--pending">{repeated ? `${group.items.length} gleiche Vorschläge` : "1 Beitrag"}</span>
            <span className="difference-count">{differenceCount} Abweichungen</span>
            {sample.hasLocalEdits && <span className="status-badge status-badge--edited">Bearbeitet</span>}
          </div>
          <h2>{sample.themeTitle || sample.themeKey}</h2>
          <p>{String(sample.levelKey || "").toUpperCase()} · {sample.partLabel || sample.partKey} · Version {sample.currentVersionLabel || sample.currentVersionKey || "default"}</p>
        </div>
        {publicThemeUrl && <a className="button button--secondary button--small" href={publicThemeUrl} target="_blank" rel="noreferrer">Thema auf labs.zdeutsch.app <ArrowUpRight size={15} /></a>}
      </div>

      {sample.contextIssue && <Notice type="error">{sample.contextIssue}</Notice>}
      <AiCheckPanel item={sample} model={aiModel} aiChecks={aiChecks} setAiChecks={setAiChecks} />
      <Comparison item={sample} aiChecks={aiChecks} />

      <div className="contributor-summary">
        <div className="contributor-summary__heading"><strong>Beitragende</strong><span>{group.contributorCount} {group.contributorCount === 1 ? "Person" : "Personen"}</span></div>
        <div className="contributor-email-list">{group.contributorEmails.length ? group.contributorEmails.map((email) => <span className="contributor-email" key={email}>{email}</span>) : <span className="contributor-email">Ohne E-Mail</span>}</div>
      </div>

      <div className="contributor-review-list">
        {group.items.map((item) => (
          <div className="contributor-review-entry" key={item.reviewKey}>
            <div className="contributor-review-row">
              <div>
                <span className={`status-badge status-badge--${item.reviewStatus}`}>{statusLabels[item.reviewStatus] || item.reviewStatus}</span>
                {item.hasLocalEdits && <span className="status-badge status-badge--edited">Bearbeitet</span>}
                <strong>{item.email || "Ohne E-Mail"}</strong>
                <small>{formatDate(item.submittedAt || item.rawTimestamp)}</small>
              </div>
              <div className="review-card__actions"><ReviewActions item={item} review={review} onEdit={() => setEditingReviewKey(item.reviewKey)} /></div>
            </div>
            {editingReviewKey === item.reviewKey && <SuggestionEditor item={item} edit={edit} onClose={() => setEditingReviewKey("")} />}
          </div>
        ))}
      </div>
    </article>
  );
}

export function BeitraegePage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [aiModel, setAiModel] = useState(getStoredAiModel);
  const level = params.get("level") || "";
  const status = params.get("status") || "pending";
  const scope = params.get("scope") || "different";
  const queryString = new URLSearchParams({ ...(level ? { level } : {}), status, scope }).toString();

  const contributions = useQuery({
    queryKey: ["beitraege", level, status, scope],
    queryFn: ({ signal }) => apiRequest(`/contributions/lesen?${queryString}`, { signal })
  });
  const aiConfig = useQuery({
    queryKey: ["beitraege-ai-config"],
    queryFn: ({ signal }) => apiRequest("/contributions/lesen/ai-config", { signal }),
    retry: false
  });

  const invalidateContributions = async () => {
    await queryClient.invalidateQueries({ queryKey: ["beitraege"] });
    await queryClient.invalidateQueries({ queryKey: ["overview"] });
    await queryClient.invalidateQueries({ queryKey: ["repository-status"] });
  };
  const review = useMutation({
    mutationFn: ({ reviewKey, action }) => mutationRequest("/contributions/lesen/review", { method: "POST", body: { reviewKey, action } }),
    onSuccess: invalidateContributions
  });
  const edit = useMutation({
    mutationFn: (body) => mutationRequest("/contributions/lesen/edit", { method: "POST", body }),
    onSuccess: invalidateContributions
  });

  const changeFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  };
  const { models, selectedModel, selectedModelInfo } = resolveAiModel(aiConfig.data, aiModel);
  const changeAiModel = (model) => {
    setAiModel(model);
    storeAiModel(model);
  };

  const summary = contributions.data?.summary || {};
  const items = contributions.data?.items || [];
  const groups = groupContributionItems(items);
  const error = contributions.error || review.error || edit.error;

  return (
    <div className="page module-page">
      <PageHeader eyebrow="Beiträge" title="Korrekturvorschläge prüfen" description="Prüfen, vergleichen und bearbeiten Sie Korrekturvorschläge für alle fünf Lesen-Teile." actions={<button className="button button--secondary" type="button" onClick={() => contributions.refetch()}><RefreshCw size={16} /> Aktualisieren</button>} />
      {error && <Notice type="error">{error.message}</Notice>}

      <section className="ai-model-toolbar">
        <div className="ai-model-toolbar__copy"><span><BrainCircuit size={19} /></span><div><strong>KI-Prüfmodell</strong><small>{selectedModelInfo.description}</small></div></div>
        <label className="compact-field"><span>Modell</span><select value={selectedModel} onChange={(event) => changeAiModel(event.target.value)}>{models.map((model) => <option value={model.id} key={model.id}>{model.label}{model.recommended ? " · Empfohlen" : ""}</option>)}</select></label>
      </section>

      <div className="review-summary">
        <div><span>Offen</span><strong>{summary.pending || 0}</strong></div>
        <div><span>Angenommen</span><strong>{summary.accepted || 0}</strong></div>
        <div><span>Abgelehnt</span><strong>{summary.rejected || 0}</strong></div>
        <div><span>Abweichend</span><strong>{summary.totalDifferent || 0}</strong></div>
      </div>

      <div className="toolbar">
        <label className="compact-field"><span>Niveau</span><select value={level} onChange={(event) => changeFilter("level", event.target.value)}><option value="">Alle</option><option value="b1">B1</option><option value="b2">B2</option></select></label>
        <label className="compact-field"><span>Status</span><select value={status} onChange={(event) => changeFilter("status", event.target.value)}><option value="all">Alle</option><option value="pending">Offen</option><option value="accepted">Angenommen</option><option value="rejected">Abgelehnt</option></select></label>
        <label className="compact-field"><span>Umfang</span><select value={scope} onChange={(event) => changeFilter("scope", event.target.value)}><option value="different">Nur Abweichungen</option><option value="all">Alle Einsendungen</option></select></label>
        <span className="count-badge">{items.length} Beiträge · {groups.length} Gruppen</span>
      </div>

      {contributions.isLoading ? <LoadingState label="Beiträge werden geladen…" /> : groups.length ? <div className="review-list">{groups.map((group) => <ContributionGroupCard group={group} review={review} edit={edit} aiModel={selectedModel} key={group.key} />)}</div> : <EmptyState title="Keine Beiträge in dieser Auswahl" description="Ändern Sie die Filter oder laden Sie die Daten erneut." />}
    </div>
  );
}
