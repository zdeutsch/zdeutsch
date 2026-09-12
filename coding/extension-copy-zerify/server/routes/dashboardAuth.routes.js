const express = require("express");
const AppError = require("../utils/appError");
const {
  adminFromRequest,
  authenticateAdmin,
  clearSessionCookie,
  createSessionToken,
  exchangeSsoToken,
  setSessionCookie
} = require("../services/dashboardAuthService");

const router = express.Router();
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function attemptKey(req, email) {
  return `${req.ip || req.socket.remoteAddress || "unknown"}:${String(email || "").trim().toLowerCase()}`;
}

function rateLimitState(key, now = Date.now()) {
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 0, resetAt: now + WINDOW_MS };
    attempts.set(key, fresh);
    return fresh;
  }
  return current;
}

router.get("/session", async (req, res, next) => {
  try {
    const admin = await adminFromRequest(req);
    res.json({ ok: true, data: { authenticated: Boolean(admin), user: admin } });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  const email = String(req.body?.email || "").trim();
  const key = attemptKey(req, email);
  const state = rateLimitState(key);
  if (state.count >= MAX_ATTEMPTS) {
    return next(new AppError("Zu viele Anmeldeversuche. Bitte versuchen Sie es später erneut.", 429));
  }
  try {
    const admin = await authenticateAdmin(email, req.body?.password);
    if (!admin) {
      state.count += 1;
      return next(new AppError("E-Mail-Adresse oder Passwort ist ungültig.", 401));
    }
    attempts.delete(key);
    setSessionCookie(req, res, createSessionToken(admin));
    return res.json({ ok: true, data: { user: admin } });
  } catch (error) {
    return next(error);
  }
});

router.post("/sso", async (req, res, next) => {
  try {
    const admin = await exchangeSsoToken(req.body?.token);
    if (!admin) return res.redirect(303, "/login?error=sso");
    setSessionCookie(req, res, createSessionToken(admin));
    return res.redirect(303, "/dashboard");
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (req, res) => {
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

module.exports = router;
