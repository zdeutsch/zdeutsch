const { readJsonByKey, listDatabaseFiles } = require("../repositories/jsonRepository");

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
    const parts = levelEntry?.parts || {};
    const partSummary = {};
    let levelTotal = 0;

    Object.entries(parts).forEach(([partKey, partEntry]) => {
      const taskCount = (partEntry?.content?.tasks || []).length;
      partSummary[partKey] = taskCount;
      levelTotal += taskCount;
      total += taskCount;
    });

    byLevel[levelKey] = {
      total: levelTotal,
      parts: partSummary
    };
  });

  return { total, byLevel };
}

async function getOverview() {
  const [files, config, lesen, horen, shreiben] = await Promise.all([
    listDatabaseFiles(),
    readJsonByKey("config"),
    readJsonByKey("lesen"),
    readJsonByKey("horen"),
    readJsonByKey("shreiben")
  ]);

  return {
    generatedAt: new Date().toISOString(),
    files,
    counts: {
      modules: (config?.modules || []).length,
      lesenThemes: countLesenThemes(lesen),
      horenTopics: countHorenTopics(horen),
      shreibenTasks: countShreibenTasks(shreiben)
    }
  };
}

module.exports = {
  getOverview
};
