function clean(value) {
  return String(value ?? "").trim();
}

export function buildCorrectionCandidates(partKey, content = {}) {
  let entries = [];
  if (partKey === "teil-1") {
    entries = (content.answers || []).map((item) => ({ itemNumber: item.textId, answer: item.headlineId }));
  } else if (partKey === "teil-2") {
    entries = (content.questions || []).map((item) => ({ itemNumber: item.id, answer: item.answerId }));
  } else if (partKey === "teil-3") {
    entries = (content.answers || []).map((item) => ({ itemNumber: item.situationId, answer: item.adId }));
  } else if (partKey === "sprachbausteine-1" || partKey === "sprachbausteine-2") {
    const source = content.answers?.length ? content.answers : (content.blanks || []);
    entries = source.map((item) => ({ itemNumber: item.id, answer: item.answer || item.text }));
  }

  const seen = new Set();
  return entries.map((entry) => ({
    itemNumber: clean(entry.itemNumber),
    answer: clean(entry.answer)
  })).filter((entry) => {
    if (!entry.itemNumber || !entry.answer || seen.has(entry.itemNumber)) return false;
    seen.add(entry.itemNumber);
    return true;
  });
}
