import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const databasePath = path.resolve(scriptDir, "../site/database/lesen.json");

const groups = [
  {
    level: "b2",
    targetThemeKey: "in-den-alpen",
    title: "In den Alpen",
    versions: [
      ["in-den-alpen", "default", "الأساسي"],
      ["in-den-alpen-1", "version-1", "المعدل 1"]
    ]
  },
  {
    level: "b2",
    targetThemeKey: "mobarmijine",
    title: "Mobarmijine",
    versions: [
      ["mobarmijine", "default", "الأساسي"],
      ["mobarmijine-1", "version-1", "المعدل 1"],
      ["mobarmijine-2", "version-2", "المعدل 2"]
    ]
  },
  ...[
    ["licht", "Licht"],
    ["tanzkurs", "Tanzkurs"],
    ["geld", "Geld"],
    ["sport-ist-gesund", "Sport ist gesund"],
    ["schlafzug", "Schlafzug"],
    ["spiele", "Spiele"],
    ["insel", "Insel"],
    ["insekten", "Insekten"]
  ].map(([targetThemeKey, title]) => ({
    level: "b2",
    targetThemeKey,
    title,
    versions: [
      [targetThemeKey, "default", "الأساسي"],
      [`${targetThemeKey}-1`, "version-1", "المعدل 1"]
    ]
  })),
  {
    level: "b2",
    targetThemeKey: "drogen",
    title: "Drogen",
    versions: [
      ["drogen", "default", "Original"],
      ["drogen-1", "version-1", "المعدل 1"]
    ]
  },
  {
    level: "b1",
    targetThemeKey: "andreas",
    title: "Andreas",
    versions: [
      ["andreas-1", "version-1", "Version 1"],
      ["andreas-2", "version-2", "Version 2"]
    ]
  },
  {
    level: "b1",
    targetThemeKey: "annika",
    title: "Annika",
    versions: [
      ["annika-1", "version-1", "Version 1"],
      ["annika-2", "version-2", "Version 2"]
    ]
  }
];

function orderedVersionKeys(theme) {
  const available = Object.keys(theme?.versions || {});
  const configured = Array.isArray(theme?.versionOrder) ? theme.versionOrder : [];
  return [
    ...configured.filter((key, index) => available.includes(key) && configured.indexOf(key) === index),
    ...available.filter((key) => !configured.includes(key))
  ];
}

function countContent(db) {
  let themes = 0;
  let versions = 0;
  let parts = 0;
  Object.values(db.levels || {}).forEach((level) => {
    Object.values(level.themes || {}).forEach((theme) => {
      themes += 1;
      Object.values(theme.versions || {}).forEach((version) => {
        versions += 1;
        parts += Object.keys(version?.lesen?.parts || {}).length;
      });
    });
  });
  return { themes, versions, parts };
}

function groupTheme(levelEntry, group) {
  const sourceKeys = group.versions.map(([sourceThemeKey]) => sourceThemeKey);
  const alreadyGrouped = sourceKeys
    .filter((key) => key !== group.targetThemeKey)
    .every((key) => !levelEntry.themes?.[key])
    && group.versions.every(([, versionKey]) => levelEntry.themes?.[group.targetThemeKey]?.versions?.[versionKey]);
  if (alreadyGrouped) return false;

  const missing = sourceKeys.filter((key) => !levelEntry.themes?.[key]);
  if (missing.length) {
    throw new Error(`Cannot group ${group.targetThemeKey}; missing source themes: ${missing.join(", ")}`);
  }

  const sourceThemes = group.versions.map(([sourceThemeKey]) => levelEntry.themes[sourceThemeKey]);
  const groupedTheme = structuredClone(sourceThemes[0]);
  const versions = {};
  group.versions.forEach(([sourceThemeKey, targetVersionKey, label]) => {
    const sourceTheme = levelEntry.themes[sourceThemeKey];
    const sourceVersionKeys = orderedVersionKeys(sourceTheme);
    if (sourceVersionKeys.length !== 1) {
      throw new Error(`${sourceThemeKey} must contain exactly one version before grouping`);
    }
    const version = structuredClone(sourceTheme.versions[sourceVersionKeys[0]]);
    version.key = targetVersionKey;
    version.label = label;
    version.title = version.title || sourceTheme.title || group.title;
    versions[targetVersionKey] = version;
  });

  groupedTheme.id = group.targetThemeKey;
  groupedTheme.title = group.title;
  groupedTheme.versions = versions;
  groupedTheme.versionOrder = group.versions.map(([, versionKey]) => versionKey);
  groupedTheme.defaultVersion = groupedTheme.versionOrder[0];

  const oldOrder = Array.isArray(levelEntry.themeOrder) ? levelEntry.themeOrder : Object.keys(levelEntry.themes);
  const visibleIndexes = sourceKeys.map((key) => oldOrder.indexOf(key)).filter((index) => index >= 0);
  const insertionIndex = visibleIndexes.length ? Math.min(...visibleIndexes) : -1;
  const nextOrder = oldOrder.filter((key) => !sourceKeys.includes(key) && key !== group.targetThemeKey);
  if (insertionIndex >= 0) nextOrder.splice(Math.min(insertionIndex, nextOrder.length), 0, group.targetThemeKey);

  sourceKeys.forEach((key) => delete levelEntry.themes[key]);
  levelEntry.themes[group.targetThemeKey] = groupedTheme;
  levelEntry.themeOrder = nextOrder;
  levelEntry.themeAliases = levelEntry.themeAliases && typeof levelEntry.themeAliases === "object"
    ? levelEntry.themeAliases
    : {};
  group.versions.forEach(([sourceThemeKey, targetVersionKey]) => {
    if (sourceThemeKey !== group.targetThemeKey) {
      levelEntry.themeAliases[sourceThemeKey] = {
        themeKey: group.targetThemeKey,
        versionKey: targetVersionKey
      };
    }
  });
  return true;
}

const db = JSON.parse(await fs.readFile(databasePath, "utf8"));
const before = countContent(db);
const changed = [];

groups.forEach((group) => {
  const levelEntry = db.levels?.[group.level];
  if (!levelEntry) throw new Error(`Missing level ${group.level}`);
  if (groupTheme(levelEntry, group)) changed.push(`${group.level}/${group.targetThemeKey}`);
});

const after = countContent(db);
if (before.versions !== after.versions || before.parts !== after.parts) {
  throw new Error(`Content count changed unexpectedly: ${JSON.stringify({ before, after })}`);
}

console.log(JSON.stringify({ databasePath, changed, before, after }, null, 2));
if (process.argv.includes("--write") && changed.length) {
  db.generatedAt = new Date().toISOString();
  await fs.writeFile(databasePath, `${JSON.stringify(db, null, 2)}\n`, "utf8");
}
