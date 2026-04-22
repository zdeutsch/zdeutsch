const SHARE_GATE_SERVICE_ORIGIN = "https://zdeutsch.203.161.46.84.sslip.io";
const SHARE_GATE_GITHUB_APP_ORIGIN = String(process.env.SHARE_GATE_GITHUB_APP_ORIGIN || "https://example.github.io").trim();
const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(?:(?:[a-z0-9-]+\.)*localhost|127\.0\.0\.1)(?::\d+)?$/i;

function isAllowedOrigin(origin) {
  const normalizedOrigin = String(origin || "").trim();
  if (!normalizedOrigin) {
    return false;
  }
  return normalizedOrigin === SHARE_GATE_SERVICE_ORIGIN
    || normalizedOrigin === SHARE_GATE_GITHUB_APP_ORIGIN
    || LOCALHOST_ORIGIN_PATTERN.test(normalizedOrigin);
}

function shareCors(req, res, next) {
  const origin = String(req.get("origin") || "").trim();
  const allowedOrigin = isAllowedOrigin(origin) ? origin : "";

  if (allowedOrigin) {
    res.set("Access-Control-Allow-Origin", allowedOrigin);
    res.append("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set("Access-Control-Allow-Headers", req.get("access-control-request-headers") || "Content-Type");
    res.set("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    res.status(allowedOrigin ? 204 : 403).end();
    return;
  }

  next();
}

module.exports = shareCors;
