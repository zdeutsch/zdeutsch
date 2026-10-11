(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZDeutschExercises = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const FILES = ["lesen.json", "horen-codes.json", "horen-audio.json", "shreiben.json", "mundlich.json"];
  const LABELS = { "teil-1": "Lesen Teil 1", "teil-2": "Lesen Teil 2", "teil-3": "Lesen Teil 3", "sprachbausteine-1": "Sprachbausteine Teil 1", "sprachbausteine-2": "Sprachbausteine Teil 2" };
  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ß/g, "ss").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  }
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  }
  // A change detector, not a security hash. Target identity is always checked separately.
  function fingerprint(value) {
    const text = JSON.stringify(canonical(value));
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16).padStart(8, "0");
  }
  function targetId(target) {
    return "base:" + [target.file, target.level, target.kind, target.themeKey, target.versionKey, target.partKey, target.topicId, target.index].filter(value => value !== undefined && value !== null && value !== "").map(encodeURIComponent).join(":");
  }
  function resolveTarget(databases, target) {
    if (!target || !FILES.includes(target.file) || target.level !== "b2") return null;
    if ([target.themeKey, target.versionKey, target.partKey, target.topicId].some(key => ["__proto__", "constructor", "prototype"].includes(key))) return null;
    const level = databases[target.file]?.levels?.[target.level];
    if (!level) return null;
    let record, contextTitle = "", versionLabel = "";
    if (target.file === "lesen.json") {
      const theme = level.themes?.[target.themeKey];
      if (!theme) return null;
      contextTitle = theme.title || target.themeKey;
      if (target.kind === "theme") record = theme;
      else if (target.kind === "part") {
        const version = theme.versions?.[target.versionKey];
        versionLabel = version?.label || target.versionKey;
        record = version?.lesen?.parts?.[target.partKey]?.content;
      }
    } else if (target.file.startsWith("horen-")) {
      const theme = level.themes?.[target.themeKey];
      contextTitle = theme?.title || target.themeKey;
      if (target.kind === "topic") record = theme?.["hören"]?.parts?.[target.partKey]?.content?.topics?.find(topic => topic.id === target.topicId);
    } else if (target.file === "shreiben.json" && target.kind === "task" && Number.isInteger(target.index) && target.index >= 0) {
      record = level.tasks?.[target.index];
      contextTitle = record?.title || "Schreiben";
    } else if (target.file === "mundlich.json" && target.kind === "speaking" && Number.isInteger(target.index) && target.index >= 0) {
      record = level.parts?.[target.partKey]?.topics?.[target.index];
      contextTitle = record?.title || "Sprechen";
    }
    return record ? { record, contextTitle, versionLabel } : null;
  }
  function identityContent(target, record) {
    const texts = values => (values || []).map(value => typeof value === "string" ? value : value.text || value.prompt || "");
    if (target.kind === "theme") return { title: record.title, versions: Object.keys(record.versions || {}) };
    if (target.file === "lesen.json") {
      if (target.partKey === "teil-1") return { texts: texts(record.texts), headlines: texts(record.headlines) };
      if (target.partKey === "teil-2") return { passage: record.passage?.text || texts(record.passage?.paragraphs), questions: (record.questions || []).map(q => ({ prompt: q.prompt, options: texts(q.options) })) };
      if (target.partKey === "teil-3") return { ads: texts(record.ads), situations: texts(record.situations) };
      return { text: record.text, blanks: (record.blanks || []).map(b => ({ id: b.id, options: b.options })), options: texts(record.wordBank || record.options) };
    }
    if (target.file.startsWith("horen-")) return { statements: texts(record.statements) };
    if (target.file === "shreiben.json") return { instructions: record.istructions || record.instructions, content: record.content, tasks: record.tasks };
    return { text: record.text || record.prompt };
  }
  function partLabel(item) {
    if (item.module === "horen" || item.file?.startsWith("horen-")) return "Hören " + String(item.partKey).replace("teil-", "Teil ");
    if (item.module === "shreiben" || item.file === "shreiben.json") return "Schreiben";
    if (item.file === "mundlich.json") return "Sprechen " + String(item.partKey).replace("teil-", "Teil ");
    return LABELS[item.partKey] || "Thema";
  }
  function section(target) {
    return target.file === "lesen.json" ? "lesen" : target.file?.startsWith("horen-") ? "horen" : target.file === "shreiben.json" ? "shreiben" : "mundlich";
  }
  function hasAnswerKey(item) {
    const payload = item?.payload;
    if (item?.module === "horen") return Array.isArray(payload?.statements) && payload.statements.length > 0 && payload.statements.every(statement => typeof statement.correct === "boolean");
    if (item?.module !== "lesen" || !Array.isArray(payload?.blanks) || !payload.blanks.length || !Array.isArray(payload?.answers)) return false;
    const answers = new Map(payload.answers.map(answer => [String(answer.id), answer.answer]));
    if (answers.size !== payload.answers.length || new Set(payload.blanks.map(blank => String(blank.id))).size !== payload.blanks.length) return false;
    return payload.blanks.every(blank => {
      const answer = answers.get(String(blank.id));
      return typeof answer === "string" && Boolean(answer.trim()) && Array.isArray(blank.options) && blank.options.includes(answer);
    });
  }
  function mergedExercise(entry) {
    const record = entry?.record, origin = record?.legacyImport;
    if (!origin) return null;
    let payload;
    if (entry.module === "horen") payload = { instruction: record.instruction || "Entscheiden Sie bei jeder Aussage: richtig oder falsch.", statements: record.statements };
    else if (entry.module === "shreiben") payload = { istructions: record.istructions, content: record.content, tasks: record.tasks, minimumWords: record.minimumWords || 150 };
    else payload = { instruction: record.instruction, text: record.text, blanks: record.blanks, answers: record.answers };
    return { ...origin, title: record.title, level: "b2", module: entry.module, partKey: entry.target.partKey || "teil-1", payload, ...(record.audio ? { audio: record.audio } : {}), target: entry.target, contextTitle: entry.contextTitle, versionLabel: entry.versionLabel };
  }
  function applyMergedExercise(record, item) {
    const { payload, title, audio, target, contextTitle, versionLabel, level, module, partKey, ...origin } = item;
    Object.assign(record, payload, { title, legacyImport: origin });
    if (audio) record.audio = audio; else delete record.audio;
    // The normal grammar editor also understands the derived text segments.
    if (module === "lesen") {
      const answers = new Map(payload.answers.map(answer => [String(answer.id), answer.answer]));
      record.segments = [];
      let cursor = 0;
      for (const match of payload.text.matchAll(/\[\[\s*(\d+)\s*\]\]/g)) {
        if (match.index > cursor) record.segments.push({ type: "text", value: payload.text.slice(cursor, match.index) });
        record.segments.push({ type: "luecke", id: Number(match[1]), answer: answers.get(match[1]) });
        cursor = match.index + match[0].length;
      }
      if (cursor < payload.text.length) record.segments.push({ type: "text", value: payload.text.slice(cursor) });
    }
    return record;
  }
  function mergedExercises(databases, options) {
    return baseEntries(databases, options).map(mergedExercise).filter(Boolean);
  }
  async function loadMergedExercises() {
    const databases = Object.fromEntries(await Promise.all(FILES.map(async file => {
      const response = typeof globalThis.fetchFreshJson === "function" ? await globalThis.fetchFreshJson(`database/${file}`) : await fetch(`database/${file}`, { cache: "no-cache" }).then(response => { if (!response.ok) throw new Error(`${file}: ${response.status}`); return response.json(); });
      return [file, response];
    })));
    return mergedExercises(databases);
  }
  function targetUrl(target) {
    const query = new URLSearchParams({ level: target.level });
    let page;
    if (target.file === "lesen.json") {
      page = "lesen.html"; query.set("theme", target.themeKey);
      if (target.versionKey) query.set("version", target.versionKey);
      if (target.partKey) query.set("part", target.partKey);
    } else if (target.file?.startsWith("horen-")) {
      page = "horen.html"; query.set("source", target.file === "horen-audio.json" ? "audio" : "codes");
      query.set("theme", target.themeKey); query.set("part", target.partKey); query.set("topic", target.topicId);
    } else if (target.file === "shreiben.json") {
      page = "shreiben.html"; query.set("task", `task-${target.index + 1}`);
    } else {
      page = "mundlich.html"; query.set("part", target.partKey); query.set("topicIndex", String(target.index));
    }
    return `${page}?${query}`;
  }
  function bindNames(databases, index) {
    return (Array.isArray(index?.entries) ? index.entries : []).flatMap(entry => {
      if (!entry || !Array.isArray(entry.names) || !entry.target) return [];
      const resolved = resolveTarget(databases, entry.target);
      if (!resolved || fingerprint(identityContent(entry.target, resolved.record)) !== entry.contentFingerprint) return [];
      return [{ ...entry, ...resolved, module: section(entry.target), label: partLabel(entry.target), url: targetUrl(entry.target) }];
    });
  }
  function baseEntries(databases, { includeHidden = false } = {}) {
    const entries = [];
    const push = target => {
      const resolved = resolveTarget(databases, target); if (!resolved) return;
      const record = resolved.record;
      if (!includeHidden && record.legacyImport?.enabled === false) return;
      const candidate = target.file === "lesen.json" ? (target.kind === "theme" ? resolved.contextTitle : target.partKey === "teil-2" ? record.passage?.title : record.title) : record.title;
      const title = candidate && !["Aufgaben", "Aufgabe"].includes(candidate) ? candidate : partLabel(target);
      const importedNames = (record.legacyImport?.names || []).map(label => ({ label, source: "telc.site", scope: "exercise" }));
      entries.push({ id: targetId(target), target, subtitle: title, names: [...importedNames, ...(!importedNames.some(name => name.label === title) ? [{ label: title, source: "zdeutsch", scope: target.kind === "theme" ? "theme" : "exercise" }] : [])], contentFingerprint: fingerprint(identityContent(target, record)), ...resolved, module: section(target), label: partLabel(target), url: targetUrl(target) });
    };
    const reading = databases["lesen.json"]?.levels?.b2;
    for (const [themeKey, theme] of Object.entries(reading?.themes || {})) {
      if (!includeHidden && Array.isArray(reading.themeOrder) && !reading.themeOrder.includes(themeKey)) continue;
      push({ file: "lesen.json", level: "b2", kind: "theme", themeKey });
      for (const [versionKey, version] of Object.entries(theme.versions || {})) for (const partKey of Object.keys(version.lesen?.parts || {})) {
        if (!includeHidden && Array.isArray(version.lesen.partOrder) && !version.lesen.partOrder.includes(partKey)) continue;
        push({ file: "lesen.json", level: "b2", kind: "part", themeKey, versionKey, partKey });
      }
    }
    for (const file of ["horen-codes.json", "horen-audio.json"]) {
      const level = databases[file]?.levels?.b2;
      for (const [themeKey, theme] of Object.entries(level?.themes || {})) {
        if (!includeHidden && Array.isArray(level.themeOrder) && !level.themeOrder.includes(themeKey)) continue;
        for (const [partKey, part] of Object.entries(theme["hören"]?.parts || {})) {
          if (!includeHidden && Array.isArray(theme["hören"].partOrder) && !theme["hören"].partOrder.includes(partKey)) continue;
          for (const topic of part.content?.topics || []) push({ file, level: "b2", kind: "topic", themeKey, partKey, topicId: topic.id });
        }
      }
    }
    (databases["shreiben.json"]?.levels?.b2?.tasks || []).forEach((_, index) => push({ file: "shreiben.json", level: "b2", kind: "task", index }));
    const oral = databases["mundlich.json"]?.levels?.b2;
    for (const partKey of ["teil-2", "teil-3"]) {
      if (!includeHidden && Array.isArray(oral?.partOrder) && !oral.partOrder.includes(partKey)) continue;
      (oral?.parts?.[partKey]?.topics || []).forEach((_, index) => push({ file: "mundlich.json", level: "b2", kind: "speaking", partKey, index }));
    }
    return entries;
  }
  function combinedNames(databases, index) {
    const bound = new Map(bindNames(databases, index).map(entry => [entry.id, entry]));
    return baseEntries(databases).map(base => {
      const extra = bound.get(base.id); if (!extra) return base;
      return { ...base, ...extra, names: [...extra.names, ...base.names.filter(name => !extra.names.some(other => other.label === name.label))] };
    });
  }
  function matches(query, values) {
    const words = normalize(query).split(" ").filter(Boolean);
    const tokens = normalize(values.filter(Boolean).join(" ")).split(" ");
    return words.every(word => tokens.some(token => token.startsWith(word)));
  }
  function searchNames(bound, { query = "", level = "b2", module } = {}) {
    if (!normalize(query)) return [];
    return bound.filter(entry => entry.target.level === level && (!module || entry.module === module) && matches(query, [entry.subtitle, entry.contextTitle, entry.versionLabel, entry.label, ...entry.names.map(n => n.label)]));
  }
  function searchAdditions(document, { query = "", level = "b2", module } = {}) {
    return (Array.isArray(document?.exercises) ? document.exercises : []).filter(item => item && item.enabled !== false && item.level === level && (!module || item.module === module) && matches(query, [item.title, partLabel(item), ...(Array.isArray(item.names) ? item.names : [])]));
  }
  let pending;
  async function load() {
    if (!pending) pending = (async () => {
      const get = async name => {
        const url = `database/${name}`;
        let data;
        if (typeof globalThis.fetchFreshJson === "function") data = await globalThis.fetchFreshJson(url);
        else {
          const response = await fetch(url, { cache: "no-cache" });
          if (!response.ok) throw new Error(`${name}: ${response.status}`);
          data = await response.json();
        }
        if (data?.schemaVersion !== 1 || !Array.isArray(name.startsWith("exercise-additions") ? data.exercises : data.entries)) throw new Error(`Invalid catalogue: ${name}`);
        return data;
      };
      const results = await Promise.allSettled([get("exercise-additions.b2.json"), get("exercise-names.b2.json")]);
      const errors = results.flatMap(result => result.status === "rejected" ? [String(result.reason)] : []);
      if (errors.length) console.warn("Additional exercise catalogue unavailable", ...errors);
      return { additions: results[0].status === "fulfilled" ? results[0].value : { exercises: [] }, names: results[1].status === "fulfilled" ? results[1].value : { entries: [] }, errors };
    })();
    return pending;
  }
  return Object.freeze({ FILES, LABELS, normalize, fingerprint, targetId, resolveTarget, identityContent, partLabel, section, targetUrl, bindNames, baseEntries, combinedNames, searchNames, searchAdditions, load, mergedExercise, mergedExercises, applyMergedExercise, loadMergedExercises, hasAnswerKey });
});
