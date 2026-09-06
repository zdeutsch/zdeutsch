import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, ChevronDown, Eye, Highlighter, Plus, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiRequest, mutationRequest, toQuery } from "../api/client";
import { AddButton, EmptyState, Field, LoadingState, Notice, PageHeader, RemoveButton, Section } from "../components/UI";
import { getStoredAiModel, resolveAiModel, storeAiModel } from "../utils/aiModels.mjs";
import { buildCorrectionCandidates } from "../utils/lesenAi.mjs";

const supportedParts = ["teil-1", "teil-2", "teil-3", "sprachbausteine-1", "sprachbausteine-2"];
const partLabels = {
  "teil-1": "Lesen Teil 1",
  "teil-2": "Lesen Teil 2",
  "teil-3": "Lesen Teil 3",
  "sprachbausteine-1": "Sprachbausteine Teil 1",
  "sprachbausteine-2": "Sprachbausteine Teil 2"
};
const shortPartLabels = {
  "teil-1": "Lesen 1",
  "teil-2": "Lesen 2",
  "teil-3": "Lesen 3",
  "sprachbausteine-1": "Sprach 1",
  "sprachbausteine-2": "Sprach 2"
};
const verdictLabels = { correct: "Richtig", incorrect: "Falsch", uncertain: "Unsicher" };

function copy(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function sameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function cleanId(value) {
  const raw = String(value ?? "").trim();
  return /^-?\d+$/.test(raw) ? Number(raw) : raw;
}

function cleanHighlights(value) {
  return (Array.isArray(value) ? value : []).map((item) => ({
    source: String(item?.source || ""),
    start: Number(item?.start),
    end: Number(item?.end),
    text: String(item?.text || "")
  })).filter((item) => item.source && Number.isInteger(item.start) && Number.isInteger(item.end) && item.start >= 0 && item.end > item.start);
}

function prepareContent(partKey, raw) {
  const content = copy(raw || {});
  if (partKey === "teil-1") {
    content.instruction = String(content.instruction || "").trim();
    content.texts = (content.texts || []).filter((item) => String(item.id ?? "").trim() && String(item.text || "").trim()).map((item) => ({ ...item, id: cleanId(item.id), text: String(item.text), translated: String(item.translated || "").trim() }));
    content.headlines = (content.headlines || []).filter((item) => String(item.id ?? "").trim() && String(item.text || "").trim()).map((item) => ({ ...item, id: cleanId(item.id), text: String(item.text), translated: String(item.translated || "").trim() }));
    content.answers = (content.answers || []).filter((item) => String(item.textId ?? "").trim() && String(item.headlineId ?? "").trim()).map((item) => ({ ...item, textId: cleanId(item.textId), headlineId: cleanId(item.headlineId), reason: String(item.reason || "").trim(), highlights: cleanHighlights(item.highlights) }));
  } else if (partKey === "teil-2") {
    const paragraphs = (content.passage?.paragraphs || []).map((item) => String(item)).filter((item) => item.trim());
    const translated = (content.passage?.translated || []).map((item) => String(item).trim()).filter(Boolean);
    content.instruction = String(content.instruction || "").trim();
    content.passage = { ...content.passage, title: String(content.passage?.title || ""), text: paragraphs.join("\n\n"), paragraphs, translated };
    content.questions = (content.questions || []).filter((question) => String(question.id ?? "").trim() && String(question.prompt || "").trim()).map((question) => {
      const options = (question.options || []).filter((option) => String(option.text || "").trim()).map((option) => ({ ...option, id: String(option.id || "").toLowerCase(), text: String(option.text) }));
      const answerId = String(question.answerId || options[0]?.id || "a").toLowerCase();
      return { ...question, id: cleanId(question.id), prompt: String(question.prompt), options, answerId, answerText: options.find((option) => option.id === answerId)?.text || "", reason: String(question.reason || "").trim(), highlights: cleanHighlights(question.highlights) };
    });
  } else if (partKey === "teil-3") {
    content.situations = (content.situations || []).filter((item) => String(item.id ?? "").trim() && String(item.text || "").trim()).map((item) => ({ ...item, id: cleanId(item.id), text: String(item.text), translated: String(item.translated || "").trim() }));
    content.ads = (content.ads || []).filter((item) => String(item.id ?? "").trim() && String(item.text || "").trim()).map((item) => ({ ...item, id: cleanId(item.id), text: String(item.text), translated: String(item.translated || "").trim() }));
    content.answers = (content.answers || []).filter((item) => String(item.situationId ?? "").trim() && String(item.adId ?? "").trim()).map((item) => ({ ...item, situationId: cleanId(item.situationId), adId: cleanId(item.adId), reason: String(item.reason || "").trim(), highlights: cleanHighlights(item.highlights) }));
  } else if (partKey === "sprachbausteine-1") {
    content.title = String(content.title || "").trim();
    content.instruction = String(content.instruction || "").trim();
    content.text = String(content.text || "").trim();
    content.translated = String(content.translated || "").trim();
    content.blanks = (content.blanks || []).filter((item) => String(item.id ?? "").trim()).map((item) => ({ id: cleanId(item.id), options: Array.isArray(item.options) ? item.options.map((option) => String(option).trim()).filter(Boolean) : [] }));
    content.answers = (content.answers || []).filter((item) => String(item.id ?? "").trim() && String(item.answer || "").trim()).map((item) => ({ id: cleanId(item.id), answer: String(item.answer).trim() }));
  } else if (partKey === "sprachbausteine-2") {
    content.title = String(content.title || "").trim();
    content.instruction = String(content.instruction || "").trim();
    content.text = String(content.text || "").trim();
    content.translated = String(content.translated || "").trim();
    content.options = (content.options || []).map((option) => String(option).trim()).filter(Boolean);
    content.answers = (content.answers || []).filter((item) => String(item.id ?? "").trim() && String(item.answer || "").trim()).map((item) => ({ id: cleanId(item.id), answer: String(item.answer).trim() }));
  }
  return content;
}

function renderHighlightRanges(text, highlights, source) {
  const ranges = cleanHighlights(highlights)
    .filter((item) => item.source === source && item.end <= text.length)
    .sort((left, right) => left.start - right.start);
  const parts = [];
  let cursor = 0;
  ranges.forEach((item) => {
    if (item.start < cursor) return;
    if (item.start > cursor) parts.push(<span key={`plain-${cursor}`}>{text.slice(cursor, item.start)}</span>);
    parts.push(<mark key={`${item.source}-${item.start}-${item.end}`}>{text.slice(item.start, item.end)}</mark>);
    cursor = item.end;
  });
  if (cursor < text.length) parts.push(<span key={`plain-${cursor}`}>{text.slice(cursor)}</span>);
  return parts;
}

function getSelectionOffsets(root) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const prefix = document.createRange();
  prefix.selectNodeContents(root);
  prefix.setEnd(range.startContainer, range.startOffset);
  let start = prefix.toString().length;
  let end = start + range.toString().length;
  const selected = root.textContent.slice(start, end);
  const leading = selected.match(/^\s*/u)?.[0].length || 0;
  const trailing = selected.match(/\s*$/u)?.[0].length || 0;
  start += leading;
  end -= trailing;
  return end > start ? { start, end, text: root.textContent.slice(start, end) } : null;
}

function HighlightPicker({ sources = [], value = [], onChange }) {
  const [selection, setSelection] = useState(null);
  const highlights = cleanHighlights(value);
  const exactMatch = selection && highlights.some((item) => item.source === selection.source && item.start === selection.start && item.end === selection.end);

  const captureSelection = (event, source) => {
    const range = getSelectionOffsets(event.currentTarget);
    setSelection(range ? { ...range, source } : null);
  };

  const toggleSelection = () => {
    if (!selection) return;
    if (exactMatch) {
      onChange(highlights.filter((item) => !(item.source === selection.source && item.start === selection.start && item.end === selection.end)));
    } else {
      const withoutOverlaps = highlights.filter((item) => item.source !== selection.source || item.end <= selection.start || item.start >= selection.end);
      onChange([...withoutOverlaps, selection].sort((left, right) => left.source.localeCompare(right.source) || left.start - right.start));
    }
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  };

  const removeHighlight = (target) => {
    onChange(highlights.filter((item) => !(item.source === target.source && item.start === target.start && item.end === target.end)));
    setSelection(null);
  };

  return (
    <div className="keyword-picker">
      <div className="keyword-picker__top">
        <div>
          <span className="field__label">Markierte Textbelege</span>
          <span className="field__hint">Wählen Sie unten ein Wort oder eine Textstelle aus und markieren Sie diese als Beleg.</span>
        </div>
        <button className={`button button--small ${selection ? "button--keyword" : "button--subtle"}`} type="button" disabled={!selection} onMouseDown={(event) => event.preventDefault()} onClick={toggleSelection}>
          <Highlighter size={15} /> {exactMatch ? "Markierung entfernen" : "Auswahl markieren"}
        </button>
      </div>
      {highlights.length > 0 && <div className="keyword-chips">{highlights.map((item) => <button type="button" key={`${item.source}-${item.start}-${item.end}`} onClick={() => removeHighlight(item)} title="Markierung entfernen"><span>{sources.find((source) => source.key === item.source)?.label || item.source}:</span> {item.text}<b>×</b></button>)}</div>}
      <div className="highlight-sources">
        {sources.filter((source) => source.text).map((source) => (
          <div className="highlight-source" key={source.key}>
            <span className="highlight-source__label">{source.label}</span>
            <div className="keyword-source" data-source={source.key} onMouseUp={(event) => captureSelection(event, source.key)} onKeyUp={(event) => captureSelection(event, source.key)}>
              {renderHighlightRanges(String(source.text), highlights, source.key)}
            </div>
          </div>
        ))}
        {!sources.some((source) => source.text) && <span className="muted">Fügen Sie zuerst den Ausgangstext hinzu.</span>}
      </div>
      {selection && <div className="selection-status">Ausgewählt aus {sources.find((source) => source.key === selection.source)?.label || selection.source}: „{selection.text}“</div>}
    </div>
  );
}

function useAnswerAnalysis(partKey, content, model) {
  const [activeTarget, setActiveTarget] = useState(null);
  const [reviews, setReviews] = useState({});
  const mutation = useMutation({
    mutationFn: (targetId) => apiRequest("/lesen/analyze-answer", { method: "POST", body: { partKey, targetId, content, model } })
  });
  useEffect(() => setReviews({}), [model, partKey]);
  const analyze = (targetId, onSuccess) => {
    const key = String(targetId);
    setActiveTarget(key);
    mutation.mutate(targetId, { onSuccess: (result) => { setReviews((current) => ({ ...current, [key]: result })); onSuccess(result); } });
  };
  return {
    analyze,
    isAnalyzing: (targetId) => mutation.isPending && activeTarget === String(targetId),
    errorFor: (targetId) => activeTarget === String(targetId) ? mutation.error : null,
    reviewFor: (targetId) => reviews[String(targetId)] || null,
    clearReview: (targetId) => setReviews((current) => { const next = { ...current }; delete next[String(targetId)]; return next; })
  };
}

function CorrectionCheckResults({ result }) {
  if (!result) return null;
  return (
    <section className="correction-check-results" aria-label="Ergebnis der KI-Korrekturprüfung">
      <div className="correction-check-results__header">
        <div><Sparkles size={17} /><span><strong>KI-Prüfergebnis</strong><small>{result.evaluations.length} Korrekturen mit {result.model} geprüft</small></span></div>
        <time dateTime={result.checkedAt}>{new Intl.DateTimeFormat("de-DE", { timeStyle: "short" }).format(new Date(result.checkedAt))}</time>
      </div>
      <div className="correction-check-results__list">
        {result.evaluations.map((evaluation) => (
          <article className={`correction-check-item correction-check-item--${evaluation.verdict}`} key={evaluation.itemNumber}>
            <div className="correction-check-item__top">
              <strong>Aufgabe {evaluation.itemNumber}</strong>
              <span className={`ai-confidence ai-confidence--${evaluation.verdict}`}><span>{verdictLabels[evaluation.verdict] || "Unsicher"}</span><strong>{evaluation.confidence}%</strong></span>
            </div>
            <p>Gespeicherte Korrektur: <strong>{evaluation.candidateAnswer}</strong></p>
            {evaluation.verdict === "incorrect" && evaluation.recommendedAnswer && <p className="correction-check-item__suggestion">Empfohlene Lösung: <strong>{evaluation.recommendedAnswer}</strong></p>}
            <small>{evaluation.reason}</small>
            {evaluation.evidence && <small>Beleg: {evaluation.evidence}</small>}
          </article>
        ))}
      </div>
      {result.overallNote && <p className="correction-check-results__note">{result.overallNote}</p>}
    </section>
  );
}

function AnswerInsight({ title, subtitle, sources, reason, highlights, aiReview, onReason, onHighlights, onAnalyze, analyzing, analysisError, mapping }) {
  return (
    <article className="insight-card">
      <div className="insight-card__header">
        <span className="insight-icon"><Sparkles size={17} /></span>
        <div className="insight-card__heading"><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
        <button className="button button--ai button--small" type="button" onClick={onAnalyze} disabled={analyzing}>
          <Sparkles className={analyzing ? "spin" : ""} size={15} /> {analyzing ? "KI analysiert…" : "Mit KI analysieren"}
        </button>
      </div>
      {analysisError && <div className="ai-review-error">{analysisError.message}</div>}
      {aiReview && (
        <div className="ai-review" aria-label="KI-Analyse nur für die Verwaltung">
          <div className="ai-review__score"><strong>{aiReview.score}</strong><span>/100</span></div>
          <div><div className="ai-review__meta"><span>Nur Admin</span><code>{aiReview.model}</code></div>{aiReview.alternativeAssessment && <p>{aiReview.alternativeAssessment}</p>}</div>
        </div>
      )}
      {mapping && <div className="mapping-grid">{mapping}</div>}
      <Field label="Warum ist diese Antwort richtig?" hint="Lernende sehen diese Erklärung nach dem Absenden des Prüfungsteils.">
        <textarea rows="3" value={reason || ""} onChange={(event) => onReason(event.target.value)} placeholder="Zusammenhang zwischen Aufgabe und Lösung erklären…" />
      </Field>
      <HighlightPicker sources={sources} value={highlights || []} onChange={onHighlights} />
    </article>
  );
}

function ItemCollection({ title, description, items, onChange, emptyItem, addLabel, fields }) {
  const update = (index, patch) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  const remove = (index) => onChange(items.filter((_, itemIndex) => itemIndex !== index));
  return (
    <Section title={title} description={description} action={<AddButton onClick={() => onChange([...items, copy(emptyItem)])}>{addLabel}</AddButton>}>
      <div className="item-list">
        {items.map((item, index) => (
          <article className="item-editor" key={`${item.id ?? "new"}-${index}`}>
            <div className="item-editor__top"><span>#{item.id || index + 1}</span><RemoveButton label="Eintrag entfernen" onClick={() => remove(index)} /></div>
            <div className="form-grid">{fields(item, index, (patch) => update(index, patch))}</div>
          </article>
        ))}
        {!items.length && <EmptyState title={`Noch keine Einträge: ${title}`} description={`Mit „${addLabel}“ legen Sie den ersten Eintrag an.`} />}
      </div>
    </Section>
  );
}

function TeilOneEditor({ content, onChange, aiModel }) {
  const set = (key, value) => onChange({ ...content, [key]: value });
  const texts = content.texts || [];
  const headlines = content.headlines || [];
  const answers = content.answers || [];
  const ai = useAnswerAnalysis("teil-1", content, aiModel);
  const updateAnswer = (index, patch) => set("answers", answers.map((answer, answerIndex) => answerIndex === index ? { ...answer, ...patch } : answer));

  return (
    <>
      <Section title="Arbeitsanweisung" description="Diese Anweisung steht über den Lesetexten."><Field label="Anweisung für Lernende"><textarea rows="3" value={content.instruction || ""} onChange={(event) => set("instruction", event.target.value)} /></Field></Section>
      <ItemCollection title="Lesetexte" description="Die fünf Texte werden passenden Überschriften zugeordnet." items={texts} onChange={(items) => set("texts", items)} emptyItem={{ id: "", text: "", translated: "" }} addLabel="Text hinzufügen" fields={(item, _index, update) => <><Field label="ID" className="field--short"><input value={item.id ?? ""} onChange={(event) => update({ id: event.target.value })} /></Field><Field label="Deutscher Text" className="field--wide"><textarea rows="5" value={item.text || ""} onChange={(event) => update({ text: event.target.value })} /></Field><Field label="Arabische Übersetzung" className="field--wide"><textarea rows="5" dir="rtl" value={item.translated || ""} onChange={(event) => update({ translated: event.target.value })} /></Field></>} />
      <ItemCollection title="Überschriften" description="Die Auswahlmöglichkeiten für die Zuordnung." items={headlines} onChange={(items) => set("headlines", items)} emptyItem={{ id: "", text: "", translated: "" }} addLabel="Überschrift hinzufügen" fields={(item, _index, update) => <><Field label="ID" className="field--short"><input value={item.id ?? ""} onChange={(event) => update({ id: event.target.value })} /></Field><Field label="Deutsche Überschrift"><input value={item.text || ""} onChange={(event) => update({ text: event.target.value })} /></Field><Field label="Arabische Übersetzung"><input dir="rtl" value={item.translated || ""} onChange={(event) => update({ translated: event.target.value })} /></Field></>} />
      <Section title="Lösungen und Lernhinweise" description="Ordnen Sie jeden Text zu, erklären Sie die Lösung und markieren Sie entscheidende Textstellen." action={<AddButton onClick={() => set("answers", [...answers, { textId: texts[answers.length]?.id || "", headlineId: "", reason: "", highlights: [] }])}>Lösung hinzufügen</AddButton>}>
        <div className="insight-list">
          {answers.map((answer, index) => {
            const text = texts.find((item) => sameId(item.id, answer.textId));
            const headline = headlines.find((item) => sameId(item.id, answer.headlineId));
            return <AnswerInsight key={`${answer.textId}-${index}`} title={`Text ${answer.textId || index + 1}`} subtitle={headline?.text || "Passende Überschrift auswählen"} sources={[{ key: "text", label: `Text ${answer.textId}`, text: text?.text || "" }, { key: "headline", label: `Überschrift ${answer.headlineId}`, text: headline?.text || "" }]} reason={answer.reason} highlights={answer.highlights} aiReview={ai.reviewFor(answer.textId)} onReason={(reason) => { ai.clearReview(answer.textId); updateAnswer(index, { reason }); }} onHighlights={(highlights) => { ai.clearReview(answer.textId); updateAnswer(index, { highlights }); }} onAnalyze={() => ai.analyze(answer.textId, (result) => updateAnswer(index, { reason: result.reason, highlights: result.highlights }))} analyzing={ai.isAnalyzing(answer.textId)} analysisError={ai.errorFor(answer.textId)} mapping={<><Field label="Text"><select value={answer.textId ?? ""} onChange={(event) => { ai.clearReview(answer.textId); updateAnswer(index, { textId: event.target.value, highlights: [] }); }}><option value="">Text auswählen</option>{texts.map((item) => <option key={item.id} value={item.id}>{item.id} — {String(item.text || "").slice(0, 55)}</option>)}</select></Field><Field label="Richtige Überschrift"><select value={answer.headlineId ?? ""} onChange={(event) => { ai.clearReview(answer.textId); updateAnswer(index, { headlineId: event.target.value, highlights: [] }); }}><option value="">Überschrift auswählen</option>{headlines.map((item) => <option key={item.id} value={item.id}>{item.id} — {item.text}</option>)}</select></Field><RemoveButton label="Lösung entfernen" onClick={() => set("answers", answers.filter((_, answerIndex) => answerIndex !== index))} /></>} />;
          })}
        </div>
      </Section>
    </>
  );
}

function normalizedOptions(question) {
  const existing = new Map((question.options || []).map((option) => [String(option.id).toLowerCase(), option]));
  return ["a", "b", "c"].map((id) => existing.get(id) || { id, text: "" });
}

function TeilTwoEditor({ content, onChange, aiModel }) {
  const set = (key, value) => onChange({ ...content, [key]: value });
  const passage = content.passage || { title: "", paragraphs: [], translated: [] };
  const questions = content.questions || [];
  const ai = useAnswerAnalysis("teil-2", content, aiModel);
  const passageSources = [
    { key: "passage-title", label: "Texttitel", text: passage.title || "" },
    ...(passage.paragraphs || []).map((text, index) => ({ key: `passage:${index}`, label: `Absatz ${index + 1}`, text }))
  ];
  const updateQuestion = (index, patch) => set("questions", questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question));

  return (
    <>
      <Section title="Lesetext" description="Verwalten Sie den Text und die optionale arabische Übersetzung.">
        <div className="form-grid"><Field label="Arbeitsanweisung" className="field--wide"><textarea rows="2" value={content.instruction || ""} onChange={(event) => set("instruction", event.target.value)} /></Field><Field label="Texttitel" className="field--wide"><input value={passage.title || ""} onChange={(event) => set("passage", { ...passage, title: event.target.value })} /></Field><Field label="Deutsche Absätze" hint="Ein Absatz pro Zeile." className="field--wide"><textarea rows="10" value={(passage.paragraphs || []).join("\n")} onChange={(event) => set("passage", { ...passage, paragraphs: event.target.value.split("\n") })} /></Field><Field label="Arabische Übersetzung" hint="Ein Absatz pro Zeile in derselben Reihenfolge." className="field--wide"><textarea rows="10" dir="rtl" value={(passage.translated || []).join("\n")} onChange={(event) => set("passage", { ...passage, translated: event.target.value.split("\n") })} /></Field></div>
      </Section>
      <Section title="Fragen und Lernhinweise" description="Jede Frage enthält Auswahlmöglichkeiten, Lösung, Erklärung und markierte Textbelege." action={<AddButton onClick={() => set("questions", [...questions, { id: "", prompt: "", options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }], answerId: "a", reason: "", highlights: [] }])}>Frage hinzufügen</AddButton>}>
        <div className="insight-list">
          {questions.map((question, index) => {
            const options = normalizedOptions(question);
            const updateOption = (optionIndex, text) => updateQuestion(index, { options: options.map((option, current) => current === optionIndex ? { ...option, text } : option) });
            return (
              <article className="question-editor" key={`${question.id}-${index}`}>
                <div className="question-editor__top"><span>Frage {question.id || index + 1}</span><RemoveButton label="Frage entfernen" onClick={() => set("questions", questions.filter((_, questionIndex) => questionIndex !== index))} /></div>
                <div className="form-grid"><Field label="ID" className="field--short"><input value={question.id ?? ""} onChange={(event) => updateQuestion(index, { id: event.target.value })} /></Field><Field label="Frage" className="field--wide"><input value={question.prompt || ""} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} /></Field>{options.map((option, optionIndex) => <Field label={`Option ${option.id.toUpperCase()}`} key={option.id}><input value={option.text || ""} onChange={(event) => updateOption(optionIndex, event.target.value)} /></Field>)}<Field label="Richtige Antwort"><select value={question.answerId || "a"} onChange={(event) => updateQuestion(index, { answerId: event.target.value })}>{options.map((option) => <option value={option.id} key={option.id}>{option.id.toUpperCase()}</option>)}</select></Field></div>
                <AnswerInsight title="Lernrückmeldung" sources={[...passageSources, { key: "question", label: `Frage ${question.id}`, text: question.prompt || "" }, ...options.map((option) => ({ key: `option:${option.id}`, label: `Option ${option.id.toUpperCase()}`, text: option.text || "" }))]} reason={question.reason} highlights={question.highlights} aiReview={ai.reviewFor(question.id)} onReason={(reason) => { ai.clearReview(question.id); updateQuestion(index, { reason }); }} onHighlights={(highlights) => { ai.clearReview(question.id); updateQuestion(index, { highlights }); }} onAnalyze={() => ai.analyze(question.id, (result) => updateQuestion(index, { reason: result.reason, highlights: result.highlights }))} analyzing={ai.isAnalyzing(question.id)} analysisError={ai.errorFor(question.id)} />
              </article>
            );
          })}
          {!questions.length && <EmptyState title="Noch keine Fragen" description="Fügen Sie die erste Multiple-Choice-Frage hinzu." />}
        </div>
      </Section>
    </>
  );
}

function TeilThreeEditor({ content, onChange, aiModel }) {
  const set = (key, value) => onChange({ ...content, [key]: value });
  const situations = content.situations || [];
  const ads = content.ads || [];
  const answers = content.answers || [];
  const ai = useAnswerAnalysis("teil-3", content, aiModel);
  const updateAnswer = (index, patch) => set("answers", answers.map((answer, answerIndex) => answerIndex === index ? { ...answer, ...patch } : answer));
  return (
    <>
      <ItemCollection title="Situationen" description="Bedürfnisse, die einer passenden Anzeige zugeordnet werden." items={situations} onChange={(items) => set("situations", items)} emptyItem={{ id: "", text: "", translated: "" }} addLabel="Situation hinzufügen" fields={(item, _index, update) => <><Field label="ID" className="field--short"><input value={item.id ?? ""} onChange={(event) => update({ id: event.target.value })} /></Field><Field label="Situation" className="field--wide"><textarea rows="3" value={item.text || ""} onChange={(event) => update({ text: event.target.value })} /></Field><Field label="Arabische Übersetzung" className="field--wide"><textarea rows="3" dir="rtl" value={item.translated || ""} onChange={(event) => update({ translated: event.target.value })} /></Field></>} />
      <ItemCollection title="Anzeigen" description="Quelltexte, in denen Lernende ein passendes Angebot suchen." items={ads} onChange={(items) => set("ads", items)} emptyItem={{ id: "", text: "", translated: "" }} addLabel="Anzeige hinzufügen" fields={(item, _index, update) => <><Field label="ID" className="field--short"><input value={item.id ?? ""} onChange={(event) => update({ id: event.target.value })} /></Field><Field label="Anzeigentext" className="field--wide"><textarea rows="6" value={item.text || ""} onChange={(event) => update({ text: event.target.value })} /></Field><Field label="Arabische Übersetzung" className="field--wide"><textarea rows="6" dir="rtl" value={item.translated || ""} onChange={(event) => update({ translated: event.target.value })} /></Field></>} />
      <Section title="Lösungen und Lernhinweise" description="Verbinden Sie jede Situation mit einer Anzeige und markieren Sie die entscheidenden Textstellen." action={<AddButton onClick={() => set("answers", [...answers, { situationId: situations[answers.length]?.id || "", adId: "", reason: "", highlights: [] }])}>Lösung hinzufügen</AddButton>}>
        <div className="insight-list">
          {answers.map((answer, index) => {
            const situation = situations.find((item) => sameId(item.id, answer.situationId));
            const ad = ads.find((item) => sameId(item.id, answer.adId));
            return <AnswerInsight key={`${answer.situationId}-${index}`} title={`Situation ${answer.situationId || index + 1}`} subtitle={ad ? `Passt zu Anzeige ${ad.id}` : "Passende Anzeige auswählen"} sources={[{ key: "situation", label: `Situation ${answer.situationId}`, text: situation?.text || "" }, { key: "ad", label: `Anzeige ${answer.adId}`, text: ad?.text || "" }]} reason={answer.reason} highlights={answer.highlights} aiReview={ai.reviewFor(answer.situationId)} onReason={(reason) => { ai.clearReview(answer.situationId); updateAnswer(index, { reason }); }} onHighlights={(highlights) => { ai.clearReview(answer.situationId); updateAnswer(index, { highlights }); }} onAnalyze={() => ai.analyze(answer.situationId, (result) => updateAnswer(index, { reason: result.reason, highlights: result.highlights }))} analyzing={ai.isAnalyzing(answer.situationId)} analysisError={ai.errorFor(answer.situationId)} mapping={<><Field label="Situation"><select value={answer.situationId ?? ""} onChange={(event) => { ai.clearReview(answer.situationId); updateAnswer(index, { situationId: event.target.value, highlights: [] }); }}><option value="">Situation auswählen</option>{situations.map((item) => <option key={item.id} value={item.id}>{item.id} — {String(item.text || "").slice(0, 60)}</option>)}</select></Field><Field label="Richtige Anzeige"><select value={answer.adId ?? ""} onChange={(event) => { ai.clearReview(answer.situationId); updateAnswer(index, { adId: event.target.value, highlights: [] }); }}><option value="">Anzeige auswählen</option>{ads.map((item) => <option key={item.id} value={item.id}>{item.id} — {String(item.text || "").slice(0, 60)}</option>)}</select></Field><RemoveButton label="Lösung entfernen" onClick={() => set("answers", answers.filter((_, answerIndex) => answerIndex !== index))} /></>} />;
          })}
        </div>
      </Section>
    </>
  );
}

function SprachbausteineEditor({ partKey, content, onChange }) {
  const set = (key, value) => onChange({ ...content, [key]: value });
  const answers = content.answers || [];
  const blanks = content.blanks || [];
  const isFirstPart = partKey === "sprachbausteine-1";
  const updateAnswer = (index, patch) => set("answers", answers.map((answer, itemIndex) => itemIndex === index ? { ...answer, ...patch } : answer));
  const updateBlankOptions = (id, value) => {
    const options = value.split(",").map((entry) => entry.trim()).filter(Boolean);
    const existingIndex = blanks.findIndex((blank) => sameId(blank.id, id));
    const next = [...blanks];
    if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], id: cleanId(id), options };
    else next.push({ id: cleanId(id), options });
    set("blanks", next);
  };

  return (
    <>
      <Section title="Lückentext" description="Verwenden Sie Platzhalter wie [[21]] oder [[31]] an den Lücken.">
        <div className="form-grid"><Field label="Titel"><input value={content.title || ""} onChange={(event) => set("title", event.target.value)} /></Field><Field label="Arbeitsanweisung"><input value={content.instruction || ""} onChange={(event) => set("instruction", event.target.value)} /></Field><Field label="Deutscher Text" className="field--wide"><textarea rows="14" value={content.text || ""} onChange={(event) => set("text", event.target.value)} /></Field><Field label="Arabische Übersetzung" className="field--wide"><textarea rows="12" dir="rtl" value={content.translated || ""} onChange={(event) => set("translated", event.target.value)} /></Field></div>
      </Section>
      {!isFirstPart && <Section title="Wortbank" description="Eine Auswahlmöglichkeit pro Zeile."><Field label="Auswahlwörter"><textarea rows="7" value={(content.options || []).join("\n")} onChange={(event) => set("options", event.target.value.split("\n"))} /></Field></Section>}
      <Section title="Lösungen" description={isFirstPart ? "Hinterlegen Sie pro Lücke die Auswahlmöglichkeiten und die richtige Lösung." : "Ordnen Sie jeder Lücke das richtige Wort aus der Wortbank zu."} action={<AddButton onClick={() => set("answers", [...answers, { id: "", answer: "" }])}>Lösung hinzufügen</AddButton>}>
        <div className="statement-list">{answers.map((answer, index) => {
          const blank = blanks.find((item) => sameId(item.id, answer.id));
          return <div className={`statement-row ${isFirstPart ? "statement-row--options" : ""}`} key={`${answer.id}-${index}`}><Field label="Lücken-ID"><input value={answer.id ?? ""} onChange={(event) => updateAnswer(index, { id: event.target.value })} /></Field>{isFirstPart && <Field label="Auswahlmöglichkeiten" hint="Mit Komma trennen"><input value={(blank?.options || []).join(", ")} onChange={(event) => updateBlankOptions(answer.id, event.target.value)} /></Field>}<Field label="Richtige Lösung"><input value={answer.answer || ""} onChange={(event) => updateAnswer(index, { answer: event.target.value })} /></Field><RemoveButton label="Lösung entfernen" onClick={() => onChange({ ...content, answers: answers.filter((_, itemIndex) => itemIndex !== index), ...(isFirstPart ? { blanks: blanks.filter((item) => !sameId(item.id, answer.id)) } : {}) })} /></div>;
        })}</div>
      </Section>
    </>
  );
}

function MetaEditor({ meta, onChange }) {
  const update = (key, value) => onChange({ ...meta, [key]: value });
  return (
    <details className="meta-panel">
      <summary><span><Eye size={17} /> Prüfungsmetadaten</span><ChevronDown size={17} /></summary>
      <div className="form-grid meta-panel__body"><Field label="Titel" className="field--wide"><input value={meta.title || ""} onChange={(event) => update("title", event.target.value)} /></Field><Field label="Niveau"><input value={meta.level || ""} onChange={(event) => update("level", event.target.value)} /></Field><Field label="Bezeichnung"><input value={meta.partLabel || ""} onChange={(event) => update("partLabel", event.target.value)} /></Field><Field label="Teilnummer"><input type="number" value={meta.partNumber || 0} onChange={(event) => update("partNumber", Number(event.target.value))} /></Field><Field label="Bereich"><input value={meta.section || ""} onChange={(event) => update("section", event.target.value)} /></Field><Field label="Quellen-URL" className="field--wide"><input value={meta.sourceUrl || ""} onChange={(event) => update("sourceUrl", event.target.value)} /></Field></div>
    </details>
  );
}

export function LesenEditorPage() {
  const { partKey } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const [revision, setRevision] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiModel, setAiModel] = useState(getStoredAiModel);
  const [correctionCheck, setCorrectionCheck] = useState(null);
  const requested = { level: searchParams.get("level") || "b1", themeKey: searchParams.get("themeKey") || "", versionKey: searchParams.get("versionKey") || "", partKey };

  useEffect(() => {
    if (!supportedParts.includes(partKey)) navigate("/dashboard/lesen", { replace: true });
  }, [navigate, partKey]);

  const editorQuery = useQuery({
    queryKey: ["lesen-editor", requested.level, requested.themeKey, requested.versionKey, partKey],
    queryFn: ({ signal }) => apiRequest(`/lesen/editor-context?${toQuery(requested)}`, { signal }),
    enabled: supportedParts.includes(partKey),
    placeholderData: (previous) => previous
  });
  const aiConfig = useQuery({
    queryKey: ["lesen-ai-config"],
    queryFn: ({ signal }) => apiRequest("/lesen/ai-config", { signal }),
    retry: false
  });
  const { models, selectedModel, selectedModelInfo } = resolveAiModel(aiConfig.data, aiModel);

  useEffect(() => {
    if (!editorQuery.data) return;
    const selection = editorQuery.data.selection;
    if (selection.level !== requested.level || selection.themeKey !== requested.themeKey || selection.versionKey !== requested.versionKey) {
      setSearchParams({ level: selection.level, themeKey: selection.themeKey, versionKey: selection.versionKey }, { replace: true });
    }
    setDraft(editorQuery.data.part ? copy(editorQuery.data.part) : null);
    setRevision(editorQuery.data.revision || "");
    setDirty(false);
    setCorrectionCheck(null);
  }, [editorQuery.data?.revision, editorQuery.data?.selection?.level, editorQuery.data?.selection?.themeKey, editorQuery.data?.selection?.versionKey, partKey]);

  useEffect(() => {
    const guard = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const updateDraft = (next) => { setDraft(next); setDirty(true); setSaved(false); setCorrectionCheck(null); };
  const selection = editorQuery.data?.selection || requested;
  const correctionCandidates = useMemo(
    () => buildCorrectionCandidates(partKey, draft?.content || {}),
    [draft?.content, partKey]
  );
  const correctionCheckMutation = useMutation({
    mutationFn: () => {
      const themeTitle = editorQuery.data?.themes?.find((theme) => theme.key === selection.themeKey)?.title || selection.themeKey;
      return apiRequest("/lesen/ai-check", {
        method: "POST",
        body: {
          levelKey: selection.level,
          themeKey: selection.themeKey,
          themeTitle,
          partKey,
          partLabel: draft?.meta?.partLabel || partLabels[partKey],
          content: prepareContent(partKey, draft?.content || {}),
          candidates: correctionCandidates,
          model: selectedModel
        }
      });
    },
    onSuccess: setCorrectionCheck
  });
  const changeAiModel = (model) => {
    setAiModel(model);
    storeAiModel(model);
    setCorrectionCheck(null);
  };
  const saveMutation = useMutation({
    mutationFn: () => mutationRequest("/lesen/part", { method: "PUT", body: { ...selection, revision, meta: { ...draft.meta, extractedAt: draft.meta?.extractedAt || new Date().toISOString() }, content: prepareContent(partKey, draft.content) } }),
    onSuccess: (result) => {
      setDraft(copy(result.part));
      setRevision(result.revision);
      setDirty(false);
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["lesen-editor"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["repository-status"] });
      window.setTimeout(() => setSaved(false), 3500);
    }
  });

  const changeContext = (key, value) => {
    if (dirty && !window.confirm("Ungespeicherte Änderungen verwerfen und eine andere Prüfung laden?")) return;
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    if (key === "level") { next.delete("themeKey"); next.delete("versionKey"); }
    if (key === "themeKey") next.delete("versionKey");
    setSearchParams(next);
  };

  const counts = useMemo(() => {
    const content = draft?.content || {};
    if (partKey === "teil-1") return [`${content.texts?.length || 0} Texte`, `${content.headlines?.length || 0} Überschriften`, `${content.answers?.length || 0} Lösungen`];
    if (partKey === "teil-2") return [`${content.passage?.paragraphs?.length || 0} Absätze`, `${content.questions?.length || 0} Fragen`];
    if (partKey === "teil-3") return [`${content.situations?.length || 0} Situationen`, `${content.ads?.length || 0} Anzeigen`, `${content.answers?.length || 0} Lösungen`];
    return [`${content.answers?.length || 0} Lücken`, `${content.options?.length || content.blanks?.length || 0} Auswahlwörter`];
  }, [draft, partKey]);

  const reload = async () => {
    if (dirty && !window.confirm("Ungespeicherte Änderungen verwerfen und die Serverversion neu laden?")) return;
    await editorQuery.refetch();
  };
  const queryString = searchParams.toString();

  return (
    <div className="page editor-page">
      <PageHeader eyebrow="Lesen" title={partLabels[partKey] || "Lesen bearbeiten"} description="Bearbeiten Sie Aufgabeninhalt, Lösungen, Übersetzungen und Lernhinweise für diesen Prüfungsteil." actions={<div className="header-actions"><button className="button button--secondary" type="button" onClick={reload} disabled={editorQuery.isFetching}><RefreshCw className={editorQuery.isFetching ? "spin" : ""} size={17} /> Neu laden</button><button className="button button--primary" type="button" onClick={() => saveMutation.mutate()} disabled={!dirty || !draft || saveMutation.isPending}><Save size={17} />{saveMutation.isPending ? "Wird geprüft und gespeichert…" : dirty ? "Änderungen speichern" : "Gespeichert"}</button></div>} />

      {(editorQuery.error || saveMutation.error) && <Notice type="error">{saveMutation.error?.message || editorQuery.error?.message}{saveMutation.error?.status === 409 ? " Ihre Eingaben bleiben erhalten. Laden Sie die aktuelle Version zum Vergleichen in einem anderen Tab." : ""}</Notice>}
      {correctionCheckMutation.error && <Notice type="error">{correctionCheckMutation.error.message}</Notice>}
      {saved && <Notice>Die Änderungen wurden gespeichert und können über den Datenstand veröffentlicht werden.</Notice>}

      <section className="ai-model-toolbar">
        <div className="ai-model-toolbar__copy"><span><BrainCircuit size={19} /></span><div><strong>KI-Korrekturprüfung</strong><small>{selectedModelInfo.description} Die Auswahl bleibt gespeichert.</small></div></div>
        <div className="ai-model-toolbar__actions">
          <label className="compact-field"><span>Modell</span><select value={selectedModel} onChange={(event) => changeAiModel(event.target.value)}>{models.map((model) => <option value={model.id} key={model.id}>{model.label}{model.recommended ? " · Empfohlen" : ""}</option>)}</select></label>
          <button className="button button--ai" type="button" disabled={!draft || !correctionCandidates.length || correctionCheckMutation.isPending} onClick={() => correctionCheckMutation.mutate()}><Sparkles className={correctionCheckMutation.isPending ? "spin" : ""} size={16} />{correctionCheckMutation.isPending ? "Korrekturen werden geprüft…" : "Korrekturen mit KI prüfen"}</button>
        </div>
      </section>

      <CorrectionCheckResults result={correctionCheck} />

      <div className="editor-context">
        <div className="part-tabs">{supportedParts.map((key) => <Link key={key} className={key === partKey ? "active" : ""} to={`/dashboard/lesen/${key}${queryString ? `?${queryString}` : ""}`} onClick={(event) => { if (dirty && !window.confirm("Ungespeicherte Änderungen verwerfen und einen anderen Teil öffnen?")) event.preventDefault(); }}>{shortPartLabels[key]}</Link>)}</div>
        <div className="context-selectors">
          <Field label="Niveau"><select value={selection.level || ""} onChange={(event) => changeContext("level", event.target.value)}>{(editorQuery.data?.levels || ["b1", "b2"]).map((level) => <option value={level} key={level}>{level.toUpperCase()}</option>)}</select></Field>
          <Field label="Thema"><select value={selection.themeKey || ""} onChange={(event) => changeContext("themeKey", event.target.value)}>{(editorQuery.data?.themes || []).map((theme) => <option value={theme.key} key={theme.key}>{theme.title}</option>)}</select></Field>
          <Field label="Version"><select value={selection.versionKey || ""} onChange={(event) => changeContext("versionKey", event.target.value)}>{(editorQuery.data?.versions || []).map((version) => <option value={version.key} key={version.key}>{version.label}</option>)}</select></Field>
        </div>
        <div className="editor-stats">{counts.map((count) => <span key={count}>{count}</span>)}{dirty && <span className="unsaved-dot">Ungespeicherte Änderungen</span>}</div>
      </div>

      {editorQuery.isLoading || !draft ? (editorQuery.data && !editorQuery.data.part ? <EmptyState title="Dieser Teil enthält noch keine Inhalte" description="Wählen Sie ein anderes Thema oder eine andere Version." /> : <LoadingState label="Leseeditor wird geladen…" />) : (
        <div className="editor-sections">
          <MetaEditor meta={draft.meta || {}} onChange={(meta) => updateDraft({ ...draft, meta })} />
          {partKey === "teil-1" && <TeilOneEditor content={draft.content || {}} onChange={(content) => updateDraft({ ...draft, content })} aiModel={selectedModel} />}
          {partKey === "teil-2" && <TeilTwoEditor content={draft.content || {}} onChange={(content) => updateDraft({ ...draft, content })} aiModel={selectedModel} />}
          {partKey === "teil-3" && <TeilThreeEditor content={draft.content || {}} onChange={(content) => updateDraft({ ...draft, content })} aiModel={selectedModel} />}
          {(partKey === "sprachbausteine-1" || partKey === "sprachbausteine-2") && <SprachbausteineEditor partKey={partKey} content={draft.content || {}} onChange={(content) => updateDraft({ ...draft, content })} />}
        </div>
      )}

      {draft && <div className="sticky-save"><div><strong>{dirty ? "Ungespeicherte Änderungen" : "Alle Änderungen gespeichert"}</strong><span>{dirty ? "Speichern Sie vor dem Themenwechsel oder Veröffentlichen." : "Der Editor entspricht dem aktuellen Serverstand."}</span></div><button className="button button--primary" type="button" onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}><Save size={17} />{saveMutation.isPending ? "Wird gespeichert…" : "Teil speichern"}</button></div>}
    </div>
  );
}
