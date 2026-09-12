const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ADMIN_ROLE,
  authenticateAdmin,
  createSessionToken,
  isEligibleAdmin,
  verifySessionToken
} = require("../server/services/dashboardAuthService");

const secret = "test-secret-with-at-least-thirty-two-characters";

test("authentication accepts only active ZDeutsch admins with a matching password", async () => {
  const comparePassword = async (plain, hash) => plain === "correct" && hash === "hash";
  const findUser = async () => ({
    email: "ADMIN@ZDEUTSCH.APP",
    password_hash: "hash",
    role: ADMIN_ROLE,
    is_active: 1
  });

  assert.deepEqual(
    await authenticateAdmin(" Admin@ZDeutsch.app ", "correct", { findUser, comparePassword }),
    { email: "admin@zdeutsch.app", role: ADMIN_ROLE }
  );
  assert.equal(await authenticateAdmin("admin@zdeutsch.app", "wrong", { findUser, comparePassword }), null);
});

test("inactive users and every non-admin role are rejected", () => {
  assert.equal(isEligibleAdmin({ email: "a@b.de", role: ADMIN_ROLE, is_active: 0 }), false);
  assert.equal(isEligibleAdmin({ email: "a@b.de", role: "admin", is_active: 1 }), false);
  assert.equal(isEligibleAdmin({ email: "a@b.de", role: ADMIN_ROLE, is_active: 1 }), true);
});

test("signed admin sessions reject tampering and expiration", () => {
  const now = Date.parse("2026-09-12T10:00:00Z");
  const token = createSessionToken({ email: "admin@zdeutsch.app" }, { secret, now, ttlSeconds: 60 });
  assert.equal(verifySessionToken(token, { secret, now: now + 30_000 }).email, "admin@zdeutsch.app");
  assert.equal(verifySessionToken(`${token}x`, { secret, now }), null);
  assert.equal(verifySessionToken(token, { secret, now: now + 61_000 }), null);
});
