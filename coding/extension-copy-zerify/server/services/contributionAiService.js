const AppError = require("../utils/appError");

const OPENAI_API_URL = "https://api.openai.com/v1/responses";
const MAX_CONTEXT_CHARACTERS = 180000;
const AVAILABLE_MODELS = Object.freeze([
  Object.freeze({
    id: "gpt-6-astra",
    label: "GPT-6 Astra",
    description: "Höchste Genauigkeit für schwierige und mehrdeutige Prüfungsfragen.",
    recommended: true
  }),
  Object.freeze({
    id: "gpt-5.6-terra",
    label: "GPT-5.6 Terra",
    description: "Ausgewogene Genauigkeit und Geschwindigkeit.",
    recommended: false
  }),
  Object.freeze({
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    description: "Zuverlässige Prüfung mit kompakter Begründung.",
    recommended: false
  }),
  Object.freeze({
    id: "gpt-5.5",
    label: "GPT-5.5",
    description: "Bewährte Alternative für einfachere Prüfungen.",
    recommended: false
  })
]);
const MODEL_IDS = new Set(AVAILABLE_MODELS.map((model) => model.id));
const configuredDefaultModel = String(process.env.OPENAI_CONTRIBUTION_MODEL || "gpt-6-astra").trim();
const DEFAULT_MODEL = MODEL_IDS.has(configuredDefaultModel) ? configuredDefaultModel : "gpt-6-astra";

const EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    evaluations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          itemNumber: { type: "string" },
          probabilityCorrect: { type: "integer", minimum: 0, maximum: 100 },
          verdict: { type: "string", enum: ["correct", "incorrect", "uncertain"] },
          recommendedAnswer: { type: "string" },
          reason: { type: "string" },
          evidence: { type: "string" }
        },
        required: ["itemNumber", "probabilityCorrect", "verdict", "recommendedAnswer", "reason", "evidence"],
        additionalProperties: false
      }
    },
    overallNote: { type: "string" }
  },
  required: ["evaluations", "overallNote"],
  additionalProperties: false
};

function sameId(left, right) {
  return String(left ?? "") === String(right ?? "");
}

function compactText(value) {
  return String(value || "").trim();
}

function uniqueStrings(values = []) {
  return Array.from(new Set(values.map(compactText).filter(Boolean)));
}

function normalizeCandidates(candidates = []) {
  const seen = new Set();
  return (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => ({
      itemNumber: compactText(candidate?.itemNumber),
      answer: compactText(candidate?.answer)
    }))
    .filter((candidate) => {
      if (!candidate.itemNumber || !candidate.answer || seen.has(candidate.itemNumber)) return false;
      seen.add(candidate.itemNumber);
      return true;
    })
    .slice(0, 10);
}

function selectedIds(candidates) {
  return new Set(candidates.map((candidate) => candidate.itemNumber));
}

function buildTeilOneContext(content, candidates) {
  const ids = selectedIds(candidates);
  const texts = (content.texts || [])
    .filter((entry) => ids.has(String(entry?.id ?? "")))
    .map((entry) => ({ id: String(entry.id), text: compactText(entry.text) }));

  return {
    answerFormat: "Die Kandidatenlösung ist die ID einer Überschrift.",
    rules: [
      "Ordne jedem ausgewählten Lesetext die inhaltlich am besten passende Überschrift zu.",
      "Berücksichtige alle Überschriften als Ablenker und die Zuordnung der übrigen Kandidaten."
    ],
    instruction: compactText(content.instruction),
    texts,
    headlines: (content.headlines || []).map((entry) => ({ id: String(entry?.id ?? ""), text: compactText(entry?.text) })),
    candidates
  };
}

function buildTeilTwoContext(content, candidates) {
  const ids = selectedIds(candidates);
  const passageText = compactText(content.passage?.text)
    || (content.passage?.paragraphs || []).map(compactText).filter(Boolean).join("\n\n");

  return {
    answerFormat: "Die Kandidatenlösung ist die ID einer Antwortoption.",
    rules: [
      "Beantworte jede Frage ausschließlich anhand des vollständigen Lesetextes.",
      "Vergleiche die Kandidatenlösung mit allen Antwortoptionen der jeweiligen Frage."
    ],
    instruction: compactText(content.instruction),
    passage: {
      title: compactText(content.passage?.title),
      text: passageText
    },
    questions: (content.questions || [])
      .filter((question) => ids.has(String(question?.id ?? "")))
      .map((question) => ({
        id: String(question.id),
        prompt: compactText(question.prompt),
        options: (question.options || []).map((option) => ({ id: String(option?.id ?? ""), text: compactText(option?.text) }))
      })),
    candidates
  };
}

function buildTeilThreeContext(content, candidates) {
  const ids = selectedIds(candidates);
  return {
    answerFormat: "Die Kandidatenlösung ist die ID einer Anzeige; X bedeutet, dass keine Anzeige passt.",
    rules: [
      "Ordne jeder Situation die passendste Anzeige zu.",
      "Prüfe alle Anforderungen der Situation und alle Anzeigen; X ist nur richtig, wenn keine Anzeige ausreichend passt.",
      "Berücksichtige die Zuordnung der übrigen Kandidaten, wenn Anzeigen nicht mehrfach verwendet werden dürfen."
    ],
    instruction: compactText(content.instruction),
    situations: (content.situations || [])
      .filter((entry) => ids.has(String(entry?.id ?? "")))
      .map((entry) => ({ id: String(entry.id), text: compactText(entry.text) })),
    ads: (content.ads || []).map((entry) => ({ id: String(entry?.id ?? ""), text: compactText(entry?.text) })),
    candidates
  };
}

function buildSprachbausteineOneContext(content, candidates) {
  const ids = selectedIds(candidates);
  return {
    answerFormat: "Die Kandidatenlösung ist der genaue Text einer vorgegebenen Antwortoption.",
    rules: [
      "Prüfe Grammatik, Satzbau, Bedeutung, feste Verbindungen und den gesamten Briefkontext.",
      "Groß- und Kleinschreibung gehört zur Antwort und muss exakt bewertet werden.",
      "Vergleiche jede Kandidatenlösung mit allen Optionen der jeweiligen Lücke."
    ],
    title: compactText(content.title),
    instruction: compactText(content.instruction),
    clozeText: compactText(content.text),
    blanks: (content.blanks || [])
      .filter((blank) => ids.has(String(blank?.id ?? "")))
      .map((blank) => ({ id: String(blank.id), options: uniqueStrings(blank.options || []) })),
    candidates
  };
}

function buildSprachbausteineTwoContext(content, candidates) {
  return {
    answerFormat: "Die Kandidatenlösung ist der genaue Text eines Wortes aus der Wortliste.",
    rules: [
      "Prüfe Grammatik, Satzbau, Bedeutung, feste Verbindungen und den vollständigen Textzusammenhang.",
      "Groß- und Kleinschreibung gehört zur Antwort und muss exakt bewertet werden.",
      "Berücksichtige die gesamte Wortliste, plausible Ablenker und dass jedes Wort höchstens einmal eingesetzt wird."
    ],
    title: compactText(content.title),
    instruction: compactText(content.instruction),
    clozeText: compactText(content.text),
    wordBank: uniqueStrings([
      ...(content.options || []),
      ...(content.wordBank || []).map((entry) => entry?.text || entry?.value || "")
    ]),
    candidates
  };
}

function validateExerciseItems(partKey, context, candidates) {
  let availableIds = [];
  if (partKey === "teil-1") availableIds = context.texts.map((entry) => entry.id);
  if (partKey === "teil-2") availableIds = context.questions.map((entry) => entry.id);
  if (partKey === "teil-3") availableIds = context.situations.map((entry) => entry.id);
  if (partKey === "sprachbausteine-1") availableIds = context.blanks.map((entry) => entry.id);
  if (partKey === "sprachbausteine-2") {
    const markers = Array.from(compactText(context.clozeText).matchAll(/\[\[(\d+)\]\]/g), (match) => match[1]);
    availableIds = markers;
  }

  const available = new Set(availableIds);
  const missing = candidates.map((candidate) => candidate.itemNumber).filter((itemNumber) => !available.has(itemNumber));
  if (missing.length) {
    throw new AppError(`Im Aufgabenkontext fehlt Aufgabe ${missing.join(", ")}.`, 400);
  }
}

function buildContributionAiContext(input = {}) {
  const partKey = compactText(input.partKey);
  const content = input.content;
  const candidates = normalizeCandidates(input.candidates);
  if (!content || typeof content !== "object") {
    throw new AppError("Für die KI-Prüfung fehlen die Inhalte der Lesen-Aufgabe.", 400);
  }
  if (!candidates.length) {
    throw new AppError("Für die KI-Prüfung ist mindestens eine Antwort erforderlich.", 400);
  }

  let exercise;
  if (partKey === "teil-1") exercise = buildTeilOneContext(content, candidates);
  else if (partKey === "teil-2") exercise = buildTeilTwoContext(content, candidates);
  else if (partKey === "teil-3") exercise = buildTeilThreeContext(content, candidates);
  else if (partKey === "sprachbausteine-1") exercise = buildSprachbausteineOneContext(content, candidates);
  else if (partKey === "sprachbausteine-2") exercise = buildSprachbausteineTwoContext(content, candidates);
  else throw new AppError("Die KI-Prüfung ist derzeit nur für die fünf Lesen-Teile verfügbar.", 400);

  validateExerciseItems(partKey, exercise, candidates);
  const context = {
    exam: "TELC Deutsch",
    level: compactText(input.levelKey).toUpperCase(),
    theme: compactText(input.themeTitle || input.themeKey),
    partKey,
    partLabel: compactText(input.partLabel),
    exercise
  };
  if (JSON.stringify(context).length > MAX_CONTEXT_CHARACTERS) {
    throw new AppError("Dieser Lesen-Teil ist für eine einzelne KI-Prüfung zu groß.", 413);
  }
  return context;
}

function getContributionAiConfig() {
  return {
    defaultModel: DEFAULT_MODEL,
    models: AVAILABLE_MODELS.map((model) => ({ ...model }))
  };
}

function resolveModel(requestedModel) {
  const model = compactText(requestedModel) || DEFAULT_MODEL;
  if (!MODEL_IDS.has(model)) {
    throw new AppError("Das ausgewählte KI-Modell ist für Beitragsprüfungen nicht verfügbar.", 400);
  }
  return model;
}

function getOpenAIHeaders() {
  const apiKey = compactText(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new AppError("OPENAI_API_KEY ist auf dem Server nicht konfiguriert.", 500);
  }
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (process.env.OPENAI_ORG) headers["OpenAI-Organization"] = process.env.OPENAI_ORG;
  if (process.env.OPENAI_PROJECT) headers["OpenAI-Project"] = process.env.OPENAI_PROJECT;
  return headers;
}

function collectResponseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  return (payload?.output || [])
    .flatMap((item) => item?.content || [])
    .filter((item) => item?.type === "output_text")
    .map((item) => item.text || "")
    .join("");
}

function evaluationPrompt(context) {
  return [
    "Prüfe jede Kandidatenlösung als unabhängige fachliche TELC-Korrektur.",
    "Die Daten enthalten bewusst keinen offiziellen Lösungsschlüssel. Begründe das Ergebnis ausschließlich mit Aufgabenformat, Text, Optionen, Grammatik und Bedeutung.",
    "probabilityCorrect ist die kalibrierte Wahrscheinlichkeit von 0 bis 100, dass genau diese Kandidatenlösung richtig ist. Sie ist keine allgemeine Modell-Konfidenz.",
    "verdict ist correct bei klar richtiger Lösung, incorrect bei klar falscher Lösung und uncertain nur bei echter fachlicher Mehrdeutigkeit.",
    "recommendedAnswer: Wenn verdict incorrect ist, gib die fachlich richtige Lösung exakt im verlangten Antwortformat zurück (ID oder genauer Wortlaut). Verwende bei correct oder uncertain eine leere Zeichenfolge.",
    "Achte bei Sprachbausteinen exakt auf Groß- und Kleinschreibung. Eine abweichende Schreibweise darf nicht stillschweigend normalisiert werden.",
    "reason: ein bis drei kurze deutsche Sätze mit der entscheidenden fachlichen Begründung; keine privaten Gedankenschritte.",
    "evidence: die knappste relevante Textstelle oder grammatische Verbindung. Wenn kein kurzer Beleg möglich ist, nenne die maßgebliche Regel.",
    "Gib genau eine Auswertung pro Kandidat und keine zusätzlichen Aufgaben aus.",
    `PRÜFKONTEXT:\n${JSON.stringify(context)}`
  ].join("\n\n");
}

async function requestEvaluation(model, context) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  let response;
  try {
    response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: getOpenAIHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "high" },
        max_output_tokens: 12000,
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "telc_contribution_check",
            strict: true,
            schema: EVALUATION_SCHEMA
          }
        },
        input: [
          {
            role: "developer",
            content: "Du bist eine erfahrene TELC-Deutschprüferin. Bewerte Lösungen streng, kalibriert und nachvollziehbar, ohne dich auf einen vorgegebenen Lösungsschlüssel zu verlassen."
          },
          { role: "user", content: evaluationPrompt(context) }
        ]
      })
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new AppError("Die KI-Prüfung hat zu lange gedauert. Bitte erneut versuchen.", 504);
    throw new AppError("Die KI-Prüfung konnte OpenAI nicht erreichen.", 502);
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AppError(payload?.error?.message || "Die OpenAI-Prüfung ist fehlgeschlagen.", 502);
  }
  if (payload.status === "incomplete") {
    throw new AppError("Die KI-Prüfung war unvollständig. Bitte erneut versuchen.", 502, payload.incomplete_details || null);
  }
  const refusal = (payload.output || []).flatMap((item) => item?.content || []).find((item) => item?.type === "refusal");
  if (refusal) throw new AppError(refusal.refusal || "Die KI konnte diese Antworten nicht prüfen.", 422);

  try {
    return JSON.parse(collectResponseText(payload));
  } catch (error) {
    throw new AppError("Die KI hat kein lesbares Prüfergebnis zurückgegeben.", 502);
  }
}

function normalizeEvaluationResults(parsed, candidates) {
  const byItemNumber = new Map();
  (Array.isArray(parsed?.evaluations) ? parsed.evaluations : []).forEach((evaluation) => {
    const itemNumber = compactText(evaluation?.itemNumber);
    if (itemNumber && !byItemNumber.has(itemNumber)) byItemNumber.set(itemNumber, evaluation);
  });

  const missing = candidates.filter((candidate) => !byItemNumber.has(candidate.itemNumber));
  if (missing.length) {
    throw new AppError(`Die KI-Prüfung enthält kein Ergebnis für Aufgabe ${missing.map((item) => item.itemNumber).join(", ")}.`, 502);
  }

  return candidates.map((candidate) => {
    const evaluation = byItemNumber.get(candidate.itemNumber);
    const verdict = ["correct", "incorrect", "uncertain"].includes(evaluation?.verdict)
      ? evaluation.verdict
      : "uncertain";
    const recommendedAnswer = verdict === "incorrect" ? compactText(evaluation?.recommendedAnswer).slice(0, 500) : "";
    if (verdict === "incorrect" && !recommendedAnswer) {
      throw new AppError(`Die KI-Prüfung enthält für die falsche Antwort bei Aufgabe ${candidate.itemNumber} keine empfohlene Lösung.`, 502);
    }
    return {
      itemNumber: candidate.itemNumber,
      candidateAnswer: candidate.answer,
      confidence: Math.max(0, Math.min(100, Math.round(Number(evaluation?.probabilityCorrect) || 0))),
      verdict,
      recommendedAnswer,
      reason: compactText(evaluation?.reason).slice(0, 1600),
      evidence: compactText(evaluation?.evidence).slice(0, 1000)
    };
  });
}

async function checkLesenContributionAnswers(input = {}, requestedModel = "") {
  const model = resolveModel(requestedModel);
  const context = buildContributionAiContext(input);
  const parsed = await requestEvaluation(model, context);
  const candidates = context.exercise.candidates;
  const evaluations = normalizeEvaluationResults(parsed, candidates);

  return {
    reviewKey: compactText(input.reviewKey),
    answerSet: compactText(input.answerSet),
    partKey: compactText(input.partKey),
    model,
    evaluations,
    overallNote: compactText(parsed?.overallNote).slice(0, 2000),
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  getContributionAiConfig,
  resolveModel,
  buildContributionAiContext,
  normalizeEvaluationResults,
  checkLesenContributionAnswers
};
