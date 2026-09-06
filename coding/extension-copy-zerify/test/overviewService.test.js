const test = require("node:test");
const assert = require("node:assert/strict");
const {
  analyzeLesen,
  analyzeHoren,
  analyzeShreiben,
  analyzeSprechen
} = require("../server/services/overviewService");
const { summarizePart } = require("../server/services/sprechenService");

test("analyzeLesen reports section, translation, and enrichment coverage", () => {
  const result = analyzeLesen({
    levels: {
      b1: {
        themes: {
          sample: {
            versions: {
              default: {
                lesen: {
                  parts: {
                    "teil-1": {
                      content: {
                        texts: [{ id: 1, text: "Text", translated: "Übersetzung" }],
                        headlines: [{ id: "A", text: "Headline" }],
                        answers: [{ textId: 1, headlineId: "A", reason: "Because", highlights: [{ source: "text" }] }]
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  assert.equal(result.themes, 1);
  assert.equal(result.versions, 1);
  assert.equal(result.parts, 1);
  assert.equal(result.missingParts, 4);
  assert.equal(result.partCoveragePercent, 20);
  assert.equal(result.translationCoveragePercent, 50);
  assert.equal(result.explanationCoveragePercent, 100);
  assert.equal(result.highlights, 1);
});

test("analyzeHoren validates identifier uniqueness while counting statements", () => {
  const result = analyzeHoren({
    levels: {
      b2: {
        themes: {
          sample: {
            hören: {
              parts: {
                "teil-1": {
                  content: {
                    topics: [{
                      id: "topic-1",
                      comment: "Review",
                      statements: [
                        { id: "statement-1", correct: true },
                        { id: "statement-2", correct: false }
                      ]
                    }]
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  assert.equal(result.topics, 1);
  assert.equal(result.statements, 2);
  assert.equal(result.trueStatements, 1);
  assert.equal(result.falseStatements, 1);
  assert.equal(result.comments, 1);
  assert.equal(result.missingIds, 0);
  assert.equal(result.duplicateIds, 0);
});

test("analyzeShreiben preserves the current istructions contract", () => {
  const result = analyzeShreiben({
    levels: {
      b1: {
        tasks: [
          { title: "Complete", istructions: "Do this", content: "Source", tasks: "Prompt" },
          { title: "Incomplete", istructions: "", content: "Source", tasks: "Prompt" }
        ]
      }
    }
  });

  assert.equal(result.tasks, 2);
  assert.equal(result.completeTasks, 1);
  assert.equal(result.completenessPercent, 50);
});

test("analyzeSprechen counts the existing oral-exam structure", () => {
  const result = analyzeSprechen({
    levels: {
      b1: {
        parts: {
          "teil-1": { prompts: ["Name", "Beruf"], followUps: ["Warum?"] },
          "teil-2": { topics: [{ id: "diskussion-1" }, { id: "diskussion-2" }] },
          "teil-3": { topics: [{ id: "planung-1" }] }
        }
      }
    }
  });

  assert.equal(result.parts, 3);
  assert.equal(result.topics, 3);
  assert.equal(result.prompts, 2);
  assert.equal(result.followUps, 1);
  assert.deepEqual(result.byLevel.b1, {
    parts: 3,
    topics: 3,
    prompts: 2,
    followUps: 1
  });
});

test("summarizePart exposes the number of editable oral-exam entries", () => {
  assert.deepEqual(summarizePart("teil-1", {
    title: "Kennenlernen",
    shortTitle: "Vorstellen",
    durationMinutes: 3,
    prompts: ["Name", "Wohnort"],
    followUps: ["Warum Deutsch?"]
  }), {
    key: "teil-1",
    title: "Kennenlernen",
    shortTitle: "Vorstellen",
    durationMinutes: 3,
    itemCount: 3,
    available: true,
    visible: true
  });
});
