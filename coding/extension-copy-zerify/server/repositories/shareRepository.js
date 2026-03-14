const fs = require("fs/promises");
const path = require("path");
const initSqlJs = require("sql.js");
const { SHARE_DATA_DIR } = require("../config/constants");

const SHARE_DB_FILE = path.join(SHARE_DATA_DIR, "share-tracking.sqlite");

let sqlPromise = null;
let databasePromise = null;
let writeQueue = Promise.resolve();

function locateSqlJsFile(file) {
  const wasmEntry = require.resolve("sql.js/dist/sql-wasm.js");
  return path.join(path.dirname(wasmEntry), file);
}

function initializeSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS share_users (
      user_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      first_seen_path TEXT NOT NULL DEFAULT '',
      last_seen_path TEXT NOT NULL DEFAULT '',
      last_ip_address TEXT NOT NULL DEFAULT '',
      last_user_agent TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS share_referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_user_id TEXT NOT NULL,
      visitor_user_id TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      landing_path TEXT NOT NULL DEFAULT '',
      visit_count INTEGER NOT NULL DEFAULT 1,
      first_ip_address TEXT NOT NULL DEFAULT '',
      last_ip_address TEXT NOT NULL DEFAULT '',
      first_user_agent TEXT NOT NULL DEFAULT '',
      last_user_agent TEXT NOT NULL DEFAULT '',
      UNIQUE(referrer_user_id, visitor_user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_share_referrals_referrer
      ON share_referrals (referrer_user_id);

    CREATE INDEX IF NOT EXISTS idx_share_referrals_last_seen
      ON share_referrals (last_seen_at DESC);
  `);
}

async function persistDatabase(db) {
  await fs.mkdir(SHARE_DATA_DIR, { recursive: true });
  const bytes = Buffer.from(db.export());
  const tempFile = `${SHARE_DB_FILE}.tmp`;
  await fs.writeFile(tempFile, bytes);
  await fs.rename(tempFile, SHARE_DB_FILE);
}

async function getSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: locateSqlJsFile
    });
  }
  return sqlPromise;
}

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const SQL = await getSql();
      await fs.mkdir(SHARE_DATA_DIR, { recursive: true });

      let fileBuffer = null;
      try {
        fileBuffer = await fs.readFile(SHARE_DB_FILE);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }

      const db = fileBuffer?.length
        ? new SQL.Database(fileBuffer)
        : new SQL.Database();

      initializeSchema(db);
      return db;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

async function withShareDbRead(action) {
  await writeQueue.catch(() => {});
  const db = await getDatabase();
  return action(db);
}

async function withShareDbWrite(action) {
  const execute = async () => {
    const db = await getDatabase();
    const result = await action(db);
    await persistDatabase(db);
    return result;
  };

  const pending = writeQueue.then(execute, execute);
  writeQueue = pending.catch(() => {});
  return pending;
}

function execute(db, sql, params = []) {
  db.run(sql, params);
}

function queryAll(db, sql, params = []) {
  const statement = db.prepare(sql, params);
  const rows = [];
  while (statement.step()) {
    rows.push(statement.getAsObject());
  }
  statement.free();
  return rows;
}

function queryOne(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows[0] || null;
}

module.exports = {
  SHARE_DB_FILE,
  execute,
  queryAll,
  queryOne,
  withShareDbRead,
  withShareDbWrite
};
