(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./exercise-catalog") : root.ZDeutschExercises);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZDeutschLesenImports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (catalog) {
  "use strict";
  function storageKey(content) {
    return content?.legacyImport?.id ? `zdeutsch.exercise-additions.v1:${content.legacyImport.id}` : null;
  }
  function readSaved(content, storage) {
    const key = storageKey(content);
    if (!key) return {};
    try {
      const saved = JSON.parse(storage.getItem(key) || "null");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch (_) { return {}; }
  }
  function readResponses(content, storage) {
    const responses = readSaved(content, storage).responses;
    return responses && typeof responses === "object" && !Array.isArray(responses) ? responses : {};
  }
  function saveResponses(content, responses, storage) {
    const key = storageKey(content);
    if (!key) return true;
    try {
      storage.setItem(key, JSON.stringify({ ...readSaved(content, storage), responses }));
      return true;
    } catch (_) { return false; }
  }
  function canScore(content) {
    // Native corrections are authoritative. Imported keys fill exercises absent from the original database.
    if (content?.sourceImport?.review?.contentStatus === "incomplete") return false;
    return !(content?.legacyImport || content?.sourceImport) || catalog.hasAnswerKey({ module: "lesen", payload: content });
  }
  return Object.freeze({ storageKey, readResponses, saveResponses, canScore });
});
