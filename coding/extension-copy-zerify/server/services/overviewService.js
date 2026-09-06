const { readJsonByKey, listDatabaseFiles } = require("../repositories/jsonRepository");

const LESEN_PART_KEYS = [
  "teil-1",
  "teil-2",
  "teil-3",
  "sprachbausteine-1",
  "sprachbausteine-2"
];

function toPercent(value, total) {
  return total ? Number(((value / total) * 100).toFixed(1)) : 0;
}

function translatableItems(content) {
  return [
    ...(content?.texts || []),
    ...(content?.headlines || []),
    ...(content?.situations || []),
    ...(content?.ads || []),
    ...(content?.questions || []),
    ...(content?.options || [])
  ];
}

function analyzeLesen(lesenDb) {
  const byLevel = {};
  const total = {
    themes: 0,
    versions: 0,
    expectedParts: 0,
    parts: 0,
    missingParts: 0,
    answers: 0,
    translatableItems: 0,
    translatedItems: 0,
    explanations: 0,
    highlights: 0
  };

  Object.entries(lesenDb?.levels || {}).forEach(([levelKey, levelEntry]) => {
    const level = {
      themes: Object.keys(levelEntry?.themes || {}).length,
      versions: 0,
      expectedParts: 0,
      parts: 0,
      missingParts: 0,
      answers: 0,
      translatableItems: 0,
      translatedItems: 0,
      explanations: 0,
      highlights: 0,
      missingByPart: Object.fromEntries(LESEN_PART_KEYS.map((partKey) => [partKey, 0]))
    };

    Object.values(levelEntry?.themes || {}).forEach((theme) => {
      Object.values(theme?.versions || {}).forEach((version) => {
        level.versions += 1;
        level.expectedParts += LESEN_PART_KEYS.length;

        LESEN_PART_KEYS.forEach((partKey) => {
          const part = version?.lesen?.parts?.[partKey];
          if (!part) {
            level.missingParts += 1;
            level.missingByPart[partKey] += 1;
            return;
          }

          level.parts += 1;
          const content = part.content || {};
          const answers = content.answers || content.questions || [];
          const translationItems = translatableItems(content);
          level.answers += answers.length;
          level.translatableItems += translationItems.length;
          level.translatedItems += translationItems.filter((item) => String(item?.translated || "").trim()).length;
          level.explanations += answers.filter((answer) => String(answer?.reason || "").trim()).length;
          level.highlights += answers.reduce((sum, answer) => sum + (answer?.highlights || []).length, 0);
        });
      });
    });

    byLevel[levelKey] = {
      ...level,
      partCoveragePercent: toPercent(level.parts, level.expectedParts),
      translationCoveragePercent: toPercent(level.translatedItems, level.translatableItems)
    };

    Object.keys(total).forEach((key) => {
      total[key] += level[key] || 0;
    });
  });

  return {
    ...total,
    partCoveragePercent: toPercent(total.parts, total.expectedParts),
    translationCoveragePercent: toPercent(total.translatedItems, total.translatableItems),
    explanationCoveragePercent: toPercent(total.explanations, total.answers),
    byLevel
  };
}

function analyzeHoren(horenDb) {
  const byLevel = {};
  const total = {
    themes: 0,
    topics: 0,
    statements: 0,
    trueStatements: 0,
    falseStatements: 0,
    comments: 0,
    missingIds: 0,
    duplicateIds: 0
  };

  Object.entries(horenDb?.levels || {}).forEach(([levelKey, levelEntry]) => {
    const level = {
      themes: Object.keys(levelEntry?.themes || {}).length,
      topics: 0,
      statements: 0,
      trueStatements: 0,
      falseStatements: 0,
      comments: 0,
      missingIds: 0,
      duplicateIds: 0,
      byPart: {}
    };
    const ids = new Set();

    Object.values(levelEntry?.themes || {}).forEach((theme) => {
      Object.entries(theme?.["hören"]?.parts || {}).forEach(([partKey, part]) => {
        const topics = part?.content?.topics || [];
        const partSummary = { topics: topics.length, statements: 0 };

        topics.forEach((topic) => {
          level.topics += 1;
          if (String(topic?.comment || "").trim()) level.comments += 1;
          if (!topic?.id) level.missingIds += 1;
          else if (ids.has(topic.id)) level.duplicateIds += 1;
          else ids.add(topic.id);

          (topic?.statements || []).forEach((statement) => {
            level.statements += 1;
            partSummary.statements += 1;
            if (statement?.correct === true) level.trueStatements += 1;
            if (statement?.correct === false) level.falseStatements += 1;
            if (!statement?.id) level.missingIds += 1;
            else if (ids.has(statement.id)) level.duplicateIds += 1;
            else ids.add(statement.id);
          });
        });

        level.byPart[partKey] = partSummary;
      });
    });

    byLevel[levelKey] = level;
    Object.keys(total).forEach((key) => {
      total[key] += level[key] || 0;
    });
  });

  return { ...total, byLevel };
}

function analyzeShreiben(shreibenDb) {
  const byLevel = {};
  const total = { tasks: 0, completeTasks: 0, duplicateTitles: 0 };

  Object.entries(shreibenDb?.levels || {}).forEach(([levelKey, levelEntry]) => {
    const tasks = Array.isArray(levelEntry?.tasks)
      ? levelEntry.tasks
      : Object.values(levelEntry?.parts || {}).flatMap((part) => part?.content?.tasks || []);
    const seenTitles = new Set();
    let duplicateTitles = 0;
    const completeTasks = tasks.filter((task) => {
      const titleKey = String(task?.title || "").trim().toLocaleLowerCase("de");
      if (titleKey && seenTitles.has(titleKey)) duplicateTitles += 1;
      if (titleKey) seenTitles.add(titleKey);
      return Boolean(
        String(task?.title || "").trim()
        && String(task?.istructions || "").trim()
        && String(task?.content || "").trim()
        && String(task?.tasks || "").trim()
      );
    }).length;

    byLevel[levelKey] = {
      tasks: tasks.length,
      completeTasks,
      duplicateTitles,
      completenessPercent: toPercent(completeTasks, tasks.length)
    };
    total.tasks += tasks.length;
    total.completeTasks += completeTasks;
    total.duplicateTitles += duplicateTitles;
  });

  return {
    ...total,
    completenessPercent: toPercent(total.completeTasks, total.tasks),
    byLevel
  };
}

function analyzeSprechen(sprechenDb) {
  const byLevel = {};
  const total = { parts: 0, topics: 0, prompts: 0, followUps: 0 };

  Object.entries(sprechenDb?.levels || {}).forEach(([levelKey, levelEntry]) => {
    const level = { parts: 0, topics: 0, prompts: 0, followUps: 0 };
    Object.values(levelEntry?.parts || {}).forEach((part) => {
      level.parts += 1;
      level.topics += Array.isArray(part?.topics) ? part.topics.length : 0;
      level.prompts += Array.isArray(part?.prompts) ? part.prompts.length : 0;
      level.followUps += Array.isArray(part?.followUps) ? part.followUps.length : 0;
    });
    byLevel[levelKey] = level;
    Object.keys(total).forEach((key) => {
      total[key] += level[key];
    });
  });

  return { ...total, byLevel };
}

function countLesenThemes(lesenDb) {
  const levels = lesenDb?.levels || {};
  const byLevel = {};
  let total = 0;

  Object.entries(levels).forEach(([levelKey, levelEntry]) => {
    const count = Object.keys(levelEntry?.themes || {}).length;
    byLevel[levelKey] = count;
    total += count;
  });

  return { total, byLevel };
}

function countHorenTopics(horenDb) {
  const levels = horenDb?.levels || {};
  const byLevel = {};
  let total = 0;

  Object.entries(levels).forEach(([levelKey, levelEntry]) => {
    const firstThemeKey = levelEntry?.themeOrder?.[0];
    const theme = levelEntry?.themes?.[firstThemeKey] || null;
    const parts = theme?.hören?.parts || {};
    const partSummary = {};
    let levelTotal = 0;

    Object.entries(parts).forEach(([partKey, partEntry]) => {
      const topicCount = (partEntry?.content?.topics || []).length;
      partSummary[partKey] = topicCount;
      levelTotal += topicCount;
      total += topicCount;
    });

    byLevel[levelKey] = {
      total: levelTotal,
      parts: partSummary
    };
  });

  return { total, byLevel };
}

function countShreibenTasks(shreibenDb) {
  const levels = shreibenDb?.levels || {};
  const byLevel = {};
  let total = 0;

  Object.entries(levels).forEach(([levelKey, levelEntry]) => {
    if (Array.isArray(levelEntry?.tasks)) {
      const levelTotal = levelEntry.tasks.length;
      total += levelTotal;
      byLevel[levelKey] = { total: levelTotal };
      return;
    }

    const parts = levelEntry?.parts || {};
    const levelTotal = Object.values(parts).reduce((sum, partEntry) => {
      return sum + ((partEntry?.content?.tasks || []).length);
    }, 0);
    total += levelTotal;
    byLevel[levelKey] = { total: levelTotal };
  });

  return { total, byLevel };
}

async function getOverview() {
  const [files, config, lesen, horen, shreiben, sprechen] = await Promise.all([
    listDatabaseFiles(),
    readJsonByKey("config"),
    readJsonByKey("lesen"),
    readJsonByKey("horen"),
    readJsonByKey("shreiben"),
    readJsonByKey("sprechen")
  ]);

  const analytics = {
    lesen: analyzeLesen(lesen),
    horen: analyzeHoren(horen),
    shreiben: analyzeShreiben(shreiben),
    sprechen: analyzeSprechen(sprechen)
  };

  return {
    generatedAt: new Date().toISOString(),
    files,
    counts: {
      modules: (config?.modules || []).length,
      lesenThemes: countLesenThemes(lesen),
      horenTopics: countHorenTopics(horen),
      shreibenTasks: countShreibenTasks(shreiben),
      sprechenItems: analytics.sprechen
    },
    analytics
  };
}

module.exports = {
  getOverview,
  analyzeLesen,
  analyzeHoren,
  analyzeShreiben,
  analyzeSprechen
};
