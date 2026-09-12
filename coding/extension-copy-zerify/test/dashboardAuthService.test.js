const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const {
  ADMIN_ROLE,
  authenticateAdmin,
  createSessionToken,
  exchangeSsoToken,
  isEligibleAdmin,
  resetPoolForTests,
  SSO_AUDIENCE,
  verifySsoToken,
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

function createSsoToken(payload, ssoSecret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", ssoSecret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

test("SSO accepts one short-lived admin handoff and rejects replay", async () => {
  resetPoolForTests();
  const now = Date.parse("2026-09-12T20:00:00Z");
  const nowSeconds = Math.floor(now / 1000);
  const ssoSecret = "separate-sso-secret-with-at-least-thirty-two-characters";
  const token = createSsoToken({
    sub: "ADMIN@ZDEUTSCH.APP",
    role: ADMIN_ROLE,
    aud: SSO_AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + 60,
    nonce: "unique-handoff"
  }, ssoSecret);
  const findUser = async () => ({ email: "admin@zdeutsch.app", role: ADMIN_ROLE, is_active: 1 });

  assert.equal(verifySsoToken(token, { secret: ssoSecret, now }).email, "admin@zdeutsch.app");
  assert.deepEqual(await exchangeSsoToken(token, { secret: ssoSecret, now, findUser }), {
    email: "admin@zdeutsch.app",
    role: ADMIN_ROLE
  });
  assert.equal(await exchangeSsoToken(token, { secret: ssoSecret, now, findUser }), null);
});

test("SSO rejects the wrong audience, excessive lifetime, and inactive admins", async () => {
  resetPoolForTests();
  const now = Date.parse("2026-09-12T20:00:00Z");
  const nowSeconds = Math.floor(now / 1000);
  const ssoSecret = "separate-sso-secret-with-at-least-thirty-two-characters";
  const tokenFor = (overrides) => createSsoToken({
    sub: "admin@zdeutsch.app",
    role: ADMIN_ROLE,
    aud: SSO_AUDIENCE,
    iat: nowSeconds,
    exp: nowSeconds + 60,
    nonce: crypto.randomUUID(),
    ...overrides
  }, ssoSecret);

  assert.equal(verifySsoToken(tokenFor({ aud: "another-app" }), { secret: ssoSecret, now }), null);
  assert.equal(verifySsoToken(tokenFor({ exp: nowSeconds + 121 }), { secret: ssoSecret, now }), null);
  assert.equal(await exchangeSsoToken(tokenFor({}), {
    secret: ssoSecret,
    now,
    findUser: async () => ({ email: "admin@zdeutsch.app", role: ADMIN_ROLE, is_active: 0 })
  }), null);
});
