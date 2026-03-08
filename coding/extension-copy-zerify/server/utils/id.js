function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function uniqueId(prefix = "item") {
  const stamp = Date.now();
  const random = Math.floor(Math.random() * 100000).toString(36);
  return `${prefix}-${stamp}-${random}`;
}

module.exports = {
  slugify,
  uniqueId
};
