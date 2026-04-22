const fs = require("fs/promises");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const { SHARE_DATA_DIR } = require("../config/constants");
const { readJsonByKey, writeJsonByKey } = require("../repositories/jsonRepository");
const { assertString, isPlainObject } = require("../utils/validators");
const AppError = require("../utils/appError");
const {
  sendAcceptedContributionEmail,
  sendRejectedContributionEmail
} = require("./mailService");

const COMMUNITY_SHEET_ID_DEFAULT = process.env.COMMUNITY_SHEET_ID || "14LMJKrPsc1JQErmCfHv5K4xoN4miykVeTjmN1ZNFs_I";
const CONTRIBUTION_REVIEW_FILE = path.join(SHARE_DATA_DIR, "contribution-reviews.json");
const UNKNOWN_THEME_KEY = "__unknown_theme__";
const UNKNOWN_THEME_TITLE = "Unknown theme";

const PART_CONFIG = Object.freeze({
  "teil-1": {
    gid: 1925401969,
    partLabel: "Lesen Teil 1",
    itemNumbers: ["1", "2", "3", "4", "5"],
    headerPrefixes: ["Text"]
  },
  "teil-2": {
    gid: 178354616,
    partLabel: "Lesen Teil 2",
    itemNumbers: ["6", "7", "8", "9", "10"],
    headerPrefixes: ["Frage"]
  },
  "teil-3": {
    gid: 398836266,
    partLabel: "Lesen Teil 3",
    itemNumbers: ["11", "12", "13", "14", "15", "16", "17", "18", "19", "20"],
    headerPrefixes: ["Situation"]
  },
  "sprachbausteine-1": {
    gid: 434381124,
    partLabel: "Sprachbausteine 1",
    itemNumbers: ["21", "22", "23", "24", "25", "26", "27", "28", "29", "30"],
    headerPrefixes: ["Luecke", "Lücke"]
  },
  "sprachbausteine-2": {
    gid: 1556604816,
    partLabel: "Sprachbausteine 2",
    itemNumbers: ["31", "32", "33", "34", "35", "36", "37", "38", "39", "40"],
    headerPrefixes: ["Luecke", "Lücke"]
  }
});

const PART_KEY_ALIASES = Object.freeze({
  "teil-1": ["teil-1", "teil1", "teil 1", "lesen teil 1", "lesen-teil-1", "part1", "part-1"],
  "teil-2": ["teil-2", "teil2", "teil 2", "lesen teil 2", "lesen-teil-2", "part2", "part-2"],
  "teil-3": ["teil-3", "teil3", "teil 3", "lesen teil 3", "lesen-teil-3", "part3", "part-3"],
  "sprachbausteine-1": ["sprachbausteine-1", "sprachbausteine 1", "sprach-1", "sprach 1", "sprach1", "sb1"],
  "sprachbausteine-2": ["sprachbausteine-2", "sprachbausteine 2", "sprach-2", "sprach 2", "sprach2", "sb2"]
});

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function safeDecode(value) {
  const text = String(value || "");
  try {
    return decodeURIComponent(text.replace(/\+/g, "%20"));
  } catch (error) {
    return text;
  }
}

function parseCsvRows(text) {
  const input = String(text || "");
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const ch = input[index];

    if (inQuotes) {
      if (ch === "\"") {
        if (input[index + 1] === "\"") {
          value += "\"";
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        value += ch;
      }
      continue;
    }

    if (ch === "\"") {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(value);
      value = "";
      continue;
    }

    if (ch === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    value += ch;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function fetchText(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const statusCode = Number(response.statusCode || 0);

      if ([301, 302, 303, 307, 308].includes(statusCode) && response.headers.location) {
        const nextUrl = new URL(response.headers.location, url).toString();
        response.resume();

        if (redirectCount >= 4) {
          reject(new AppError("Too many redirects while loading contribution sheet", 502));
          return;
        }

        fetchText(nextUrl, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new AppError(`Contribution sheet request failed with status ${statusCode}`, 502));
        return;
      }

      const chunks = [];
      response.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      response.on("end", () => {
        resolve(Buffer.concat(chunks).toString("utf-8"));
      });
    });

    request.on("error", (error) => {
      reject(new AppError(`Failed to load contribution sheet: ${error.message}`, 502));
    });

    request.setTimeout(15000, () => {
      request.destroy(new Error("Request timeout"));
    });
  });
}

async function fetchCsvTab(sheetId, partKey) {
  const partConfig = PART_CONFIG[partKey];
  if (!partConfig) {
    throw new AppError(`Unsupported part "${partKey}"`, 500);
  }

  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/export?format=csv&gid=${encodeURIComponent(partConfig.gid)}`;
  const rawText = await fetchText(url);
  const csvRows = parseCsvRows(rawText);
  const headers = (csvRows[0] || []).map((value, index) => {
    const raw = String(value || "");
    return (index === 0 ? raw.replace(/^\uFEFF/, "") : raw).trim();
  });

  return {
    partKey,
    headers,
    rows: csvRows
      .slice(1)
      .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
  };
}

function normalizePartKey(value, fallbackPartKey = "") {
  const raw = normalize(value);
  if (!raw) {
    return fallbackPartKey || "";
  }

  const found = Object.keys(PART_KEY_ALIASES).find((candidate) => {
    return PART_KEY_ALIASES[candidate].some((alias) => normalize(alias) === raw);
  });

  return found || fallbackPartKey || "";
}

function parseLegacyContext(rawContext, fallbackPartKey) {
  const text = safeDecode(rawContext);
  if (!text) {
    return null;
  }

  const getField = (field) => {
    const match = text.match(new RegExp(`(?:^|[|;,\\s])${field}\\s*[:=]\\s*([^|;,\\s]+)`, "i"));
    return match ? match[1] : "";
  };

  const level = normalize(getField("level"));
  const theme = String(getField("theme") || "").trim();
  const part = normalizePartKey(getField("part"), fallbackPartKey);

  if (!level || !theme) {
    return null;
  }

  return {
    level,
    theme,
    part: part || fallbackPartKey
  };
}

function parseTokenContext(rawContext, fallbackPartKey) {
  const text = safeDecode(rawContext);
  if (!text || !text.startsWith("ctx_")) {
    return null;
  }

  const body = text.slice(4);
  const sortedPartKeys = Object.keys(PART_CONFIG).sort((left, right) => right.length - left.length);
  const foundPart = sortedPartKeys.find((partKey) => body.includes(`_${partKey}_`));

  if (!foundPart) {
    return null;
  }

  const marker = `_${foundPart}_`;
  const prefix = body.split(marker)[0] || "";
  const tokens = prefix.split("_").filter(Boolean);
  if (tokens.length < 3) {
    return null;
  }

  const level = normalize(tokens[0]);
  const theme = tokens.slice(1, -1).join("_");
  if (!level || !theme) {
    return null;
  }

  return {
    level,
    theme,
    part: normalizePartKey(foundPart, fallbackPartKey)
  };
}

function parseContextMeta(rawContext, fallbackPartKey) {
  return parseLegacyContext(rawContext, fallbackPartKey)
    || parseTokenContext(rawContext, fallbackPartKey)
    || null;
}

function getHeaderIndex(headers, patternList) {
  const normalizedHeaders = (headers || []).map((header) => normalize(header));

  for (const pattern of patternList) {
    const wanted = normalize(pattern);
    const index = normalizedHeaders.findIndex((header) => header === wanted);
    if (index >= 0) {
      return index;
    }
  }

  return -1;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeContributionValue(partKey, value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (partKey === "teil-1" || partKey === "teil-3") {
    return raw.toUpperCase();
  }

  if (partKey === "teil-2") {
    return raw.toLowerCase();
  }

  return raw;
}

function uniqueStrings(values = []) {
  return Array.from(new Set(
    values
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  ));
}

function sanitizeAnswerValueMap(partKey, itemNumbers = [], candidate) {
  if (!isPlainObject(candidate)) {
    return {};
  }

  const allowedItems = new Set((itemNumbers || []).map((itemNumber) => String(itemNumber || "").trim()));
  const answerValues = {};

  Object.entries(candidate).forEach(([rawItemNumber, rawValue]) => {
    const itemNumber = String(rawItemNumber || "").trim();
    if (!allowedItems.has(itemNumber)) {
      return;
    }

    const value = normalizeContributionValue(partKey, rawValue);
    if (value) {
      answerValues[itemNumber] = value;
    }
  });

  return answerValues;
}

function buildAnswerValuesFromComparisonRows(partKey, itemNumbers = [], rows = []) {
  const allowedItems = new Set((itemNumbers || []).map((itemNumber) => String(itemNumber || "").trim()));
  const answerValues = {};

  (rows || []).forEach((row) => {
    const itemNumber = String(row?.itemNumber || "").trim();
    if (!allowedItems.has(itemNumber)) {
      return;
    }

    const value = normalizeContributionValue(partKey, row?.submittedValue || "");
    if (value) {
      answerValues[itemNumber] = value;
    }
  });

  return answerValues;
}

function mergeAnswerValues(baseAnswerValues = {}, overrideAnswerValues = {}) {
  return {
    ...sanitizeAnswerValueMap("", Object.keys(baseAnswerValues || {}), baseAnswerValues),
    ...overrideAnswerValues
  };
}

function areAnswerValuesEqual(left = {}, right = {}) {
  const keys = uniqueStrings([
    ...Object.keys(left || {}),
    ...Object.keys(right || {})
  ]).sort((a, b) => Number(a) - Number(b));

  return keys.every((itemNumber) => {
    return String(left?.[itemNumber] || "") === String(right?.[itemNumber] || "");
  });
}

function buildAllowedValuesByItem(partKey, content, itemNumbers = []) {
  const itemList = (itemNumbers || []).map((itemNumber) => String(itemNumber || "").trim());
  const map = {};

  if (!content) {
    return map;
  }

  if (partKey === "teil-1") {
    const allowedValues = uniqueStrings((content.headlines || []).map((entry) => {
      return normalizeContributionValue(partKey, entry?.id || "");
    }));
    itemList.forEach((itemNumber) => {
      map[itemNumber] = allowedValues;
    });
    return map;
  }

  if (partKey === "teil-2") {
    (content.questions || []).forEach((question) => {
      const itemNumber = String(question?.id || "").trim();
      if (!itemNumber) {
        return;
      }
      map[itemNumber] = uniqueStrings((question.options || []).map((option) => {
        return normalizeContributionValue(partKey, option?.id || "");
      }));
    });
    return map;
  }

  if (partKey === "teil-3") {
    const allowedValues = uniqueStrings([
      ...(content.ads || []).map((entry) => normalizeContributionValue(partKey, entry?.id || "")),
      ...(content.answers || []).map((entry) => normalizeContributionValue(partKey, entry?.adId || ""))
    ]);
    itemList.forEach((itemNumber) => {
      map[itemNumber] = allowedValues;
    });
    return map;
  }

  return map;
}

function buildComparisonRows({
  partKey,
  itemNumbers = [],
  answerValues = {},
  currentAnswerMap = {},
  canCompareAgainstCurrent = false,
  allowedValuesByItem = {}
}) {
  return (itemNumbers || [])
    .map((rawItemNumber) => {
      const itemNumber = String(rawItemNumber || "").trim();
      const submittedValue = normalizeContributionValue(partKey, answerValues[itemNumber] || "");
      if (!submittedValue) {
        return null;
      }

      const currentValue = canCompareAgainstCurrent
        ? normalizeContributionValue(partKey, currentAnswerMap[itemNumber] || "")
        : "";

      return {
        itemNumber,
        currentValue,
        submittedValue,
        isDifferent: canCompareAgainstCurrent
          ? submittedValue !== currentValue
          : true,
        allowedValues: Array.isArray(allowedValuesByItem[itemNumber]) ? allowedValuesByItem[itemNumber] : []
      };
    })
    .filter(Boolean);
}

function extractStoredAnswerValues(review, partKey, itemNumbers = []) {
  const directAnswerValues = sanitizeAnswerValueMap(partKey, itemNumbers, review?.answerValues);
  if (Object.keys(directAnswerValues).length) {
    return directAnswerValues;
  }

  if (Array.isArray(review?.comparisonRows) && review.comparisonRows.length) {
    return buildAnswerValuesFromComparisonRows(partKey, itemNumbers, review.comparisonRows);
  }

  if (Array.isArray(review?.differences) && review.differences.length) {
    return buildAnswerValuesFromComparisonRows(partKey, itemNumbers, review.differences);
  }

  return {};
}

function extractStoredComparisonRows(review, partKey, itemNumbers = [], allowedValuesByItem = {}) {
  if (!Array.isArray(review?.comparisonRows) || !review.comparisonRows.length) {
    return [];
  }

  const allowedItems = new Set((itemNumbers || []).map((itemNumber) => String(itemNumber || "").trim()));

  return review.comparisonRows
    .map((row) => {
      const itemNumber = String(row?.itemNumber || "").trim();
      if (!allowedItems.has(itemNumber)) {
        return null;
      }

      const submittedValue = normalizeContributionValue(partKey, row?.submittedValue || "");
      if (!submittedValue) {
        return null;
      }

      const currentValue = normalizeContributionValue(partKey, row?.currentValue || "");
      return {
        itemNumber,
        currentValue,
        submittedValue,
        isDifferent: row?.isDifferent === false ? false : submittedValue !== currentValue,
        allowedValues: Array.isArray(allowedValuesByItem[itemNumber]) ? allowedValuesByItem[itemNumber] : []
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(left.itemNumber) - Number(right.itemNumber));
}

function validateEditedAnswerValues(partKey, content, itemNumbers = [], answerValues = {}) {
  if (!content) {
    return;
  }

  const allowedValuesByItem = buildAllowedValuesByItem(partKey, content, itemNumbers);
  Object.entries(answerValues).forEach(([itemNumber, rawValue]) => {
    const value = normalizeContributionValue(partKey, rawValue);
    if (!value) {
      return;
    }

    const allowedValues = Array.isArray(allowedValuesByItem[itemNumber]) ? allowedValuesByItem[itemNumber] : [];
    if (allowedValues.length && !allowedValues.includes(value)) {
      throw new AppError(`Answer "${value}" is invalid for item ${itemNumber}`, 400);
    }
  });
}

function resolveThemeKey(db, levelKey, rawTheme) {
  const levelEntry = db?.levels?.[levelKey];
  if (!levelEntry?.themes) {
    return null;
  }

  if (levelEntry.themes[rawTheme]) {
    return rawTheme;
  }

  const wanted = normalize(rawTheme);
  const found = Object.keys(levelEntry.themes).find((themeKey) => {
    const title = levelEntry.themes?.[themeKey]?.title || "";
    return normalize(themeKey) === wanted || normalize(title) === wanted;
  });

  return found || null;
}

function resolveCurrentVersion(theme) {
  const versionKey = String(
    theme?.defaultVersion
      || theme?.versionOrder?.[0]
      || Object.keys(theme?.versions || {})[0]
      || "default"
  ).trim() || "default";

  return {
    versionKey,
    version: theme?.versions?.[versionKey] || null
  };
}

function buildCurrentAnswerMap(partKey, content) {
  const map = {};

  if (!content) {
    return map;
  }

  if (partKey === "teil-1") {
    (content.answers || []).forEach((entry) => {
      const itemNumber = String(entry?.textId || "").trim();
      const value = normalizeContributionValue(partKey, entry?.headlineId || "");
      if (itemNumber && value) {
        map[itemNumber] = value;
      }
    });
    return map;
  }

  if (partKey === "teil-2") {
    (content.questions || []).forEach((entry) => {
      const itemNumber = String(entry?.id || "").trim();
      const value = normalizeContributionValue(partKey, entry?.answerId || "");
      if (itemNumber && value) {
        map[itemNumber] = value;
      }
    });
    return map;
  }

  if (partKey === "teil-3") {
    (content.answers || []).forEach((entry) => {
      const itemNumber = String(entry?.situationId || "").trim();
      const value = normalizeContributionValue(partKey, entry?.adId || "");
      if (itemNumber && value) {
        map[itemNumber] = value;
      }
    });
    return map;
  }

  (content.answers || []).forEach((entry) => {
    const itemNumber = String(entry?.id || "").trim();
    const value = normalizeContributionValue(partKey, entry?.answer || entry?.text || "");
    if (itemNumber && value) {
      map[itemNumber] = value;
    }
  });

  return map;
}

function createSubmissionReviewKey(submission) {
  const hash = crypto.createHash("sha1");
  hash.update(JSON.stringify({
    levelKey: submission.levelKey,
    themeKey: submission.themeKey,
    partKey: submission.partKey,
    email: submission.email || "",
    submissionOrder: submission.submissionOrder,
    rowIndex: submission.rowIndex,
    submittedAt: submission.submittedAt || "",
    answerValues: submission.answerValues || {},
    rawReason: submission.rawReason || "",
    rawContext: submission.rawContext || ""
  }));
  return hash.digest("hex");
}

function normalizeReviewStatus(value) {
  const status = normalize(value);
  if (status === "all" || status === "pending" || status === "accepted" || status === "rejected") {
    return status;
  }
  return "pending";
}

function createEmptyReviewStore() {
  return {
    updatedAt: new Date().toISOString(),
    reviews: {}
  };
}

async function writeReviewStore(store) {
  const next = {
    updatedAt: new Date().toISOString(),
    reviews: isPlainObject(store?.reviews) ? store.reviews : {}
  };

  await fs.mkdir(SHARE_DATA_DIR, { recursive: true });
  const tempPath = `${CONTRIBUTION_REVIEW_FILE}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, "utf-8");
  await fs.rename(tempPath, CONTRIBUTION_REVIEW_FILE);
  return next;
}

async function readReviewStore() {
  await fs.mkdir(SHARE_DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(CONTRIBUTION_REVIEW_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      updatedAt: typeof parsed?.updatedAt === "string" ? parsed.updatedAt : "",
      reviews: isPlainObject(parsed?.reviews) ? parsed.reviews : {}
    };
  } catch (error) {
    if (error && error.code === "ENOENT") {
      const initial = createEmptyReviewStore();
      await writeReviewStore(initial);
      return initial;
    }
    throw new AppError("Failed to read contribution review store", 500);
  }
}

function pickVisibleReason(rawReason, rawContext) {
  const reason = safeDecode(rawReason).trim();
  const context = safeDecode(rawContext).trim();

  if (!reason || reason === context || reason.startsWith("ctx_")) {
    return "";
  }

  return reason;
}

function buildUnknownContextIssue({ hasMeta, rawTheme, rawContext }) {
  if (rawTheme) {
    return `Theme "${rawTheme}" could not be resolved from the contribution context.`;
  }
  if (rawContext) {
    return hasMeta
      ? "The contribution context is incomplete, so the theme could not be resolved."
      : "The contribution context could not be parsed.";
  }
  return "The contribution is missing a valid context, so the theme could not be resolved.";
}

function buildUnknownDifferences(answerValues = {}) {
  return Object.entries(answerValues)
    .map(([itemNumber, submittedValue]) => {
      if (!submittedValue) {
        return null;
      }
      return {
        itemNumber,
        currentValue: "",
        submittedValue,
        isDifferent: true
      };
    })
    .filter(Boolean)
    .sort((left, right) => Number(left.itemNumber) - Number(right.itemNumber));
}

function summarizeStatuses(items) {
  const summary = {
    totalAll: 0,
    totalDifferent: 0,
    matchingCurrent: 0,
    pending: 0,
    accepted: 0,
    rejected: 0
  };

  items.forEach((item) => {
    summary.totalAll += 1;
    if (item.matchesCurrent) {
      summary.matchingCurrent += 1;
    } else {
      summary.totalDifferent += 1;
    }
    const status = normalizeReviewStatus(item.reviewStatus);
    if (summary[status] !== undefined) {
      summary[status] += 1;
    }
  });

  return summary;
}

function sortContributionItems(items) {
  const weight = {
    pending: 0,
    rejected: 1,
    accepted: 2
  };

  return [...items].sort((left, right) => {
    const rankDiff = (weight[left.reviewStatus] ?? 99) - (weight[right.reviewStatus] ?? 99);
    if (rankDiff !== 0) {
      return rankDiff;
    }

    const leftOrder = Number(left.submissionOrder || Date.parse(left.reviewedAt || "") || 0);
    const rightOrder = Number(right.submissionOrder || Date.parse(right.reviewedAt || "") || 0);
    return rightOrder - leftOrder;
  });
}

async function buildLesenContributionState(levelFilter = "") {
  const normalizedLevelFilter = normalize(levelFilter);
  const sheetId = COMMUNITY_SHEET_ID_DEFAULT;
  const db = await readJsonByKey("lesen");
  const reviewStore = await readReviewStore();
  const partKeys = Object.keys(PART_CONFIG);
  const tables = await Promise.all(partKeys.map((partKey) => fetchCsvTab(sheetId, partKey)));
  const items = [];

  tables.forEach((table) => {
    const partKey = table.partKey;
    const partConfig = PART_CONFIG[partKey];
    const headers = table.headers || [];
    const emailIndex = getHeaderIndex(headers, ["Email Address", "Email", "E-mail"]);
    const timestampIndex = getHeaderIndex(headers, ["Timestamp", "Zeitstempel", "Submitted at", "Submission time"]);
    const contextIndex = getHeaderIndex(headers, ["Context (auto-filled)", "Context"]);
    const reasonIndex = getHeaderIndex(headers, ["Reason/Comment (optional)", "Reason", "Comment"]);
    const itemIndexes = {};

    partConfig.itemNumbers.forEach((itemNumber) => {
      const patterns = [
        String(itemNumber),
        ...partConfig.headerPrefixes.map((prefix) => `${prefix} ${itemNumber}`)
      ];
      itemIndexes[String(itemNumber)] = getHeaderIndex(headers, patterns);
    });

    const submissions = [];

    (table.rows || []).forEach((row, rowIndex) => {
      const rawContext = contextIndex >= 0 ? row[contextIndex] : "";
      const rawReason = reasonIndex >= 0 ? row[reasonIndex] : "";
      const meta = parseContextMeta(rawContext, partKey) || parseContextMeta(rawReason, partKey) || null;
      const rawTheme = String(meta?.theme || "").trim();
      const lookupLevelKey = normalize(meta?.level);
      if (normalizedLevelFilter && normalizedLevelFilter !== lookupLevelKey) {
        return;
      }

      const resolvedPartKey = normalizePartKey(meta?.part, partKey);
      if (!resolvedPartKey) {
        return;
      }

      const resolvedThemeKey = lookupLevelKey && rawTheme
        ? resolveThemeKey(db, lookupLevelKey, rawTheme)
        : null;
      const hasKnownTheme = Boolean(lookupLevelKey && resolvedThemeKey);
      const displayLevelKey = lookupLevelKey || "unknown";
      const displayThemeKey = hasKnownTheme
        ? resolvedThemeKey
        : (rawTheme || UNKNOWN_THEME_KEY);
      const contextIssue = hasKnownTheme
        ? ""
        : buildUnknownContextIssue({
            hasMeta: Boolean(meta),
            rawTheme,
            rawContext
          });

      const answerValues = {};
      partConfig.itemNumbers.forEach((itemNumber) => {
        const index = itemIndexes[String(itemNumber)];
        if (index < 0) {
          return;
        }
        const value = normalizeContributionValue(resolvedPartKey, row[index] || "");
        if (value) {
          answerValues[String(itemNumber)] = value;
        }
      });

      const rawTimestamp = timestampIndex >= 0 ? String(row[timestampIndex] || "").trim() : "";
      const parsedTimestamp = rawTimestamp ? Date.parse(rawTimestamp) : Number.NaN;
      const submissionOrder = Number.isFinite(parsedTimestamp) ? parsedTimestamp : rowIndex;
      const submission = {
        levelKey: displayLevelKey,
        lookupLevelKey,
        themeKey: displayThemeKey,
        themeLookupKey: resolvedThemeKey || "",
        rawTheme,
        partKey: resolvedPartKey,
        email: normalizeEmail(emailIndex >= 0 ? row[emailIndex] : ""),
        answerValues,
        rawReason: String(rawReason || ""),
        rawContext: String(rawContext || ""),
        reason: pickVisibleReason(rawReason, rawContext),
        rowIndex,
        rawTimestamp,
        submittedAt: Number.isFinite(parsedTimestamp) ? new Date(parsedTimestamp).toISOString() : "",
        submissionOrder,
        canAccept: hasKnownTheme,
        contextIssue
      };

      submissions.push(submission);
    });

    submissions.forEach((submission) => {
      const reviewKey = createSubmissionReviewKey(submission);
      const review = reviewStore?.reviews?.[reviewKey];
      const reviewStatus = normalizeReviewStatus(review?.status);
      const storedAnswerValues = extractStoredAnswerValues(review, submission.partKey, partConfig.itemNumbers);
      const effectiveAnswerValues = Object.keys(storedAnswerValues).length
        ? mergeAnswerValues(submission.answerValues, storedAnswerValues)
        : submission.answerValues;
      const hasLocalEdits = !areAnswerValuesEqual(submission.answerValues, effectiveAnswerValues);
      const theme = submission.canAccept
        ? db?.levels?.[submission.lookupLevelKey]?.themes?.[submission.themeLookupKey]
        : null;
      const { versionKey, version } = theme
        ? resolveCurrentVersion(theme)
        : { versionKey: "", version: null };
      const content = version?.lesen?.parts?.[submission.partKey]?.content || null;
      const canAcceptAgainstCurrent = Boolean(submission.canAccept && content);
      const currentAnswerMap = canAcceptAgainstCurrent
        ? buildCurrentAnswerMap(submission.partKey, content)
        : {};
      const allowedValuesByItem = canAcceptAgainstCurrent
        ? buildAllowedValuesByItem(submission.partKey, content, partConfig.itemNumbers)
        : {};
      const liveComparisonRows = buildComparisonRows({
        partKey: submission.partKey,
        itemNumbers: partConfig.itemNumbers,
        answerValues: effectiveAnswerValues,
        currentAnswerMap,
        canCompareAgainstCurrent: canAcceptAgainstCurrent,
        allowedValuesByItem
      });
      const storedComparisonRows = reviewStatus !== "pending"
        ? extractStoredComparisonRows(review, submission.partKey, partConfig.itemNumbers, allowedValuesByItem)
        : [];
      const comparisonRows = storedComparisonRows.length
        ? storedComparisonRows
        : liveComparisonRows;
      const differences = comparisonRows.filter((row) => row.isDifferent);
      const matchesCurrent = storedComparisonRows.length
        ? Boolean(review?.matchesCurrent === true || differences.length === 0)
        : Boolean(canAcceptAgainstCurrent && comparisonRows.length && !differences.length);

      if (!comparisonRows.length) {
        return;
      }

      items.push({
        reviewKey,
        reviewStatus,
        levelKey: submission.levelKey,
        themeKey: submission.themeKey,
        lookupLevelKey: submission.lookupLevelKey,
        themeLookupKey: submission.themeLookupKey,
        themeTitle: canAcceptAgainstCurrent
          ? (theme.title || submission.themeKey)
          : UNKNOWN_THEME_TITLE,
        partKey: submission.partKey,
        partLabel: partConfig.partLabel,
        email: submission.email,
        reason: submission.reason,
        rawTimestamp: submission.rawTimestamp,
        submittedAt: submission.submittedAt,
        submissionOrder: submission.submissionOrder,
        currentVersionKey: versionKey,
        currentVersionLabel: version?.label || versionKey || "Unknown",
        answerValues: effectiveAnswerValues,
        originalAnswerValues: submission.answerValues,
        rawReason: submission.rawReason,
        rawContext: submission.rawContext,
        rowIndex: submission.rowIndex,
        differenceCount: differences.length,
        matchesCurrent,
        hasLocalEdits,
        editedAt: typeof review?.editedAt === "string" ? review.editedAt : "",
        comparisonRows,
        differences,
        canAccept: canAcceptAgainstCurrent,
        contextIssue: canAcceptAgainstCurrent
          ? ""
          : (submission.contextIssue || "The current correction could not be resolved for this contribution.")
      });
    });
  });

  return {
    db,
    reviewStore,
    sheetId,
    items: sortContributionItems(items),
    summary: summarizeStatuses(items)
  };
}

function findCollectionEntry(collection, field, itemNumber) {
  return (collection || []).find((entry) => String(entry?.[field] || "").trim() === String(itemNumber));
}

function applyValueToContent(partKey, content, itemNumber, nextValue) {
  if (partKey === "teil-1") {
    const entry = findCollectionEntry(content.answers, "textId", itemNumber);
    if (!entry) {
      throw new AppError(`Answer ${itemNumber} was not found in Lesen Teil 1`, 400);
    }
    entry.headlineId = nextValue;
    return;
  }

  if (partKey === "teil-2") {
    const question = findCollectionEntry(content.questions, "id", itemNumber);
    if (!question) {
      throw new AppError(`Question ${itemNumber} was not found in Lesen Teil 2`, 400);
    }
    const option = (question.options || []).find((entry) => {
      return normalizeContributionValue("teil-2", entry?.id || "") === nextValue;
    });
    if (!option) {
      throw new AppError(`Answer "${nextValue}" is invalid for question ${itemNumber}`, 400);
    }
    question.answerId = nextValue;
    question.answerText = String(option.text || "").trim();
    return;
  }

  if (partKey === "teil-3") {
    const entry = findCollectionEntry(content.answers, "situationId", itemNumber);
    if (!entry) {
      throw new AppError(`Answer ${itemNumber} was not found in Lesen Teil 3`, 400);
    }
    entry.adId = nextValue;
    return;
  }

  const entry = findCollectionEntry(content.answers, "id", itemNumber);
  if (!entry) {
    throw new AppError(`Answer ${itemNumber} was not found in ${partKey}`, 400);
  }
  entry.answer = nextValue;
}

function applyContributionToContent(partKey, content, difference) {
  applyValueToContent(partKey, content, difference.itemNumber, difference.submittedValue);
}

function buildAcceptedHistoryItems(db, reviewStore, levelFilter = "") {
  const normalizedLevelFilter = normalize(levelFilter);
  return Object.entries(reviewStore?.reviews || {})
    .map(([reviewKey, review]) => {
      if (normalizeReviewStatus(review?.status) !== "accepted") {
        return null;
      }

      const levelKey = normalize(review?.levelKey);
      if (normalizedLevelFilter && normalizedLevelFilter !== levelKey) {
        return null;
      }

      const themeKey = String(review?.themeKey || "").trim();
      const partKey = String(review?.partKey || "").trim();
      const comparisonRows = Array.isArray(review?.comparisonRows) && review.comparisonRows.length
        ? review.comparisonRows
        : (Array.isArray(review?.differences) ? review.differences : []);
      const differences = comparisonRows.filter((row) => row?.isDifferent !== false);
      if (!levelKey || !themeKey || !partKey || !comparisonRows.length) {
        return null;
      }

      const theme = db?.levels?.[levelKey]?.themes?.[themeKey] || null;
      const version = theme?.versions?.[review.currentVersionKey] || null;

      return {
        reviewKey,
        reviewStatus: "accepted",
        levelKey,
        themeKey,
        themeTitle: review.themeTitle || theme?.title || themeKey,
        partKey,
        partLabel: review.partLabel || PART_CONFIG[partKey]?.partLabel || partKey,
        email: review.email || "",
        reason: review.reason || "",
        rawTimestamp: review.submittedAt || "",
        submittedAt: review.submittedAt || "",
        reviewedAt: review.reviewedAt || "",
        submissionOrder: Date.parse(review.reviewedAt || review.submittedAt || "") || 0,
        currentVersionKey: review.currentVersionKey || "default",
        currentVersionLabel: review.currentVersionLabel || version?.label || review.currentVersionKey || "default",
        differenceCount: differences.length,
        matchesCurrent: review.matchesCurrent === true || differences.length === 0,
        hasLocalEdits: false,
        editedAt: "",
        comparisonRows,
        differences,
        canAccept: true,
        contextIssue: ""
      };
    })
    .filter(Boolean);
}

function serializeContributionItem(item) {
  return {
    reviewKey: item.reviewKey,
    reviewStatus: item.reviewStatus,
    levelKey: item.levelKey,
    themeKey: item.themeKey,
    themeTitle: item.themeTitle,
    partKey: item.partKey,
    partLabel: item.partLabel,
    email: item.email,
    reason: item.reason,
    rawTimestamp: item.rawTimestamp,
    submittedAt: item.submittedAt,
    reviewedAt: item.reviewedAt || "",
    submissionOrder: item.submissionOrder,
    currentVersionKey: item.currentVersionKey,
    currentVersionLabel: item.currentVersionLabel,
    differenceCount: item.differenceCount,
    matchesCurrent: item.matchesCurrent === true,
    hasLocalEdits: item.hasLocalEdits === true,
    editedAt: item.editedAt || "",
    answerValues: sanitizeAnswerValueMap(item.partKey, PART_CONFIG[item.partKey]?.itemNumbers || [], item.answerValues),
    originalAnswerValues: sanitizeAnswerValueMap(item.partKey, PART_CONFIG[item.partKey]?.itemNumbers || [], item.originalAnswerValues),
    comparisonRows: Array.isArray(item.comparisonRows) ? item.comparisonRows : [],
    differences: item.differences,
    canAccept: item.canAccept !== false,
    contextIssue: item.contextIssue || ""
  };
}

async function listLesenContributions(query = {}) {
  const requestedLevel = normalize(query.level);
  const requestedStatus = normalizeReviewStatus(query.status);
  const requestedScope = normalize(query.scope) === "all" ? "all" : "different";
  const state = await buildLesenContributionState(requestedLevel);
  const acceptedHistoryItems = buildAcceptedHistoryItems(state.db, state.reviewStore, requestedLevel)
    .filter((historyItem) => !state.items.some((item) => item.reviewKey === historyItem.reviewKey));
  const mergedItems = sortContributionItems([
    ...state.items,
    ...acceptedHistoryItems
  ]);
  const scopedItems = requestedScope === "all"
    ? mergedItems
    : mergedItems.filter((item) => item.matchesCurrent !== true);
  const filteredItems = requestedStatus === "all"
    ? scopedItems
    : scopedItems.filter((item) => item.reviewStatus === requestedStatus);
  const summary = {
    totalAll: state.summary.totalAll,
    totalDifferent: state.summary.totalDifferent,
    matchingCurrent: state.summary.matchingCurrent,
    pending: mergedItems.filter((item) => item.reviewStatus === "pending").length,
    accepted: mergedItems.filter((item) => item.reviewStatus === "accepted").length,
    rejected: mergedItems.filter((item) => item.reviewStatus === "rejected").length
  };

  return {
    sheetId: state.sheetId,
    filters: {
      level: requestedLevel,
      status: requestedStatus,
      scope: requestedScope
    },
    summary,
    items: filteredItems.map(serializeContributionItem)
  };
}

async function editLesenContribution(payload = {}) {
  const reviewKey = String(payload.reviewKey || "").trim();
  const reset = payload.reset === true;

  assertString(reviewKey, "reviewKey is required");

  const state = await buildLesenContributionState("");
  const item = state.items.find((entry) => entry.reviewKey === reviewKey);

  if (!item) {
    throw new AppError("Contribution not found.", 404);
  }

  if (normalizeReviewStatus(item.reviewStatus) !== "pending") {
    throw new AppError("Only pending contributions can be edited.", 400);
  }

  if (reset) {
    delete state.reviewStore.reviews[reviewKey];
    await writeReviewStore(state.reviewStore);

    return {
      reviewKey,
      status: "pending",
      hasLocalEdits: false,
      message: "Local edits were reset to the original submission."
    };
  }

  if (!isPlainObject(payload.answerValues)) {
    throw new AppError("answerValues must be an object.", 400);
  }

  const partConfig = PART_CONFIG[item.partKey];
  if (!partConfig) {
    throw new AppError(`Unsupported part "${item.partKey}"`, 500);
  }

  const submittedAnswerValues = sanitizeAnswerValueMap(item.partKey, partConfig.itemNumbers, payload.answerValues);
  if (!Object.keys(submittedAnswerValues).length) {
    throw new AppError("At least one edited answer is required.", 400);
  }

  const originalAnswerValues = sanitizeAnswerValueMap(
    item.partKey,
    partConfig.itemNumbers,
    item.originalAnswerValues || item.answerValues
  );
  const mergedAnswerValues = mergeAnswerValues(originalAnswerValues, submittedAnswerValues);
  const hasLocalEdits = !areAnswerValuesEqual(originalAnswerValues, mergedAnswerValues);

  if (item.canAccept) {
    const theme = state.db?.levels?.[item.lookupLevelKey || item.levelKey]?.themes?.[item.themeLookupKey || item.themeKey];
    const version = theme?.versions?.[item.currentVersionKey];
    const content = version?.lesen?.parts?.[item.partKey]?.content;
    validateEditedAnswerValues(item.partKey, content, partConfig.itemNumbers, mergedAnswerValues);
  }

  if (!hasLocalEdits) {
    delete state.reviewStore.reviews[reviewKey];
    await writeReviewStore(state.reviewStore);

    return {
      reviewKey,
      status: "pending",
      hasLocalEdits: false,
      message: "Local edits were reset to the original submission."
    };
  }

  state.reviewStore.reviews[reviewKey] = {
    ...(isPlainObject(state.reviewStore.reviews?.[reviewKey]) ? state.reviewStore.reviews[reviewKey] : {}),
    reviewKey,
    status: "pending",
    editedAt: new Date().toISOString(),
    answerValues: mergedAnswerValues
  };

  await writeReviewStore(state.reviewStore);

  return {
    reviewKey,
    status: "pending",
    hasLocalEdits: true,
    message: "Local contribution edits were saved."
  };
}

async function reviewLesenContribution(payload = {}) {
  const reviewKey = String(payload.reviewKey || "").trim();
  const action = normalize(String(payload.action || ""));

  assertString(reviewKey, "reviewKey is required");
  if (action !== "accept" && action !== "reject" && action !== "revert") {
    throw new AppError("action must be either accept, reject, or revert", 400);
  }

  if (action === "revert") {
    const reviewStore = await readReviewStore();
    const review = reviewStore.reviews?.[reviewKey];
    if (!review || normalizeReviewStatus(review.status) !== "accepted") {
      throw new AppError("Accepted contribution not found", 404);
    }

    const db = await readJsonByKey("lesen");
    const theme = db?.levels?.[review.levelKey]?.themes?.[review.themeKey];
    const version = theme?.versions?.[review.currentVersionKey];
    const content = version?.lesen?.parts?.[review.partKey]?.content;
    const differences = Array.isArray(review.differences) ? review.differences : [];

    if (!differences.length) {
      delete reviewStore.reviews[reviewKey];
      await writeReviewStore(reviewStore);

      return {
        reviewKey,
        status: "reverted",
        updatedAnswers: 0
      };
    }

    if (!content) {
      throw new AppError("Accepted contribution is missing rollback data", 400);
    }

    const currentAnswerMap = buildCurrentAnswerMap(review.partKey, content);
    differences.forEach((difference) => {
      if ((currentAnswerMap[difference.itemNumber] || "") !== difference.submittedValue) {
        throw new AppError(
          `Cannot revert item ${difference.itemNumber} because the current correction changed after acceptance.`,
          409
        );
      }
    });

    differences.forEach((difference) => {
      applyValueToContent(review.partKey, content, difference.itemNumber, difference.currentValue);
    });

    await writeJsonByKey("lesen", db);
    delete reviewStore.reviews[reviewKey];
    await writeReviewStore(reviewStore);

    return {
      reviewKey,
      status: "reverted",
      updatedAnswers: differences.length
    };
  }

  const state = await buildLesenContributionState("");
  const item = state.items.find((entry) => entry.reviewKey === reviewKey);

  if (!item) {
    throw new AppError(
      "Contribution not found. It may have been reviewed already or no longer differs from the current correction.",
      404
    );
  }

  if (action === "accept" && item.canAccept === false) {
    throw new AppError(
      "Cannot accept this contribution because its context/theme could not be resolved. Reject it or fix the source context first.",
      400
    );
  }

  if (action === "accept") {
    const theme = state.db?.levels?.[item.lookupLevelKey || item.levelKey]?.themes?.[item.themeLookupKey || item.themeKey];
    const version = theme?.versions?.[item.currentVersionKey];
    const content = version?.lesen?.parts?.[item.partKey]?.content;

    if (!content) {
      throw new AppError("Current correction content was not found", 404);
    }

    item.differences.forEach((difference) => {
      applyContributionToContent(item.partKey, content, difference);
    });

    await writeJsonByKey("lesen", state.db);
  }

  state.reviewStore.reviews[reviewKey] = {
    reviewKey,
    status: action === "accept" ? "accepted" : "rejected",
    reviewedAt: new Date().toISOString(),
    editedAt: state.reviewStore.reviews?.[reviewKey]?.editedAt || "",
    levelKey: item.levelKey,
    themeKey: item.themeKey,
    themeTitle: item.themeTitle,
    partKey: item.partKey,
    partLabel: item.partLabel,
    email: item.email,
    reason: item.reason,
    submittedAt: item.submittedAt || item.rawTimestamp || "",
    currentVersionKey: item.currentVersionKey,
    currentVersionLabel: item.currentVersionLabel,
    differenceCount: item.differenceCount,
    matchesCurrent: item.matchesCurrent === true,
    answerValues: sanitizeAnswerValueMap(item.partKey, PART_CONFIG[item.partKey]?.itemNumbers || [], item.answerValues),
    comparisonRows: Array.isArray(item.comparisonRows) ? item.comparisonRows : [],
    differences: item.differences
  };

  await writeReviewStore(state.reviewStore);

  let emailResult = null;
  if (action === "accept") {
    emailResult = await sendAcceptedContributionEmail({
      recipientEmail: item.email,
      themeTitle: item.themeTitle,
      partLabel: item.partLabel
    });
  } else if (action === "reject") {
    emailResult = await sendRejectedContributionEmail({
      recipientEmail: item.email,
      themeTitle: item.themeTitle,
      partLabel: item.partLabel
    });
  }

  return {
    reviewKey,
    status: state.reviewStore.reviews[reviewKey].status,
    updatedAnswers: action === "accept" ? item.differences.length : 0,
    emailStatus: emailResult?.status || "",
    emailMessage: emailResult?.message || ""
  };
}

module.exports = {
  listLesenContributions,
  editLesenContribution,
  reviewLesenContribution
};
