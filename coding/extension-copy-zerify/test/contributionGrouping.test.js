const test = require("node:test");
const assert = require("node:assert/strict");

test("public contribution links open the exact theme on labs.zdeutsch.app", async () => {
  const { buildPublicThemeUrl } = await import("../dashboard-react/src/utils/contributions.mjs");
  const url = new URL(buildPublicThemeUrl({
    canAccept: true,
    levelKey: "b2",
    themeKey: "arbeit-und-beruf",
    currentVersionKey: "version-2"
  }));

  assert.equal(url.origin, "https://labs.zdeutsch.app");
  assert.equal(url.pathname, "/lesen.html");
  assert.equal(url.searchParams.get("level"), "b2");
  assert.equal(url.searchParams.get("theme"), "arbeit-und-beruf");
  assert.equal(url.searchParams.get("version"), "version-2");
});

test("identical submitted answers share one group and expose contributor emails", async () => {
  const { groupContributionItems } = await import("../dashboard-react/src/utils/contributions.mjs");
  const base = {
    levelKey: "b1",
    themeKey: "reisen",
    currentVersionKey: "default",
    partKey: "teil-1",
    themeTitle: "Reisen",
    comparisonRows: [
      { itemNumber: "2", currentValue: "A", submittedValue: "B", isDifferent: true },
      { itemNumber: "1", currentValue: "C", submittedValue: "D", isDifferent: true }
    ],
    differences: [
      { itemNumber: "2", currentValue: "A", submittedValue: "B", isDifferent: true },
      { itemNumber: "1", currentValue: "C", submittedValue: "D", isDifferent: true }
    ]
  };
  const groups = groupContributionItems([
    { ...base, reviewKey: "one", email: "eins@example.com" },
    { ...base, reviewKey: "two", email: "zwei@example.com", differences: [...base.differences].reverse() },
    { ...base, reviewKey: "three", email: "drei@example.com", differences: [{ itemNumber: "1", currentValue: "C", submittedValue: "A", isDifferent: true }] }
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].contributorCount, 2);
  assert.deepEqual(groups[0].contributorEmails, ["eins@example.com", "zwei@example.com"]);
});

test("matching only the theme or submitted value is not enough to group contributions", async () => {
  const { groupContributionItems } = await import("../dashboard-react/src/utils/contributions.mjs");
  const context = {
    levelKey: "b2",
    themeKey: "arbeit",
    currentVersionKey: "default",
    partKey: "teil-2"
  };
  const groups = groupContributionItems([
    { ...context, reviewKey: "one", differences: [{ itemNumber: "6", currentValue: "A", submittedValue: "B" }] },
    { ...context, reviewKey: "two", differences: [{ itemNumber: "6", currentValue: "C", submittedValue: "B" }] },
    { ...context, reviewKey: "three", differences: [{ itemNumber: "7", currentValue: "A", submittedValue: "B" }] },
    { ...context, reviewKey: "four", differences: [] },
    { ...context, reviewKey: "five", differences: [] }
  ]);

  assert.equal(groups.length, 5);
  assert.ok(groups.every((group) => group.items.length === 1));
});

test("Sprachbausteine suggestions with different capitalization stay in separate groups", async () => {
  const { groupContributionItems } = await import("../dashboard-react/src/utils/contributions.mjs");
  const context = {
    levelKey: "b2",
    themeKey: "alltag",
    currentVersionKey: "default",
    partKey: "sprachbausteine-1"
  };
  const groups = groupContributionItems([
    {
      ...context,
      reviewKey: "uppercase",
      differences: [{ itemNumber: "21", currentValue: "Ihnen", submittedValue: "Sie" }]
    },
    {
      ...context,
      reviewKey: "lowercase",
      differences: [{ itemNumber: "21", currentValue: "Ihnen", submittedValue: "sie" }]
    }
  ]);

  assert.equal(groups.length, 2);
  assert.ok(groups.every((group) => group.items.length === 1));
});
