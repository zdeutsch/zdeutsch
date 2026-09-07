const test = require("node:test");
const assert = require("node:assert/strict");
const database = require("../site/database/mundlich.json");
const { getSprechenContext } = require("../server/services/sprechenService");

test("Mündlich Teil 2 uses the title-and-text schema for B1 and B2", async () => {
  const b1 = database.levels.b1;
  const b2 = database.levels.b2;

  assert.ok(b2);
  assert.deepEqual(Object.keys(b2), Object.keys(b1));
  assert.deepEqual(Object.keys(b2.parts), Object.keys(b1.parts));
  assert.ok(b2.partOrder.includes("teil-2"));
  assert.ok(b2.partOrder.includes("teil-3"));
  assert.equal(new Set(b2.partOrder).size, b2.partOrder.length);
  assert.ok(b2.partOrder.every((partKey) => Object.hasOwn(b2.parts, partKey)));
  const presentation = b2.parts["teil-1"];
  assert.equal(presentation.durationMinutes, 5);
  assert.equal(presentation.prompts.length, 7);
  assert.ok(presentation.followUps.length > 0);
  assert.match(presentation.prompts[0], /Buch/i);
  assert.match(presentation.prompts[1], /Film/i);
  assert.match(presentation.sourceUrl, /^https:\/\/shop\.telc\.net\//);
  assert.equal(b2.parts["teil-2"].topics.length, 38);
  assert.equal(b2.parts["teil-3"].topics.length, 38);

  for (const topic of b1.parts["teil-2"].topics) {
    assert.deepEqual(Object.keys(topic), ["title", "text"]);
    assert.ok(topic.title.trim());
    assert.match(topic.text, /^Person A: .+\nPosition A: .+\n\nPerson B: .+\nPosition B: /s);
  }

  for (const topic of b2.parts["teil-2"].topics) {
    assert.deepEqual(Object.keys(topic), ["title", "text"]);
    assert.ok(topic.title.trim());
    assert.ok(topic.text.length >= 180);
    assert.match(topic.text, /^Zeitschriftentext:\n/);
    assert.match(topic.text, /\n\nDiskussionsauftrag:\n/);
    assert.doesNotMatch(topic.text, /Teilnehmer\/in|IhreMeinung|\\/i);
  }

  const planningIds = b2.parts["teil-3"].topics.map((topic) => topic.id);
  assert.equal(new Set(planningIds).size, planningIds.length);
  for (const topic of b2.parts["teil-3"].topics) {
    assert.ok(topic.title.trim());
    assert.ok(topic.prompt.trim());
    assert.ok(topic.notes.length >= 4);
  }

  const context = await getSprechenContext({ level: "b2", partKey: "teil-2" });
  assert.equal(context.level, "b2");
  assert.equal(context.levelAvailable, true);
  assert.equal(context.partKey, "teil-2");
  assert.equal(context.part.topics.length, 38);
  assert.equal(context.parts.find((part) => part.key === "teil-2").visible, true);
  assert.equal(context.parts.find((part) => part.key === "teil-3").visible, true);
});
