import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const siteDir = path.join(projectRoot, "site");
const windowsRef = process.env.WINDOWS_DATA_REF || "windows/main";

const databaseFiles = Object.freeze({
  lesen: "database/lesen.json",
  horen: "database/horen-codes.json",
  schreiben: "database/shreiben.json"
});

const newSchreibenTitles = new Set([
  "Tobias",
  "Naco",
  "Alicia",
  "Cora und Alex",
  "Miroslav",
  "Corinna",
  "Moritz",
  "Clara"
]);
const updatedSchreibenTitles = new Set(["Emilia", "Jakob", "Annika", "Iris"]);

function clone(value) {
  return structuredClone(value);
}

function orderedKeys(record, configuredOrder) {
  const keys = Object.keys(record || {});
  const configured = Array.isArray(configuredOrder) ? configuredOrder : [];
  return [
    ...configured.filter((key, index) => keys.includes(key) && configured.indexOf(key) === index),
    ...keys.filter((key) => !configured.includes(key))
  ];
}

function contentCounts(level) {
  let versions = 0;
  let parts = 0;
  Object.values(level?.themes || {}).forEach((theme) => {
    const themeVersions = Object.values(theme?.versions || {});
    versions += themeVersions.length;
    parts += themeVersions.reduce(
      (count, version) => count + Object.keys(version?.lesen?.parts || {}).length,
      0
    );
  });
  level.counts = {
    themes: Object.keys(level?.themes || {}).length,
    versions,
    parts
  };
  return clone(level.counts);
}

export function migrateHoren(current, windowsData) {
  const added = [];
  for (const levelKey of Object.keys(windowsData?.levels || {})) {
    const currentLevel = current?.levels?.[levelKey];
    const windowsLevel = windowsData.levels[levelKey];
    if (!currentLevel || !windowsLevel) continue;
    for (const [themeKey, windowsTheme] of Object.entries(windowsLevel.themes || {})) {
      const currentTheme = currentLevel.themes?.[themeKey];
      if (!currentTheme) continue;
      for (const [sectionKey, windowsSection] of Object.entries(windowsTheme || {})) {
        const currentSection = currentTheme[sectionKey];
        if (!currentSection) continue;
        for (const [partKey, windowsPart] of Object.entries(windowsSection.parts || {})) {
          const currentTopics = currentSection.parts?.[partKey]?.content?.topics;
          const windowsTopics = windowsPart?.content?.topics;
          if (!Array.isArray(currentTopics) || !Array.isArray(windowsTopics)) continue;
          const knownIds = new Set(currentTopics.map((topic) => String(topic.id)));
          windowsTopics.forEach((topic) => {
            const id = String(topic.id);
            if (knownIds.has(id)) return;
            currentTopics.push(clone(topic));
            knownIds.add(id);
            added.push(`${levelKey}/${partKey}/${id}`);
          });
        }
      }
    }
  }
  return { added };
}

export function migrateSchreiben(current, windowsData) {
  const currentTasks = current?.levels?.b1?.tasks;
  const windowsTasks = windowsData?.levels?.b1?.tasks;
  if (!Array.isArray(currentTasks) || !Array.isArray(windowsTasks)) {
    throw new Error("B1 Schreiben tasks are missing");
  }

  const windowsByTitle = new Map(windowsTasks.map((task) => [task.title, task]));
  const currentByTitle = new Map(currentTasks.map((task, index) => [task.title, index]));
  const updated = [];
  const added = [];

  updatedSchreibenTitles.forEach((title) => {
    const source = windowsByTitle.get(title);
    const index = currentByTitle.get(title);
    if (!source || index === undefined) {
      throw new Error(`Cannot update Schreiben task ${title}`);
    }
    currentTasks[index] = clone(source);
    updated.push(title);
  });

  windowsTasks.forEach((task) => {
    if (!newSchreibenTitles.has(task.title) || currentByTitle.has(task.title)) return;
    currentTasks.push(clone(task));
    currentByTitle.set(task.title, currentTasks.length - 1);
    added.push(task.title);
  });

  const missing = [...newSchreibenTitles].filter((title) => !currentByTitle.has(title));
  if (missing.length) throw new Error(`Missing Windows Schreiben tasks: ${missing.join(", ")}`);
  return { added, updated };
}

export function migrateLesen(current, windowsData) {
  const currentLevel = current?.levels?.b1;
  const sourceTheme = windowsData?.levels?.b1?.themes?.["Miroslav 2"];
  const targetTheme = currentLevel?.themes?.miroslav;
  if (!currentLevel || !sourceTheme || !targetTheme) {
    throw new Error("Miroslav source or target theme is missing");
  }

  const sourceVersionKeys = orderedKeys(sourceTheme.versions, sourceTheme.versionOrder);
  if (sourceVersionKeys.length !== 1) {
    throw new Error("Miroslav 2 must contain exactly one source version");
  }

  let added = false;
  if (!targetTheme.versions["version-2"]) {
    const version = clone(sourceTheme.versions[sourceVersionKeys[0]]);
    version.key = "version-2";
    version.label = "Version 2";
    version.title = sourceTheme.title || "Miroslav 2";
    targetTheme.versions["version-2"] = version;
    targetTheme.versionOrder = orderedKeys(targetTheme.versions, [
      ...(targetTheme.versionOrder || []),
      "version-2"
    ]);
    added = true;
  }

  currentLevel.themeAliases = currentLevel.themeAliases && typeof currentLevel.themeAliases === "object"
    ? currentLevel.themeAliases
    : {};
  currentLevel.themeAliases["Miroslav 2"] = { themeKey: "miroslav", versionKey: "version-2" };
  targetTheme.counts = {
    parts: Object.values(targetTheme.versions).reduce(
      (count, version) => count + Object.keys(version?.lesen?.parts || {}).length,
      0
    ),
    versions: Object.keys(targetTheme.versions).length
  };
  const counts = contentCounts(currentLevel);
  return { added, alias: "Miroslav 2", counts };
}

function readWindowsJson(relativePath) {
  const json = execFileSync("git", ["show", `${windowsRef}:${relativePath}`], {
    cwd: siteDir,
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024
  });
  return JSON.parse(json);
}

async function main() {
  const current = {};
  const windowsData = {};
  for (const [key, relativePath] of Object.entries(databaseFiles)) {
    current[key] = JSON.parse(await fs.readFile(path.join(siteDir, relativePath), "utf8"));
    windowsData[key] = readWindowsJson(relativePath);
  }

  const report = {
    windowsRef,
    horen: migrateHoren(current.horen, windowsData.horen),
    schreiben: migrateSchreiben(current.schreiben, windowsData.schreiben),
    lesen: migrateLesen(current.lesen, windowsData.lesen)
  };

  if (process.argv.includes("--write")) {
    current.lesen.generatedAt = new Date().toISOString();
    for (const [key, relativePath] of Object.entries(databaseFiles)) {
      await fs.writeFile(path.join(siteDir, relativePath), `${JSON.stringify(current[key], null, 2)}\n`, "utf8");
    }
  }
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
