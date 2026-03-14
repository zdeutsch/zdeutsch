const AppError = require("../utils/appError");
const {
  execute,
  queryAll,
  queryOne,
  withShareDbRead,
  withShareDbWrite
} = require("../repositories/shareRepository");

const SHARE_UNLOCK_THRESHOLD = 2;
const SHARE_GATE_DELAY_HOURS = 24;
const BOT_USER_AGENT_PATTERN = /bot|crawler|spider|preview|facebookexternalhit|slackbot|discordbot|telegrambot|whatsapp|meta-external|linkedinbot|skypeuripreview|python-requests|curl/i;

function normalizeUserId(value, fieldName = "userId") {
  const normalized = String(value || "").trim();
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(normalized)) {
    throw new AppError(`${fieldName} must be a valid user ID`, 400);
  }
  return normalized;
}

function normalizePath(value) {
  return String(value || "")
    .trim()
    .slice(0, 300);
}

function normalizeUserAgent(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function normalizeIpAddress(value) {
  return String(value || "")
    .trim()
    .slice(0, 120);
}

function isBotUserAgent(userAgent) {
  return BOT_USER_AGENT_PATTERN.test(String(userAgent || ""));
}

function getNowIso() {
  return new Date().toISOString();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function upsertUserRecord(db, {
  userId,
  pathname,
  ipAddress,
  userAgent,
  seenAt
}) {
  const existing = queryOne(
    db,
    `
      SELECT
        user_id AS userId,
        last_seen_path AS lastSeenPath,
        last_ip_address AS lastIpAddress,
        last_user_agent AS lastUserAgent
      FROM share_users
      WHERE user_id = ?
    `,
    [userId]
  );

  if (existing) {
    execute(
      db,
      `
        UPDATE share_users
        SET
          last_seen_at = ?,
          last_seen_path = ?,
          last_ip_address = ?,
          last_user_agent = ?
        WHERE user_id = ?
      `,
      [
        seenAt,
        pathname || existing.lastSeenPath || "",
        ipAddress || existing.lastIpAddress || "",
        userAgent || existing.lastUserAgent || "",
        userId
      ]
    );
    return;
  }

  execute(
    db,
    `
      INSERT INTO share_users (
        user_id,
        created_at,
        first_seen_at,
        last_seen_at,
        first_seen_path,
        last_seen_path,
        last_ip_address,
        last_user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [userId, seenAt, seenAt, seenAt, pathname, pathname, ipAddress, userAgent]
  );
}

function getUserStatusSnapshot(db, userId) {
  const row = queryOne(
    db,
    `
      SELECT COUNT(*) AS uniqueVisitors
      FROM share_referrals
      WHERE referrer_user_id = ?
    `,
    [userId]
  );

  const uniqueVisitors = toNumber(row?.uniqueVisitors);
  return {
    userId,
    uniqueVisitors,
    unlockThreshold: SHARE_UNLOCK_THRESHOLD,
    gateDelayHours: SHARE_GATE_DELAY_HOURS,
    unlocked: uniqueVisitors >= SHARE_UNLOCK_THRESHOLD
  };
}

async function getShareStatus({
  userId,
  pathname = "",
  ipAddress = "",
  userAgent = ""
}) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedPath = normalizePath(pathname);
  const normalizedIp = normalizeIpAddress(ipAddress);
  const normalizedUserAgent = normalizeUserAgent(userAgent);
  const seenAt = getNowIso();

  return withShareDbWrite((db) => {
    upsertUserRecord(db, {
      userId: normalizedUserId,
      pathname: normalizedPath,
      ipAddress: normalizedIp,
      userAgent: normalizedUserAgent,
      seenAt
    });
    return getUserStatusSnapshot(db, normalizedUserId);
  });
}

async function registerShareVisit({
  referrerUserId,
  visitorUserId,
  pathname = "",
  ipAddress = "",
  userAgent = ""
}) {
  const normalizedReferrerUserId = normalizeUserId(referrerUserId, "referrerUserId");
  const normalizedVisitorUserId = normalizeUserId(visitorUserId, "visitorUserId");
  const normalizedPath = normalizePath(pathname);
  const normalizedIp = normalizeIpAddress(ipAddress);
  const normalizedUserAgent = normalizeUserAgent(userAgent);
  const seenAt = getNowIso();

  if (normalizedReferrerUserId === normalizedVisitorUserId) {
    return withShareDbWrite((db) => {
      upsertUserRecord(db, {
        userId: normalizedVisitorUserId,
        pathname: normalizedPath,
        ipAddress: normalizedIp,
        userAgent: normalizedUserAgent,
        seenAt
      });
      return {
        counted: false,
        reason: "self_referral",
        ...getUserStatusSnapshot(db, normalizedReferrerUserId)
      };
    });
  }

  if (isBotUserAgent(normalizedUserAgent)) {
    return {
      counted: false,
      reason: "bot_ignored",
      ...(await getShareStatus({
        userId: normalizedReferrerUserId
      }))
    };
  }

  return withShareDbWrite((db) => {
    upsertUserRecord(db, {
      userId: normalizedVisitorUserId,
      pathname: normalizedPath,
      ipAddress: normalizedIp,
      userAgent: normalizedUserAgent,
      seenAt
    });

    upsertUserRecord(db, {
      userId: normalizedReferrerUserId,
      pathname: "",
      ipAddress: "",
      userAgent: "",
      seenAt
    });

    const existing = queryOne(
      db,
      `
        SELECT id, visit_count AS visitCount
        FROM share_referrals
        WHERE referrer_user_id = ?
          AND visitor_user_id = ?
      `,
      [normalizedReferrerUserId, normalizedVisitorUserId]
    );

    if (existing) {
      execute(
        db,
        `
          UPDATE share_referrals
          SET
            last_seen_at = ?,
            landing_path = ?,
            last_ip_address = ?,
            last_user_agent = ?,
            visit_count = visit_count + 1
          WHERE id = ?
        `,
        [seenAt, normalizedPath, normalizedIp, normalizedUserAgent, existing.id]
      );
    } else {
      execute(
        db,
        `
          INSERT INTO share_referrals (
            referrer_user_id,
            visitor_user_id,
            first_seen_at,
            last_seen_at,
            landing_path,
            visit_count,
            first_ip_address,
            last_ip_address,
            first_user_agent,
            last_user_agent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          normalizedReferrerUserId,
          normalizedVisitorUserId,
          seenAt,
          seenAt,
          normalizedPath,
          1,
          normalizedIp,
          normalizedIp,
          normalizedUserAgent,
          normalizedUserAgent
        ]
      );
    }

    return {
      counted: !existing,
      reason: existing ? "already_counted" : "counted",
      ...getUserStatusSnapshot(db, normalizedReferrerUserId)
    };
  });
}

function maskIpAddress(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  if (raw.includes(".")) {
    const parts = raw.split(".");
    return `${parts.slice(0, 2).join(".")}.x.x`;
  }
  if (raw.includes(":")) {
    const parts = raw.split(":").filter(Boolean);
    return `${parts.slice(0, 2).join(":")}:xxxx`;
  }
  return raw;
}

async function getShareDashboardOverview() {
  return withShareDbRead((db) => {
    const totalUsersRow = queryOne(db, "SELECT COUNT(*) AS totalUsers FROM share_users");
    const totalReferralsRow = queryOne(db, "SELECT COUNT(*) AS totalReferrals FROM share_referrals");
    const unlockedUsersRow = queryOne(
      db,
      `
        SELECT COUNT(*) AS unlockedUsers
        FROM (
          SELECT referrer_user_id
          FROM share_referrals
          GROUP BY referrer_user_id
          HAVING COUNT(*) >= ?
        ) unlocked
      `,
      [SHARE_UNLOCK_THRESHOLD]
    );

    const topSharers = queryAll(
      db,
      `
        SELECT
          referrer_user_id AS userId,
          COUNT(*) AS uniqueVisitors,
          MAX(last_seen_at) AS lastVisitAt
        FROM share_referrals
        GROUP BY referrer_user_id
        ORDER BY uniqueVisitors DESC, lastVisitAt DESC
        LIMIT 20
      `
    ).map((row) => ({
      userId: row.userId,
      uniqueVisitors: toNumber(row.uniqueVisitors),
      unlocked: toNumber(row.uniqueVisitors) >= SHARE_UNLOCK_THRESHOLD,
      lastVisitAt: row.lastVisitAt || ""
    }));

    const recentReferrals = queryAll(
      db,
      `
        SELECT
          referrer_user_id AS referrerUserId,
          visitor_user_id AS visitorUserId,
          landing_path AS landingPath,
          visit_count AS visitCount,
          first_seen_at AS firstSeenAt,
          last_seen_at AS lastSeenAt,
          last_ip_address AS lastIpAddress
        FROM share_referrals
        ORDER BY last_seen_at DESC
        LIMIT 40
      `
    ).map((row) => ({
      referrerUserId: row.referrerUserId,
      visitorUserId: row.visitorUserId,
      landingPath: row.landingPath || "/",
      visitCount: toNumber(row.visitCount),
      firstSeenAt: row.firstSeenAt || "",
      lastSeenAt: row.lastSeenAt || "",
      lastIpAddress: maskIpAddress(row.lastIpAddress)
    }));

    return {
      totals: {
        totalUsers: toNumber(totalUsersRow?.totalUsers),
        totalReferrals: toNumber(totalReferralsRow?.totalReferrals),
        unlockedUsers: toNumber(unlockedUsersRow?.unlockedUsers),
        unlockThreshold: SHARE_UNLOCK_THRESHOLD
      },
      topSharers,
      recentReferrals
    };
  });
}

module.exports = {
  getShareDashboardOverview,
  getShareStatus,
  registerShareVisit,
  SHARE_GATE_DELAY_HOURS,
  SHARE_UNLOCK_THRESHOLD
};
