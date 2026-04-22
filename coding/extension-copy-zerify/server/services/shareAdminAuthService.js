const crypto = require("crypto");
const AppError = require("../utils/appError");

const COOKIE_NAME = "zdeutsch_share_admin_session";
const DEFAULT_USERNAME = "admin";
const DEFAULT_PASSWORD = "change_me";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getAdminUsername() {
  return String(process.env.SHARE_DASHBOARD_USERNAME || DEFAULT_USERNAME).trim();
}

function getAdminPassword() {
  return String(process.env.SHARE_DASHBOARD_PASSWORD || DEFAULT_PASSWORD);
}

function getSessionSecret() {
  const explicit = String(process.env.SHARE_DASHBOARD_SESSION_SECRET || "").trim();
  if (explicit) {
    return explicit;
  }
  return `${getAdminUsername()}:${getAdminPassword()}:share-dashboard`;
}

function toBuffer(value) {
  return Buffer.from(String(value || ""), "utf8");
}

function timingSafeEquals(left, right) {
  const a = toBuffer(left);
  const b = toBuffer(right);
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function parseCookies(headerValue) {
  return String(headerValue || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const separatorIndex = entry.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }
      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function signSessionPayload(username, expiresAt) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(`${username}:${expiresAt}`)
    .digest("base64url");
}

function createSessionToken() {
  const username = getAdminUsername();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const signature = signSessionPayload(username, expiresAt);
  return Buffer.from(
    JSON.stringify({
      u: username,
      e: expiresAt,
      s: signature
    }),
    "utf8"
  ).toString("base64url");
}

function getSessionPayload(token) {
  try {
    const raw = Buffer.from(String(token || ""), "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (error) {
    return null;
  }
}

function isShareAdminAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  const payload = getSessionPayload(cookies[COOKIE_NAME]);
  if (!payload) {
    return false;
  }

  const expiresAt = Number(payload.e);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  if (!timingSafeEquals(payload.u, getAdminUsername())) {
    return false;
  }

  const expectedSignature = signSessionPayload(payload.u, expiresAt);
  return timingSafeEquals(payload.s, expectedSignature);
}

function shouldUseSecureCookies(req) {
  return req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}

function buildSessionCookie(req, token, maxAgeMs) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`
  ];

  if (shouldUseSecureCookies(req)) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function setShareAdminSessionCookie(req, res) {
  const token = createSessionToken();
  res.setHeader("Set-Cookie", buildSessionCookie(req, token, SESSION_TTL_MS));
}

function clearShareAdminSessionCookie(req, res) {
  res.setHeader("Set-Cookie", buildSessionCookie(req, "", 0));
}

function authenticateShareAdmin(username, password) {
  return timingSafeEquals(username, getAdminUsername())
    && timingSafeEquals(password, getAdminPassword());
}

function requireShareAdminAuth(req, res, next) {
  if (!isShareAdminAuthenticated(req)) {
    return next(new AppError("Authentication required", 401));
  }
  return next();
}

module.exports = {
  authenticateShareAdmin,
  clearShareAdminSessionCookie,
  isShareAdminAuthenticated,
  requireShareAdminAuth,
  setShareAdminSessionCookie
};
