import crypto from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";

const sourcePath = process.argv[2] || "/opt/zdeutsch/app/.env";
const targetPath = process.argv[3] || "/opt/zdeutsch/admin/shared/.env";

function parse(path) {
  return fs.existsSync(path) ? dotenv.parse(fs.readFileSync(path)) : {};
}

function upsert(path, name, value) {
  const current = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
  const line = `${name}=${JSON.stringify(value)}`;
  const expression = new RegExp(`^${name}=.*$`, "m");
  const next = expression.test(current)
    ? current.replace(expression, line)
    : `${current.replace(/\s*$/, "")}\n${line}\n`;
  fs.writeFileSync(path, next, { mode: 0o600 });
}

const source = parse(sourcePath);
const target = parse(targetPath);
const secret = source.DASHBOARD_SSO_SECRET
  || target.DASHBOARD_SSO_SECRET
  || crypto.randomBytes(48).toString("base64url");

if (secret.length < 32) throw new Error("The existing DASHBOARD_SSO_SECRET is too short.");
upsert(sourcePath, "DASHBOARD_SSO_SECRET", secret);
upsert(targetPath, "DASHBOARD_SSO_SECRET", secret);
console.log("Shared dashboard SSO secret is configured.");
