const test = require("node:test");
const assert = require("node:assert/strict");
const {
  LESEN_PART_ORDER,
  createEmptyVersion,
  orderedVersionKeys,
  resolveThemeSelection,
  summarizeThemes
} = require("../server/services/lesenService");
const { resolveThemeContext } = require("../server/services/contributionService");

test("a new version starts with all five Lesen parts", () => {
  const version = createEmptyVersion("b2", "version-2", "Änderung 2", "Reisen · Änderung 2");

  assert.equal(version.key, "version-2");
  assert.deepEqual(version.lesen.partOrder, LESEN_PART_ORDER);
  assert.deepEqual(Object.keys(version.lesen.parts), LESEN_PART_ORDER);
  assert.equal(version.lesen.parts["teil-3"].meta.title, "Reisen · Änderung 2");
});

test("version summaries retain configured order and expose every part per version", () => {
  const summary = summarizeThemes({
    themeOrder: ["reisen"],
    themes: {
      reisen: {
        title: "Reisen",
        defaultVersion: "original",
        versionOrder: ["original", "version-1"],
        versions: {
          "version-1": { label: "Änderung 1", lesen: { partOrder: ["teil-2"], parts: { "teil-2": {} } } },
          original: { label: "Original", lesen: { partOrder: ["teil-1"], parts: { "teil-1": {} } } }
        }
      }
    }
  })[0];

  assert.deepEqual(orderedVersionKeys({ versionOrder: ["original", "version-1"], versions: { "version-1": {}, original: {} } }), ["original", "version-1"]);
  assert.equal(summary.versionCount, 2);
  assert.deepEqual(summary.versions.map((version) => version.key), ["original", "version-1"]);
  assert.equal(summary.versions[1].parts.find((part) => part.key === "teil-2").visible, true);
});

test("legacy standalone theme keys resolve to their grouped version", () => {
  const db = {
    levels: {
      b2: {
        themes: {
          reisen: {
            defaultVersion: "default",
            versionOrder: ["default", "version-1"],
            versions: { default: {}, "version-1": {} }
          }
        },
        themeAliases: {
          "reisen-1": { themeKey: "reisen", versionKey: "version-1" }
        }
      }
    }
  };

  assert.deepEqual(resolveThemeContext(db, "b2", "reisen-1", "default"), {
    themeKey: "reisen",
    versionKey: "version-1"
  });
  assert.deepEqual(resolveThemeContext(db, "b2", "reisen", "version-1"), {
    themeKey: "reisen",
    versionKey: "version-1"
  });
  assert.deepEqual(resolveThemeSelection(db.levels.b2, "reisen-1", "default"), {
    themeKey: "reisen",
    versionKey: "version-1"
  });
});
