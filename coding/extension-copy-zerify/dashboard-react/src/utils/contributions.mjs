export const DEFAULT_PUBLIC_SITE_URL = "https://labs.zdeutsch.app";

function normalizeContext(value) {
  return String(value || "").trim().toLocaleLowerCase("de");
}

function normalizeAnswer(value) {
  return String(value || "").trim();
}

export function getContributionRows(item) {
  if (Array.isArray(item?.comparisonRows) && item.comparisonRows.length) return item.comparisonRows;
  return Array.isArray(item?.differences) ? item.differences : [];
}

export function getSuggestedDifferences(item) {
  if (Array.isArray(item?.differences)) return item.differences;
  return getContributionRows(item).filter((row) => row?.isDifferent !== false);
}

export function buildPublicThemeUrl(item, baseUrl = DEFAULT_PUBLIC_SITE_URL) {
  if (!item?.canAccept || !item.levelKey || !item.themeKey) return "";
  const url = new URL("lesen.html", `${String(baseUrl).replace(/\/+$/, "")}/`);
  url.searchParams.set("level", item.levelKey);
  url.searchParams.set("theme", item.themeKey);
  url.searchParams.set("version", item.currentVersionKey || "default");
  return url.toString();
}

function suggestionSignature(item) {
  const answers = getSuggestedDifferences(item)
    .map((row) => [
      normalizeContext(row.itemNumber),
      normalizeAnswer(row.currentValue),
      normalizeAnswer(row.submittedValue)
    ])
    .sort((left, right) => left[0].localeCompare(right[0]) || left[1].localeCompare(right[1]) || left[2].localeCompare(right[2]));
  return JSON.stringify([
    normalizeContext(item?.levelKey),
    normalizeContext(item?.themeKey),
    normalizeContext(item?.currentVersionKey || "default"),
    normalizeContext(item?.partKey),
    normalizeContext(item?.contextIssue),
    answers.length ? answers : ["single", normalizeContext(item?.reviewKey)]
  ]);
}

export function groupContributionItems(items = []) {
  const groups = [];
  const groupMap = new Map();

  items.forEach((item) => {
    const key = suggestionSignature(item);
    let group = groupMap.get(key);
    if (!group) {
      group = { key, sampleItem: item, items: [], contributorEmails: [], contributorCount: 0 };
      groupMap.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  });

  groups.forEach((group) => {
    const seenEmails = new Set();
    let anonymousCount = 0;
    group.items.forEach((item) => {
      const email = String(item?.email || "").trim();
      if (!email) {
        anonymousCount += 1;
        return;
      }
      const normalized = email.toLocaleLowerCase("de");
      if (!seenEmails.has(normalized)) {
        seenEmails.add(normalized);
        group.contributorEmails.push(email);
      }
    });
    group.contributorCount = group.contributorEmails.length + anonymousCount;
  });

  return groups.sort((left, right) => (
    right.items.length - left.items.length
    || String(left.sampleItem?.themeTitle || "").localeCompare(String(right.sampleItem?.themeTitle || ""), "de")
  ));
}
