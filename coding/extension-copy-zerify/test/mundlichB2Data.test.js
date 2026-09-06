const test = require("node:test");
const assert = require("node:assert/strict");
const database = require("../site/database/mundlich.json");
const { getSprechenContext } = require("../server/services/sprechenService");

test("B2 Mündlich keeps the existing schema and exposes all imported PDF tasks", async () => {
  const b1 = database.levels.b1;
  const b2 = database.levels.b2;

  assert.ok(b2);
  assert.deepEqual(Object.keys(b2), Object.keys(b1));
  assert.deepEqual(Object.keys(b2.parts), Object.keys(b1.parts));
  for (const partKey of Object.keys(b1.parts)) {
    assert.deepEqual(Object.keys(b2.parts[partKey]), Object.keys(b1.parts[partKey]));
  }

  assert.ok(b2.partOrder.includes("teil-2"));
  assert.ok(b2.partOrder.includes("teil-3"));
  assert.equal(new Set(b2.partOrder).size, b2.partOrder.length);
  assert.ok(b2.partOrder.every((partKey) => Object.hasOwn(b2.parts, partKey)));
  assert.equal(b2.parts["teil-1"].prompts.length, 0);
  assert.equal(b2.parts["teil-2"].topics.length, 38);
  assert.equal(b2.parts["teil-3"].topics.length, 38);

  const ids = [
    ...b2.parts["teil-2"].topics.map((topic) => topic.id),
    ...b2.parts["teil-3"].topics.map((topic) => topic.id)
  ];
  assert.equal(new Set(ids).size, ids.length);

  for (const topic of b2.parts["teil-2"].topics) {
    assert.ok(topic.title.trim());
    assert.ok(topic.personA.opinion.length >= 180);
    assert.ok(topic.personB.opinion.trim());
    assert.doesNotMatch(topic.personA.opinion, /Teilnehmer\/in|IhreMeinung|\\/i);
  }
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
