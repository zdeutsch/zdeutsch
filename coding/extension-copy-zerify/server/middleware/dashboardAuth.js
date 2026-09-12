const { adminFromRequest, authRequired } = require("../services/dashboardAuthService");

async function requireDashboardAdmin(req, res, next) {
  if (!authRequired()) return next();
  try {
    const admin = await adminFromRequest(req);
    if (admin) {
      req.dashboardAdmin = admin;
      return next();
    }
    if (req.baseUrl === "/api") {
      return res.status(401).json({ ok: false, message: "Anmeldung erforderlich" });
    }
    const nextPath = req.originalUrl.startsWith("/") ? req.originalUrl : "/dashboard";
    return res.redirect(302, `/login?next=${encodeURIComponent(nextPath)}`);
  } catch (error) {
    return next(error);
  }
}

module.exports = { requireDashboardAdmin };
