const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const SITE_DIR = path.join(PROJECT_ROOT, "site");
const DATABASE_DIR = path.join(SITE_DIR, "database");
const DASHBOARD_DIR = path.join(PROJECT_ROOT, "dashboard");
const SHARE_DASHBOARD_DIR = path.join(PROJECT_ROOT, "share-dashboard");
const SHARE_DATA_DIR = path.join(PROJECT_ROOT, "server", "data");

const DATABASE_FILES = Object.freeze({
  config: "config.json",
  parts: "parts.json",
  lesen: "lesen.json",
  horen: "horen-codes.json",
  shreiben: "shreiben.json"
});

const ALLOWED_FILE_KEYS = Object.freeze(Object.keys(DATABASE_FILES));

module.exports = {
  PROJECT_ROOT,
  SITE_DIR,
  DATABASE_DIR,
  DASHBOARD_DIR,
  SHARE_DASHBOARD_DIR,
  SHARE_DATA_DIR,
  DATABASE_FILES,
  ALLOWED_FILE_KEYS
};
