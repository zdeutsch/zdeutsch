const test = require("node:test");
const assert = require("node:assert/strict");

const {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  buildContributionAiContext,
  normalizeEvaluationResults,
  checkLesenContributionAnswers
} = require("../server/services/contributionAiService");

test("contribution checks recommend the strongest available model", () => {
  assert.equal(DEFAULT_MODEL, "gpt-6-astra");
  assert.equal(AVAILABLE_MODELS.find((model) => model.recommended)?.id, DEFAULT_MODEL);
});

test("Teil 1 AI context includes selected texts and every headline without an answer key", () => {
  const context = buildContributionAiContext({
    partKey: "teil-1",
    levelKey: "b1",
    themeTitle: "Reisen",
    candidates: [{ itemNumber: "1", answer: "B" }],
    content: {
      texts: [{ id: 1, text: "Mit dem Zug ans Meer." }, { id: 2, text: "Nicht ausgewählt" }],
      headlines: [{ id: "A", text: "Berge" }, { id: "B", text: "Bahnreise" }],
      answers: [{ textId: 1, headlineId: "B" }]
    }
  });

  assert.deepEqual(context.exercise.texts, [{ id: "1", text: "Mit dem Zug ans Meer." }]);
  assert.deepEqual(context.exercise.headlines.map((item) => item.id), ["A", "B"]);
  assert.equal(Object.hasOwn(context.exercise, "answers"), false);
});

test("Teil 2 and Teil 3 AI contexts include their complete decision material", () => {
  const teilTwo = buildContributionAiContext({
    partKey: "teil-2",
    candidates: [{ itemNumber: "6", answer: "b" }],
    content: {
      passage: { title: "Parken", paragraphs: ["Basel und Stockholm waren zuerst."] },
      questions: [{ id: 6, prompt: "Wo?", answerId: "b", options: [{ id: "a", text: "Berlin" }, { id: "b", text: "Basel" }] }]
    }
  });
  const teilThree = buildContributionAiContext({
    partKey: "teil-3",
    candidates: [{ itemNumber: "11", answer: "A" }],
    content: {
      situations: [{ id: 11, text: "Familie sucht einen Park." }],
      ads: [{ id: "A", text: "Freizeitpark" }, { id: "B", text: "Sprachkurs" }],
      answers: [{ situationId: 11, adId: "A" }]
    }
  });

  assert.match(teilTwo.exercise.passage.text, /Basel/);
  assert.deepEqual(teilTwo.exercise.questions[0].options.map((item) => item.id), ["a", "b"]);
  assert.deepEqual(teilThree.exercise.ads.map((item) => item.id), ["A", "B"]);
  assert.equal(Object.hasOwn(teilThree.exercise, "answers"), false);
});

test("both Sprachbausteine contexts preserve capitalization and part-specific options", () => {
  const teilOne = buildContributionAiContext({
    partKey: "sprachbausteine-1",
    candidates: [{ itemNumber: "21", answer: "Sie" }],
    content: {
      text: "[[21]] erhalten eine Antwort.",
      blanks: [{ id: 21, options: ["sie", "Sie", "Ihnen"] }],
      answers: [{ id: 21, answer: "Sie" }]
    }
  });
  const teilTwo = buildContributionAiContext({
    partKey: "sprachbausteine-2",
    candidates: [{ itemNumber: "31", answer: "ALS" }],
    content: {
      text: "Es gilt [[31]] richtig.",
      options: ["ALS", "als", "WENN"],
      answers: [{ id: 31, answer: "ALS" }]
    }
  });

  assert.deepEqual(teilOne.exercise.blanks[0].options, ["sie", "Sie", "Ihnen"]);
  assert.equal(teilOne.exercise.candidates[0].answer, "Sie");
  assert.deepEqual(teilTwo.exercise.wordBank, ["ALS", "als", "WENN"]);
  assert.equal(Object.hasOwn(teilTwo.exercise, "answers"), false);
});

test("AI results remain aligned with candidates and expose a bounded percentage", () => {
  const results = normalizeEvaluationResults({
    evaluations: [{ itemNumber: "21", probabilityCorrect: 108, verdict: "correct", recommendedAnswer: "", reason: "Passt.", evidence: "Sie erhalten" }]
  }, [{ itemNumber: "21", answer: "Sie" }]);

  assert.deepEqual(results, [{
    itemNumber: "21",
    candidateAnswer: "Sie",
    confidence: 100,
    verdict: "correct",
    recommendedAnswer: "",
    reason: "Passt.",
    evidence: "Sie erhalten"
  }]);
});

test("AI results expose the recommended correction only for wrong answers", () => {
  const results = normalizeEvaluationResults({
    evaluations: [{ itemNumber: "21", probabilityCorrect: 9, verdict: "incorrect", recommendedAnswer: "Sie", reason: "Anrede.", evidence: "Sie erhalten" }]
  }, [{ itemNumber: "21", answer: "sie" }]);

  assert.equal(results[0].candidateAnswer, "sie");
  assert.equal(results[0].recommendedAnswer, "Sie");
});

test("rejects a wrong AI verdict without a concrete recommended answer", () => {
  assert.throws(() => normalizeEvaluationResults({
    evaluations: [{ itemNumber: "21", probabilityCorrect: 9, verdict: "incorrect", recommendedAnswer: "", reason: "Anrede.", evidence: "Sie erhalten" }]
  }, [{ itemNumber: "21", answer: "sie" }]), /keine empfohlene Lösung/);
});

test("AI checking sends the adapted context and returns confidence per task", async () => {
  const previousFetch = global.fetch;
  const previousApiKey = process.env.OPENAI_API_KEY;
  let requestBody;
  process.env.OPENAI_API_KEY = "test-key";
  global.fetch = async (url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      async json() {
        return {
          output_text: JSON.stringify({
            evaluations: [{ itemNumber: "21", probabilityCorrect: 91, verdict: "correct", recommendedAnswer: "", reason: "Die Anrede verlangt die Großschreibung.", evidence: "Sie erhalten" }],
            overallNote: "Eindeutige Anredeform."
          })
        };
      }
    };
  };

  try {
    const result = await checkLesenContributionAnswers({
      reviewKey: "review-1",
      answerSet: "suggested",
      levelKey: "b2",
      themeTitle: "Anmeldung",
      partKey: "sprachbausteine-1",
      partLabel: "Sprachbausteine 1",
      candidates: [{ itemNumber: "21", answer: "Sie" }],
      content: { text: "[[21]] erhalten eine Antwort.", blanks: [{ id: 21, options: ["sie", "Sie", "Ihnen"] }] }
    }, "gpt-5.6-terra");

    const prompt = requestBody.input.find((entry) => entry.role === "user").content;
    assert.equal(requestBody.model, "gpt-5.6-terra");
    assert.match(prompt, /Groß- und Kleinschreibung/);
    assert.match(prompt, /recommendedAnswer/);
    assert.match(prompt, /\[\[21\]\] erhalten eine Antwort/);
    assert.equal(result.evaluations[0].confidence, 91);
    assert.equal(result.evaluations[0].candidateAnswer, "Sie");
  } finally {
    global.fetch = previousFetch;
    if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousApiKey;
  }
});
