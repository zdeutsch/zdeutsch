const express = require("express");
const asyncHandler = require("../../middleware/asyncHandler");
const shareCors = require("../../middleware/shareCors");
const AppError = require("../../utils/appError");
const {
  authenticateShareAdmin,
  clearShareAdminSessionCookie,
  isShareAdminAuthenticated,
  requireShareAdminAuth,
  setShareAdminSessionCookie
} = require("../../services/shareAdminAuthService");
const {
  getShareDashboardOverview,
  getShareStatus,
  registerShareVisit
} = require("../../services/shareService");

const router = express.Router();

router.use("/status", shareCors);
router.use("/visit", shareCors);

function getRequestMeta(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "");
  const ipAddress = forwarded.split(",")[0].trim() || req.socket?.remoteAddress || "";
  return {
    pathname: String(req.body?.path || req.query?.path || req.path || "").trim(),
    ipAddress,
    userAgent: String(req.get("user-agent") || "")
  };
}

router.get("/status", asyncHandler(async (req, res) => {
  const userId = String(req.query.userId || "").trim();
  if (!userId) {
    throw new AppError("userId is required", 400);
  }

  const payload = await getShareStatus({
    userId,
    ...getRequestMeta(req)
  });

  res.json({
    ok: true,
    ...payload
  });
}));

router.post("/visit", asyncHandler(async (req, res) => {
  const referrerUserId = String(req.body?.referrerUserId || "").trim();
  const visitorUserId = String(req.body?.visitorUserId || "").trim();
  if (!referrerUserId || !visitorUserId) {
    throw new AppError("referrerUserId and visitorUserId are required", 400);
  }

  const payload = await registerShareVisit({
    referrerUserId,
    visitorUserId,
    ...getRequestMeta(req)
  });

  res.json({
    ok: true,
    ...payload
  });
}));

router.get("/admin/session", (req, res) => {
  res.json({
    ok: true,
    authenticated: isShareAdminAuthenticated(req)
  });
});

router.post("/admin/login", asyncHandler(async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!authenticateShareAdmin(username, password)) {
    throw new AppError("Invalid username or password", 401);
  }

  setShareAdminSessionCookie(req, res);
  res.json({
    ok: true,
    authenticated: true
  });
}));

router.post("/admin/logout", (req, res) => {
  clearShareAdminSessionCookie(req, res);
  res.json({
    ok: true,
    authenticated: false
  });
});

router.get("/admin/overview", requireShareAdminAuth, asyncHandler(async (req, res) => {
  const payload = await getShareDashboardOverview();
  res.json({
    ok: true,
    ...payload
  });
}));

module.exports = router;
