import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Eye, Highlighter, Plus, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiRequest, mutationRequest, toQuery } from "../api/client";
import { AddButton, EmptyState, Field, LoadingState, Notice, PageHeader, RemoveButton, Section } from "../components/UI";

const supportedParts = ["teil-1", "teil-2", "teil-3"];
const partLabels = { "teil-1": "Lesen Teil 1", "teil-2": "Lesen Teil 2", "teil-3": "Lesen Teil 3" };

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
          <span className="field__label">Highlighted evidence</span>
          <span className="field__hint">Select any word or phrase below, then click Highlight. Select the same range again to remove it.</span>
        </div>
        <button className={`button button--small ${selection ? "button--keyword" : "button--subtle"}`} type="button" disabled={!selection} onMouseDown={(event) => event.preventDefault()} onClick={toggleSelection}>
          <Highlighter size={15} /> {exactMatch ? "Remove highlight" : "Highlight selection"}
        </button>
      </div>
      {highlights.length > 0 && <div className="keyword-chips">{highlights.map((item) => <button type="button" key={`${item.source}-${item.start}-${item.end}`} onClick={() => removeHighlight(item)} title="Remove highlight"><span>{sources.find((source) => source.key === item.source)?.label || item.source}:</span> {item.text}<b>×</b></button>)}</div>}
      <div className="highlight-sources">
        {sources.filter((source) => source.text).map((source) => (
          <div className="highlight-source" key={source.key}>
            <span className="highlight-source__label">{source.label}</span>
            <div className="keyword-source" data-source={source.key} onMouseUp={(event) => captureSelection(event, source.key)} onKeyUp={(event) => captureSelection(event, source.key)}>
              {renderHighlightRanges(String(source.text), highlights, source.key)}
            </div>
          </div>
        ))}
        {!sources.some((source) => source.text) && <span className="muted">Add the source text first.</span>}
      </div>
      {selection && <div className="selection-status">Selected from {sources.find((source) => source.key === selection.source)?.label || selection.source}: “{selection.text}”</div>}
    </div>
  );
}

function useAnswerAnalysis(partKey, content) {
  const [activeTarget, setActiveTarget] = useState(null);
  const [reviews, setReviews] = useState({});
  const mutation = useMutation({
    mutationFn: (targetId) => apiRequest("/lesen/analyze-answer", { method: "POST", body: { partKey, targetId, content } })
  });
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
        <div className="ai-review" aria-label="AI analysis visible to admins only">
          <div className="ai-review__score"><strong>{aiReview.score}</strong><span>/100</span></div>
          <div><div className="ai-review__meta"><span>Nur Admin</span><code>{aiReview.model}</code></div>{aiReview.alternativeAssessment && <p>{aiReview.alternativeAssessment}</p>}</div>
        </div>
      )}
      {mapping && <div className="mapping-grid">{mapping}</div>}
      <Field label="Why is this the correct answer?" hint="Students will see this explanation after submitting the part.">
        <textarea rows="3" value={reason || ""} onChange={(event) => onReason(event.target.value)} placeholder="Explain the relationship between the question and the answer…" />
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
            <div className="item-editor__top"><span>#{item.id || index + 1}</span><RemoveButton onClick={() => remove(index)} /></div>
            <div className="form-grid">{fields(item, index, (patch) => update(index, patch))}</div>
          </article>
        ))}
        {!items.length && <EmptyState title={`No ${title.toLocaleLowerCase()} yet`} description={`Use “${addLabel}” to create the first one.`} />}
      </div>
    </Section>
  );
}

function TeilOneEditor({ content, onChange }) {
  const set = (key, value) => onChange({ ...content, [key]: value });
  const texts = content.texts || [];
  const headlines = content.headlines || [];
  const answers = content.answers || [];
  const ai = useAnswerAnalysis("teil-1", content);
  const updateAnswer = (index, patch) => set("answers", answers.map((answer, answerIndex) => answerIndex === index ? { ...answer, ...patch } : answer));

  return (
    <>
      <Section title="Instructions" description="The task shown above the reading texts."><Field label="Student instruction"><textarea rows="3" value={content.instruction || ""} onChange={(event) => set("instruction", event.target.value)} /></Field></Section>
      <ItemCollection title="Reading texts" description="The five texts students match to headlines." items={texts} onChange={(items) => set("texts", items)} emptyItem={{ id: "", text: "", translated: "" }} addLabel="Add text" fields={(item, _index, update) => <><Field label="ID" className="field--short"><input value={item.id ?? ""} onChange={(event) => update({ id: event.target.value })} /></Field><Field label="German text" className="field--wide"><textarea rows="5" value={item.text || ""} onChange={(event) => update({ text: event.target.value })} /></Field><Field label="Arabic translation" className="field--wide"><textarea rows="5" dir="rtl" value={item.translated || ""} onChange={(event) => update({ translated: event.target.value })} /></Field></>} />
      <ItemCollection title="Headlines" description="Headline options used by students." items={headlines} onChange={(items) => set("headlines", items)} emptyItem={{ id: "", text: "", translated: "" }} addLabel="Add headline" fields={(item, _index, update) => <><Field label="ID" className="field--short"><input value={item.id ?? ""} onChange={(event) => update({ id: event.target.value })} /></Field><Field label="German headline"><input value={item.text || ""} onChange={(event) => update({ text: event.target.value })} /></Field><Field label="Arabic translation"><input dir="rtl" value={item.translated || ""} onChange={(event) => update({ translated: event.target.value })} /></Field></>} />
      <Section title="Answers & teaching insights" description="Map every text to a headline, explain the answer, and mark the decisive phrases." action={<AddButton onClick={() => set("answers", [...answers, { textId: texts[answers.length]?.id || "", headlineId: "", reason: "", highlights: [] }])}>Add answer</AddButton>}>
        <div className="insight-list">
          {answers.map((answer, index) => {
            const text = texts.find((item) => sameId(item.id, answer.textId));
            const headline = headlines.find((item) => sameId(item.id, answer.headlineId));
            return <AnswerInsight key={`${answer.textId}-${index}`} title={`Text ${answer.textId || index + 1}`} subtitle={headline?.text || "Choose the matching headline"} sources={[{ key: "text", label: `Text ${answer.textId}`, text: text?.text || "" }, { key: "headline", label: `Headline ${answer.headlineId}`, text: headline?.text || "" }]} reason={answer.reason} highlights={answer.highlights} aiReview={ai.reviewFor(answer.textId)} onReason={(reason) => { ai.clearReview(answer.textId); updateAnswer(index, { reason }); }} onHighlights={(highlights) => { ai.clearReview(answer.textId); updateAnswer(index, { highlights }); }} onAnalyze={() => ai.analyze(answer.textId, (result) => updateAnswer(index, { reason: result.reason, highlights: result.highlights }))} analyzing={ai.isAnalyzing(answer.textId)} analysisError={ai.errorFor(answer.textId)} mapping={<><Field label="Text"><select value={answer.textId ?? ""} onChange={(event) => { ai.clearReview(answer.textId); updateAnswer(index, { textId: event.target.value, highlights: [] }); }}><option value="">Select text</option>{texts.map((item) => <option key={item.id} value={item.id}>{item.id} — {String(item.text || "").slice(0, 55)}</option>)}</select></Field><Field label="Correct headline"><select value={answer.headlineId ?? ""} onChange={(event) => { ai.clearReview(answer.textId); updateAnswer(index, { headlineId: event.target.value, highlights: [] }); }}><option value="">Select headline</option>{headlines.map((item) => <option key={item.id} value={item.id}>{item.id} — {item.text}</option>)}</select></Field><RemoveButton label="Remove answer" onClick={() => set("answers", answers.filter((_, answerIndex) => answerIndex !== index))} /></>} />;
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

function TeilTwoEditor({ content, onChange }) {
  const set = (key, value) => onChange({ ...content, [key]: value });
  const passage = content.passage || { title: "", paragraphs: [], translated: [] };
  const questions = content.questions || [];
  const ai = useAnswerAnalysis("teil-2", content);
  const passageSources = [
    { key: "passage-title", label: "Passage title", text: passage.title || "" },
    ...(passage.paragraphs || []).map((text, index) => ({ key: `passage:${index}`, label: `Passage paragraph ${index + 1}`, text }))
  ];
  const updateQuestion = (index, patch) => set("questions", questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question));

  return (
    <>
      <Section title="Reading passage" description="Maintain the passage and its optional Arabic translation.">
        <div className="form-grid"><Field label="Instruction" className="field--wide"><textarea rows="2" value={content.instruction || ""} onChange={(event) => set("instruction", event.target.value)} /></Field><Field label="Passage title" className="field--wide"><input value={passage.title || ""} onChange={(event) => set("passage", { ...passage, title: event.target.value })} /></Field><Field label="German paragraphs" hint="One paragraph per line." className="field--wide"><textarea rows="10" value={(passage.paragraphs || []).join("\n")} onChange={(event) => set("passage", { ...passage, paragraphs: event.target.value.split("\n") })} /></Field><Field label="Arabic translation" hint="One paragraph per line, in the same order." className="field--wide"><textarea rows="10" dir="rtl" value={(passage.translated || []).join("\n")} onChange={(event) => set("passage", { ...passage, translated: event.target.value.split("\n") })} /></Field></div>
      </Section>
      <Section title="Questions & teaching insights" description="Each question includes its choices, correct answer, explanation, and exact evidence ranges." action={<AddButton onClick={() => set("questions", [...questions, { id: "", prompt: "", options: [{ id: "a", text: "" }, { id: "b", text: "" }, { id: "c", text: "" }], answerId: "a", reason: "", highlights: [] }])}>Add question</AddButton>}>
        <div className="insight-list">
          {questions.map((question, index) => {
            const options = normalizedOptions(question);
            const updateOption = (optionIndex, text) => updateQuestion(index, { options: options.map((option, current) => current === optionIndex ? { ...option, text } : option) });
            return (
              <article className="question-editor" key={`${question.id}-${index}`}>
                <div className="question-editor__top"><span>Question {question.id || index + 1}</span><RemoveButton label="Remove question" onClick={() => set("questions", questions.filter((_, questionIndex) => questionIndex !== index))} /></div>
                <div className="form-grid"><Field label="ID" className="field--short"><input value={question.id ?? ""} onChange={(event) => updateQuestion(index, { id: event.target.value })} /></Field><Field label="Question" className="field--wide"><input value={question.prompt || ""} onChange={(event) => updateQuestion(index, { prompt: event.target.value })} /></Field>{options.map((option, optionIndex) => <Field label={`Option ${option.id.toUpperCase()}`} key={option.id}><input value={option.text || ""} onChange={(event) => updateOption(optionIndex, event.target.value)} /></Field>)}<Field label="Correct answer"><select value={question.answerId || "a"} onChange={(event) => updateQuestion(index, { answerId: event.target.value })}>{options.map((option) => <option value={option.id} key={option.id}>{option.id.toUpperCase()}</option>)}</select></Field></div>
                <AnswerInsight title="Learning feedback" sources={[...passageSources, { key: "question", label: `Question ${question.id}`, text: question.prompt || "" }, ...options.map((option) => ({ key: `option:${option.id}`, label: `Option ${option.id.toUpperCase()}`, text: option.text || "" }))]} reason={question.reason} highlights={question.highlights} aiReview={ai.reviewFor(question.id)} onReason={(reason) => { ai.clearReview(question.id); updateQuestion(index, { reason }); }} onHighlights={(highlights) => { ai.clearReview(question.id); updateQuestion(index, { highlights }); }} onAnalyze={() => ai.analyze(question.id, (result) => updateQuestion(index, { reason: result.reason, highlights: result.highlights }))} analyzing={ai.isAnalyzing(question.id)} analysisError={ai.errorFor(question.id)} />
              </article>
            );
          })}
          {!questions.length && <EmptyState title="No questions yet" description="Add the first multiple-choice question." />}
        </div>
      </Section>
    </>
  );
}

function TeilThreeEditor({ content, onChange }) {
  const set = (key, value) => onChange({ ...content, [key]: value });
  const situations = content.situations || [];
  const ads = content.ads || [];
  const answers = content.answers || [];
  const ai = useAnswerAnalysis("teil-3", content);
  const updateAnswer = (index, patch) => set("answers", answers.map((answer, answerIndex) => answerIndex === index ? { ...answer, ...patch } : answer));
  return (
    <>
      <ItemCollection title="Situations" description="Student needs that must be matched to an advert." items={situations} onChange={(items) => set("situations", items)} emptyItem={{ id: "", text: "", translated: "" }} addLabel="Add situation" fields={(item, _index, update) => <><Field label="ID" className="field--short"><input value={item.id ?? ""} onChange={(event) => update({ id: event.target.value })} /></Field><Field label="Situation" className="field--wide"><textarea rows="3" value={item.text || ""} onChange={(event) => update({ text: event.target.value })} /></Field><Field label="Arabic translation" className="field--wide"><textarea rows="3" dir="rtl" value={item.translated || ""} onChange={(event) => update({ translated: event.target.value })} /></Field></>} />
      <ItemCollection title="Advertisements" description="The source texts students scan for a matching offer." items={ads} onChange={(items) => set("ads", items)} emptyItem={{ id: "", text: "", translated: "" }} addLabel="Add advert" fields={(item, _index, update) => <><Field label="ID" className="field--short"><input value={item.id ?? ""} onChange={(event) => update({ id: event.target.value })} /></Field><Field label="Advert text" className="field--wide"><textarea rows="6" value={item.text || ""} onChange={(event) => update({ text: event.target.value })} /></Field><Field label="Arabic translation" className="field--wide"><textarea rows="6" dir="rtl" value={item.translated || ""} onChange={(event) => update({ translated: event.target.value })} /></Field></>} />
      <Section title="Answers & teaching insights" description="Connect each situation to an advert and identify the exact textual evidence." action={<AddButton onClick={() => set("answers", [...answers, { situationId: situations[answers.length]?.id || "", adId: "", reason: "", highlights: [] }])}>Add answer</AddButton>}>
        <div className="insight-list">
          {answers.map((answer, index) => {
            const situation = situations.find((item) => sameId(item.id, answer.situationId));
            const ad = ads.find((item) => sameId(item.id, answer.adId));
            return <AnswerInsight key={`${answer.situationId}-${index}`} title={`Situation ${answer.situationId || index + 1}`} subtitle={ad ? `Matches advert ${ad.id}` : "Choose the matching advert"} sources={[{ key: "situation", label: `Situation ${answer.situationId}`, text: situation?.text || "" }, { key: "ad", label: `Advert ${answer.adId}`, text: ad?.text || "" }]} reason={answer.reason} highlights={answer.highlights} aiReview={ai.reviewFor(answer.situationId)} onReason={(reason) => { ai.clearReview(answer.situationId); updateAnswer(index, { reason }); }} onHighlights={(highlights) => { ai.clearReview(answer.situationId); updateAnswer(index, { highlights }); }} onAnalyze={() => ai.analyze(answer.situationId, (result) => updateAnswer(index, { reason: result.reason, highlights: result.highlights }))} analyzing={ai.isAnalyzing(answer.situationId)} analysisError={ai.errorFor(answer.situationId)} mapping={<><Field label="Situation"><select value={answer.situationId ?? ""} onChange={(event) => { ai.clearReview(answer.situationId); updateAnswer(index, { situationId: event.target.value, highlights: [] }); }}><option value="">Select situation</option>{situations.map((item) => <option key={item.id} value={item.id}>{item.id} — {String(item.text || "").slice(0, 60)}</option>)}</select></Field><Field label="Correct advert"><select value={answer.adId ?? ""} onChange={(event) => { ai.clearReview(answer.situationId); updateAnswer(index, { adId: event.target.value, highlights: [] }); }}><option value="">Select advert</option>{ads.map((item) => <option key={item.id} value={item.id}>{item.id} — {String(item.text || "").slice(0, 60)}</option>)}</select></Field><RemoveButton label="Remove answer" onClick={() => set("answers", answers.filter((_, answerIndex) => answerIndex !== index))} /></>} />;
          })}
        </div>
      </Section>
    </>
  );
}

function MetaEditor({ meta, onChange }) {
  const update = (key, value) => onChange({ ...meta, [key]: value });
  return (
    <details className="meta-panel">
      <summary><span><Eye size={17} /> Exam metadata</span><ChevronDown size={17} /></summary>
      <div className="form-grid meta-panel__body"><Field label="Title" className="field--wide"><input value={meta.title || ""} onChange={(event) => update("title", event.target.value)} /></Field><Field label="Level"><input value={meta.level || ""} onChange={(event) => update("level", event.target.value)} /></Field><Field label="Part label"><input value={meta.partLabel || ""} onChange={(event) => update("partLabel", event.target.value)} /></Field><Field label="Part number"><input type="number" value={meta.partNumber || 0} onChange={(event) => update("partNumber", Number(event.target.value))} /></Field><Field label="Section"><input value={meta.section || ""} onChange={(event) => update("section", event.target.value)} /></Field><Field label="Source URL" className="field--wide"><input value={meta.sourceUrl || ""} onChange={(event) => update("sourceUrl", event.target.value)} /></Field></div>
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

  useEffect(() => {
    if (!editorQuery.data) return;
    const selection = editorQuery.data.selection;
    if (selection.level !== requested.level || selection.themeKey !== requested.themeKey || selection.versionKey !== requested.versionKey) {
      setSearchParams({ level: selection.level, themeKey: selection.themeKey, versionKey: selection.versionKey }, { replace: true });
    }
    setDraft(editorQuery.data.part ? copy(editorQuery.data.part) : null);
    setRevision(editorQuery.data.revision || "");
    setDirty(false);
  }, [editorQuery.data?.revision, editorQuery.data?.selection?.level, editorQuery.data?.selection?.themeKey, editorQuery.data?.selection?.versionKey, partKey]);

  useEffect(() => {
    const guard = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const updateDraft = (next) => { setDraft(next); setDirty(true); setSaved(false); };
  const selection = editorQuery.data?.selection || requested;
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
    if (dirty && !window.confirm("Discard your unsaved edits and load another exam?")) return;
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    if (key === "level") { next.delete("themeKey"); next.delete("versionKey"); }
    if (key === "themeKey") next.delete("versionKey");
    setSearchParams(next);
  };

  const counts = useMemo(() => {
    const content = draft?.content || {};
    if (partKey === "teil-1") return [`${content.texts?.length || 0} texts`, `${content.headlines?.length || 0} headlines`, `${content.answers?.length || 0} answers`];
    if (partKey === "teil-2") return [`${content.passage?.paragraphs?.length || 0} paragraphs`, `${content.questions?.length || 0} questions`];
    return [`${content.situations?.length || 0} situations`, `${content.ads?.length || 0} adverts`, `${content.answers?.length || 0} answers`];
  }, [draft, partKey]);

  const reload = async () => {
    if (dirty && !window.confirm("Discard your unsaved edits and reload the server version?")) return;
    await editorQuery.refetch();
  };
  const queryString = searchParams.toString();

  return (
    <div className="page editor-page">
      <PageHeader eyebrow="Lesen editor" title={partLabels[partKey] || "Reading editor"} description="Shape the exercise and add feedback that teaches students how to find the answer." actions={<div className="header-actions"><button className="button button--secondary" type="button" onClick={reload} disabled={editorQuery.isFetching}><RefreshCw className={editorQuery.isFetching ? "spin" : ""} size={17} /> Reload</button><button className="button button--primary" type="button" onClick={() => saveMutation.mutate()} disabled={!dirty || !draft || saveMutation.isPending}><Save size={17} />{saveMutation.isPending ? "Checking & saving…" : dirty ? "Save changes" : "Saved"}</button></div>} />

      {(editorQuery.error || saveMutation.error) && <Notice type="error">{saveMutation.error?.message || editorQuery.error?.message}{saveMutation.error?.status === 409 ? " Your changes are still here; reload in another tab to compare before continuing." : ""}</Notice>}
      {saved && <Notice>Changes saved safely. They are ready to publish from the repository panel.</Notice>}

      <div className="editor-context">
        <div className="part-tabs">{supportedParts.map((key) => <Link key={key} className={key === partKey ? "active" : ""} to={`/dashboard/lesen/${key}${queryString ? `?${queryString}` : ""}`} onClick={(event) => { if (dirty && !window.confirm("Discard your unsaved edits and open another part?")) event.preventDefault(); }}>{partLabels[key].replace("Lesen ", "")}</Link>)}</div>
        <div className="context-selectors">
          <Field label="Level"><select value={selection.level || ""} onChange={(event) => changeContext("level", event.target.value)}>{(editorQuery.data?.levels || ["b1", "b2"]).map((level) => <option value={level} key={level}>{level.toUpperCase()}</option>)}</select></Field>
          <Field label="Theme"><select value={selection.themeKey || ""} onChange={(event) => changeContext("themeKey", event.target.value)}>{(editorQuery.data?.themes || []).map((theme) => <option value={theme.key} key={theme.key}>{theme.title}</option>)}</select></Field>
          <Field label="Version"><select value={selection.versionKey || ""} onChange={(event) => changeContext("versionKey", event.target.value)}>{(editorQuery.data?.versions || []).map((version) => <option value={version.key} key={version.key}>{version.label}</option>)}</select></Field>
        </div>
        <div className="editor-stats">{counts.map((count) => <span key={count}>{count}</span>)}{dirty && <span className="unsaved-dot">Unsaved changes</span>}</div>
      </div>

      {editorQuery.isLoading || !draft ? (editorQuery.data && !editorQuery.data.part ? <EmptyState title="This part has no content" description="Choose another theme or version." /> : <LoadingState label="Loading the reading editor…" />) : (
        <div className="editor-sections">
          <MetaEditor meta={draft.meta || {}} onChange={(meta) => updateDraft({ ...draft, meta })} />
          {partKey === "teil-1" && <TeilOneEditor content={draft.content || {}} onChange={(content) => updateDraft({ ...draft, content })} />}
          {partKey === "teil-2" && <TeilTwoEditor content={draft.content || {}} onChange={(content) => updateDraft({ ...draft, content })} />}
          {partKey === "teil-3" && <TeilThreeEditor content={draft.content || {}} onChange={(content) => updateDraft({ ...draft, content })} />}
        </div>
      )}

      {draft && <div className="sticky-save"><div><strong>{dirty ? "You have unsaved changes" : "All changes saved"}</strong><span>{dirty ? "Save before switching themes or publishing." : "The editor is in sync with the server."}</span></div><button className="button button--primary" type="button" onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending}><Save size={17} />{saveMutation.isPending ? "Saving…" : "Save part"}</button></div>}
    </div>
  );
}
