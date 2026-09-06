const AppError = require("../utils/appError");
const {
  AVAILABLE_MODELS,
  DEFAULT_MODEL
} = require("./contributionAiService");

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MAX_CONTEXT_CHARACTERS = 120000;
const MODEL_IDS = new Set(AVAILABLE_MODELS.map((model) => model.id));

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    reason: { type: "string" },
    score: { type: "integer", minimum: 0, maximum: 100 },
    alternativeAssessment: { type: "string" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          source: { type: "string" },
          quote: { type: "string" },
          occurrence: { type: "integer", minimum: 1 }
        },
        required: ["source", "quote", "occurrence"],
        additionalProperties: false
      }
    }
  },
  required: ["reason", "score", "alternativeAssessment", "evidence"],
  additionalProperties: false
};

function sameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function findById(items, id, key = "id") {
  return (Array.isArray(items) ? items : []).find((item) => sameId(item?.[key], id));
}

function requireText(value, message) {
  const text = String(value || "");
  if (!text.trim()) {
    throw new AppError(message, 400);
  }
  return text;
}

function buildAnalysisContext(partKey, content, targetId) {
  if (!content || typeof content !== "object") {
    throw new AppError("Lesen content is required for AI analysis", 400);
  }

  let context;
  if (partKey === "teil-1") {
    const answer = findById(content.answers, targetId, "textId");
    if (!answer) throw new AppError("The selected Teil 1 answer was not found", 404);
    const textItem = findById(content.texts, answer.textId);
    const correct = findById(content.headlines, answer.headlineId);
    const text = requireText(textItem?.text, "The selected reading text is empty");
    const headline = requireText(correct?.text, "The correct headline is empty");
    context = {
      partKey,
      task: `Ordne Text ${answer.textId} der richtigen Überschrift zu.`,
      correctAnswer: { id: String(answer.headlineId), text: headline },
      alternatives: (content.headlines || []).filter((item) => !sameId(item.id, answer.headlineId)).map((item) => ({ id: String(item.id), text: String(item.text || "") })),
      sources: [
        { key: "text", label: `Text ${answer.textId}`, text },
        { key: "headline", label: `Richtige Überschrift ${answer.headlineId}`, text: headline }
      ]
    };
  } else if (partKey === "teil-2") {
    const question = findById(content.questions, targetId);
    if (!question) throw new AppError("The selected Teil 2 question was not found", 404);
    const correct = findById(question.options, question.answerId);
    context = {
      partKey,
      task: requireText(question.prompt, "The selected question is empty"),
      correctAnswer: { id: String(question.answerId), text: requireText(correct?.text, "The correct answer option is empty") },
      alternatives: (question.options || []).filter((item) => !sameId(item.id, question.answerId)).map((item) => ({ id: String(item.id), text: String(item.text || "") })),
      sources: [
        { key: "passage-title", label: "Titel des Lesetextes", text: String(content.passage?.title || "") },
        ...(content.passage?.paragraphs || []).map((text, index) => ({ key: `passage:${index}`, label: `Absatz ${index + 1}`, text: String(text || "") })),
        { key: "question", label: `Frage ${question.id}`, text: String(question.prompt || "") },
        { key: `option:${String(correct.id).toLowerCase()}`, label: `Richtige Option ${String(correct.id).toUpperCase()}`, text: String(correct.text || "") }
      ].filter((source) => source.text.trim())
    };
  } else if (partKey === "teil-3") {
    const answer = findById(content.answers, targetId, "situationId");
    if (!answer) throw new AppError("The selected Teil 3 answer was not found", 404);
    const situationItem = findById(content.situations, answer.situationId);
    const correct = findById(content.ads, answer.adId);
    const situation = requireText(situationItem?.text, "The selected situation is empty");
    const ad = requireText(correct?.text, "The correct advertisement is empty");
    context = {
      partKey,
      task: `Finde für Situation ${answer.situationId} die passende Anzeige.`,
      correctAnswer: { id: String(answer.adId), text: ad },
      alternatives: (content.ads || []).filter((item) => !sameId(item.id, answer.adId)).map((item) => ({ id: String(item.id), text: String(item.text || "") })),
      sources: [
        { key: "situation", label: `Situation ${answer.situationId}`, text: situation },
        { key: "ad", label: `Richtige Anzeige ${answer.adId}`, text: ad }
      ]
    };
  } else {
    throw new AppError("AI analysis is available only for Lesen Teil 1, Teil 2, and Teil 3", 400);
  }

  if (JSON.stringify(context).length > MAX_CONTEXT_CHARACTERS) {
    throw new AppError("This exercise is too large for one AI analysis request", 413);
  }
  return context;
}

function resolveModel(requestedModel = "") {
  const configured = String(requestedModel || process.env.OPENAI_LESEN_MODEL || DEFAULT_MODEL).trim();
  if (!MODEL_IDS.has(configured)) {
    throw new AppError("Das ausgewählte KI-Modell ist für Lesen-Prüfungen nicht verfügbar.", 400);
  }
  return configured;
}

function getOpenAIHeaders() {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    throw new AppError("OPENAI_API_KEY is not configured on the server", 500);
  }
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (process.env.OPENAI_ORG) headers["OpenAI-Organization"] = process.env.OPENAI_ORG;
  if (process.env.OPENAI_PROJECT) headers["OpenAI-Project"] = process.env.OPENAI_PROJECT;
  return headers;
}

function collectResponseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  return (payload?.output || []).flatMap((item) => item?.content || []).filter((item) => item?.type === "output_text").map((item) => item.text || "").join("");
}

function findOccurrence(sourceText, quote, occurrence) {
  const find = (haystack, needle) => {
    let cursor = 0;
    let found = -1;
    for (let index = 0; index < occurrence; index += 1) {
      found = haystack.indexOf(needle, cursor);
      if (found < 0) return -1;
      cursor = found + needle.length;
    }
    return found;
  };
  const exact = find(sourceText, quote);
  if (exact >= 0) return exact;
  return find(sourceText.toLocaleLowerCase("de"), quote.toLocaleLowerCase("de"));
}

function mapEvidenceToHighlights(evidence, sources) {
  const sourceMap = new Map(sources.map((source) => [source.key, source.text]));
  const highlights = (Array.isArray(evidence) ? evidence : []).map((item) => {
    const source = String(item?.source || "").trim();
    const quote = String(item?.quote || "").trim();
    const occurrence = Math.max(1, Number.parseInt(item?.occurrence, 10) || 1);
    const sourceText = sourceMap.get(source);
    if (!sourceText || !quote) return null;
    const start = findOccurrence(sourceText, quote, occurrence);
    if (start < 0) return null;
    return { source, start, end: start + quote.length, text: sourceText.slice(start, start + quote.length) };
  }).filter(Boolean).sort((left, right) => left.source.localeCompare(right.source) || left.start - right.start);

  return highlights.filter((item, index, items) => {
    const previous = items[index - 1];
    return !previous || previous.source !== item.source || previous.end <= item.start;
  }).slice(0, 12);
}

function analysisPrompt(context) {
  return [
    "Analysiere die folgende TELC-Leseaufgabe und liefere eine pädagogisch präzise Begründung.",
    "Vergleiche die richtige Lösung mit allen Alternativen und berücksichtige, warum besonders plausible Ablenker nicht passen.",
    "reason: Schreibe auf Deutsch, 2 bis 4 klare Sätze für Lernende. Begründe die richtige Lösung durch die Beziehung zwischen Aufgabe und Text; erwähne bei Bedarf knapp den wichtigsten Unterschied zu einem Ablenker.",
    "alternativeAssessment: Schreibe auf Deutsch eine kurze fachliche Zusammenfassung nur für die Administration, ohne private Gedankenschritte.",
    "score: Bewerte von 0 bis 100, wie eindeutig und fachlich belastbar die vorgegebene richtige Lösung durch den Text gestützt wird.",
    "evidence: Wähle nur entscheidende, möglichst kurze Textstellen. quote muss exakt und unverändert in der angegebenen source vorkommen. occurrence ist bei Wiederholungen 1-basiert.",
    `Erlaubte source-Schlüssel: ${context.sources.map((source) => source.key).join(", ")}.`,
    "Gib keine Übersetzung und keine zusätzlichen Felder aus.",
    `AUFGABENDATEN:\n${JSON.stringify(context)}`
  ].join("\n\n");
}

async function requestAnalysis(context, requestedModel) {
  const model = resolveModel(requestedModel);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  let response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: getOpenAIHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "medium" },
        max_output_tokens: 1400,
        text: {
          verbosity: "low",
          format: { type: "json_schema", name: "lesen_answer_analysis", strict: true, schema: ANALYSIS_SCHEMA }
        },
        input: [
          { role: "developer", content: "Du bist eine erfahrene TELC-Deutschprüferin. Liefere überprüfbare Schlussfolgerungen, keine privaten Gedankenschritte." },
          { role: "user", content: analysisPrompt(context) }
        ]
      })
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new AppError("The AI analysis timed out. Please try again.", 504);
    throw new AppError("The AI analysis could not reach OpenAI", 502);
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(payload?.error?.message || "OpenAI analysis failed", 502);
  }
  if (payload.status === "incomplete") {
    throw new AppError("The AI analysis was incomplete. Please try again.", 502, payload.incomplete_details || null);
  }
  const refusal = (payload.output || []).flatMap((item) => item?.content || []).find((item) => item?.type === "refusal");
  if (refusal) throw new AppError(refusal.refusal || "The AI could not analyze this answer", 422);

  let parsed;
  try {
    parsed = JSON.parse(collectResponseText(payload));
  } catch (error) {
    throw new AppError("The AI returned an unreadable analysis", 502);
  }
  return { model, parsed };
}

async function analyzeLesenAnswer(payload) {
  const partKey = String(payload?.partKey || "").trim();
  const context = buildAnalysisContext(partKey, payload?.content, payload?.targetId);
  const { model, parsed } = await requestAnalysis(context, payload?.model);
  const reason = String(parsed?.reason || "").trim();
  const alternativeAssessment = String(parsed?.alternativeAssessment || "").trim();
  const highlights = mapEvidenceToHighlights(parsed?.evidence, context.sources);
  if (!reason || !highlights.length) {
    throw new AppError("The AI analysis did not return usable German reasoning and exact evidence. Please try again.", 502);
  }
  return {
    reason: reason.slice(0, 6000),
    highlights,
    score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
    alternativeAssessment: alternativeAssessment.slice(0, 4000),
    model,
    analyzedAt: new Date().toISOString()
  };
}

module.exports = {
  DEFAULT_MODEL,
  resolveModel,
  buildAnalysisContext,
  mapEvidenceToHighlights,
  analyzeLesenAnswer
};
