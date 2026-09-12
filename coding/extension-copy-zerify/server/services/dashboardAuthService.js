const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const AppError = require("../utils/appError");

const ADMIN_ROLE = "zdeutsch-admin";
const COOKIE_NAME = "zdeutsch_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SSO_AUDIENCE = "zdeutsch-admin-dashboard";
const SSO_MAX_TTL_SECONDS = 120;
let pool;
const consumedSsoNonces = new Map();

function authRequired() {
  const configured = String(process.env.DASHBOARD_AUTH_REQUIRED || "").trim().toLowerCase();
  if (configured) return !["0", "false", "no", "off"].includes(configured);
  return process.env.NODE_ENV === "production";
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function sessionSecret() {
  const secret = String(process.env.DASHBOARD_SESSION_SECRET || process.env.SESSION_SECRET || "");
  if (secret.length < 32) {
    throw new AppError("Dashboard authentication is not configured", 503);
  }
  return secret;
}

function ssoSecret(options = {}) {
  const secret = String(options.secret || process.env.DASHBOARD_SSO_SECRET || "");
  if (secret.length < 32) throw new AppError("Dashboard SSO is not configured", 503);
  return secret;
}

function databaseConfig() {
  const value = (specific, fallback) => process.env[specific] || process.env[fallback];
  return {
    host: value("ZDEUTSCH_MYSQL_HOST", "MYSQL_HOST"),
    port: Number.parseInt(value("ZDEUTSCH_MYSQL_PORT", "MYSQL_PORT") || "3306", 10),
    user: value("ZDEUTSCH_MYSQL_USER", "MYSQL_USER"),
    password: value("ZDEUTSCH_MYSQL_PASSWORD", "MYSQL_PASSWORD"),
    database: value("ZDEUTSCH_MYSQL_DATABASE", "MYSQL_DATABASE"),
    connectionLimit: 5,
    enableKeepAlive: true,
    charset: "utf8mb4"
  };
}

function getPool() {
  if (!pool) pool = mysql.createPool(databaseConfig());
  return pool;
}

async function findUserByEmail(email, options = {}) {
  const database = options.database || getPool();
  const [rows] = await database.execute(
    "SELECT email, password_hash, role, is_active FROM users WHERE LOWER(email) = ? LIMIT 1",
    [normalizeEmail(email)]
  );
  return rows[0] || null;
}

function isEligibleAdmin(user) {
  return Boolean(
    user
    && normalizeEmail(user.email)
    && String(user.role || "") === ADMIN_ROLE
    && Number(user.is_active) === 1
  );
}

async function authenticateAdmin(email, password, options = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || typeof password !== "string" || !password) return null;
  const user = options.findUser
    ? await options.findUser(normalizedEmail)
    : await findUserByEmail(normalizedEmail, options);
  if (!isEligibleAdmin(user) || !user.password_hash) return null;
  const compare = options.comparePassword || bcrypt.compare;
  if (!await compare(password, user.password_hash)) return null;
  return { email: normalizeEmail(user.email), role: ADMIN_ROLE };
}

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(encodedPayload, secret) {
  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function createSessionToken(admin, options = {}) {
  const now = options.now || Date.now();
  const ttlSeconds = options.ttlSeconds || SESSION_TTL_SECONDS;
  const payload = {
    sub: normalizeEmail(admin.email),
    role: ADMIN_ROLE,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + ttlSeconds
  };
  const encoded = encode(payload);
  return `${encoded}.${sign(encoded, options.secret || sessionSecret())}`;
}

function verifySessionToken(token, options = {}) {
  const [encoded, signature, extra] = String(token || "").split(".");
  if (!encoded || !signature || extra) return null;
  const expected = sign(encoded, options.secret || sessionSecret());
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const nowSeconds = Math.floor((options.now || Date.now()) / 1000);
    if (payload.role !== ADMIN_ROLE || !payload.sub || !Number.isFinite(payload.exp) || payload.exp <= nowSeconds) return null;
    return { email: normalizeEmail(payload.sub), role: ADMIN_ROLE, expiresAt: payload.exp };
  } catch (_error) {
    return null;
  }
}

function verifySsoToken(token, options = {}) {
  if (String(token || "").length > 2048) return null;
  const [encoded, signature, extra] = String(token || "").split(".");
  if (!encoded || !signature || extra) return null;
  const expected = sign(encoded, ssoSecret(options));
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const nowSeconds = Math.floor(Number(options.now || Date.now()) / 1000);
    const issuedAt = Number(payload.iat);
    const expiresAt = Number(payload.exp);
    if (
      payload.aud !== SSO_AUDIENCE
      || payload.role !== ADMIN_ROLE
      || !normalizeEmail(payload.sub)
      || !String(payload.nonce || "")
      || !Number.isFinite(issuedAt)
      || !Number.isFinite(expiresAt)
      || issuedAt > nowSeconds + 30
      || expiresAt <= nowSeconds
      || expiresAt <= issuedAt
      || expiresAt - issuedAt > SSO_MAX_TTL_SECONDS
    ) return null;
    return {
      email: normalizeEmail(payload.sub),
      role: ADMIN_ROLE,
      nonce: String(payload.nonce),
      expiresAt
    };
  } catch (_error) {
    return null;
  }
}

function consumeSsoNonce(nonce, expiresAt, now = Date.now()) {
  const nowSeconds = Math.floor(Number(now) / 1000);
  for (const [storedNonce, storedExpiry] of consumedSsoNonces) {
    if (storedExpiry <= nowSeconds) consumedSsoNonces.delete(storedNonce);
  }
  if (consumedSsoNonces.has(nonce)) return false;
  consumedSsoNonces.set(nonce, expiresAt);
  return true;
}

async function exchangeSsoToken(token, options = {}) {
  const handoff = verifySsoToken(token, options);
  if (!handoff) return null;
  const user = options.findUser
    ? await options.findUser(handoff.email)
    : await findUserByEmail(handoff.email, options);
  if (!isEligibleAdmin(user) || normalizeEmail(user.email) !== handoff.email) return null;
  if (!consumeSsoNonce(handoff.nonce, handoff.expiresAt, options.now)) return null;
  return { email: handoff.email, role: ADMIN_ROLE };
}

function parseCookies(header) {
  return String(header || "").split(";").reduce((cookies, item) => {
    const index = item.indexOf("=");
    if (index <= 0) return cookies;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    try { cookies[key] = decodeURIComponent(value); } catch (_error) { cookies[key] = value; }
    return cookies;
  }, {});
}

function requestIsSecure(req) {
  return Boolean(req.secure || String(req.get("x-forwarded-proto") || "").split(",")[0].trim() === "https");
}

function setSessionCookie(req, res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: requestIsSecure(req),
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/"
  });
}

function clearSessionCookie(req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: requestIsSecure(req),
    sameSite: "lax",
    path: "/"
  });
}

async function adminFromRequest(req, options = {}) {
  if (!authRequired()) return { email: "local@zdeutsch.app", role: ADMIN_ROLE };
  const token = parseCookies(req.get("cookie"))[COOKIE_NAME];
  const session = verifySessionToken(token, options);
  if (!session) return null;
  const user = options.findUser
    ? await options.findUser(session.email)
    : await findUserByEmail(session.email, options);
  return isEligibleAdmin(user) ? { email: normalizeEmail(user.email), role: ADMIN_ROLE } : null;
}

function resetPoolForTests() {
  pool = undefined;
  consumedSsoNonces.clear();
}

module.exports = {
  ADMIN_ROLE,
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  SSO_AUDIENCE,
  authRequired,
  normalizeEmail,
  isEligibleAdmin,
  authenticateAdmin,
  createSessionToken,
  verifySessionToken,
  verifySsoToken,
  exchangeSsoToken,
  adminFromRequest,
  setSessionCookie,
  clearSessionCookie,
  resetPoolForTests
};
