const test = require("node:test");
const assert = require("node:assert/strict");

async function loadMigration() {
  return import("../scripts/migrate-windows-data.mjs");
}

test("Windows Hören topics merge by stable ID and remain idempotent", async () => {
  const { migrateHoren } = await loadMigration();
  const topic = (id, title) => ({ id, title, statements: [] });
  const wrap = (topics) => ({ levels: { b1: { themes: { exam: { hören: { parts: { "teil-1": { content: { topics } } } } } } } } });
  const current = wrap([topic("existing", "Bestehend")]);
  const windowsData = wrap([topic("existing", "Bestehend"), topic("new", "Neu")]);

  assert.equal(migrateHoren(current, windowsData).added.length, 1);
  assert.deepEqual(current.levels.b1.themes.exam.hören.parts["teil-1"].content.topics.map(({ id }) => id), ["existing", "new"]);
  assert.equal(migrateHoren(current, windowsData).added.length, 0);
});

test("Miroslav 2 becomes a version and never a duplicate theme", async () => {
  const { migrateLesen } = await loadMigration();
  const current = {
    levels: {
      b1: {
        themes: {
          miroslav: {
            versions: { default: { key: "default", lesen: { parts: { "teil-1": {} } } } },
            versionOrder: ["default"]
          }
        }
      }
    }
  };
  const windowsData = {
    levels: {
      b1: {
        themes: {
          "Miroslav 2": {
            title: "Miroslav 2",
            versions: { default: { key: "default", lesen: { parts: { "teil-1": {}, "teil-2": {} } } } },
            versionOrder: ["default"]
          }
        }
      }
    }
  };

  assert.equal(migrateLesen(current, windowsData).added, true);
  assert.deepEqual(current.levels.b1.themes.miroslav.versionOrder, ["default", "version-2"]);
  assert.deepEqual(current.levels.b1.themeAliases["Miroslav 2"], { themeKey: "miroslav", versionKey: "version-2" });
  assert.equal(Object.hasOwn(current.levels.b1.themes, "Miroslav 2"), false);
  assert.equal(migrateLesen(current, windowsData).added, false);
});

test("Windows Schreiben updates known versions and adds only genuinely new prompts", async () => {
  const { migrateSchreiben } = await loadMigration();
  const titles = ["Emilia", "Jakob", "Annika", "Iris"];
  const current = { levels: { b1: { tasks: titles.map((title) => ({ title, content: "alt" })) } } };
  const additions = ["Tobias", "Naco", "Alicia", "Cora und Alex", "Miroslav", "Corinna", "Moritz", "Clara"];
  const windowsData = {
    levels: {
      b1: {
        tasks: [...titles, ...additions].map((title) => ({ title, content: "Windows" }))
      }
    }
  };

  const first = migrateSchreiben(current, windowsData);
  assert.deepEqual(first.added, additions);
  assert.deepEqual(first.updated, titles);
  assert.equal(current.levels.b1.tasks.length, 12);
  assert.ok(current.levels.b1.tasks.every((task) => task.content === "Windows"));
  assert.equal(migrateSchreiben(current, windowsData).added.length, 0);
});
