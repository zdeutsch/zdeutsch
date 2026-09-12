import crypto from "node:crypto";
import fs from "node:fs";
import dotenv from "dotenv";

const sourcePath = process.argv[2] || "/opt/zdeutsch/app/.env";
const targetPath = process.argv[3] || "/opt/zdeutsch/admin/shared/.env";
const source = dotenv.parse(fs.readFileSync(sourcePath));
const existing = fs.existsSync(targetPath) ? dotenv.parse(fs.readFileSync(targetPath)) : {};

const copiedNames = [
  "MYSQL_HOST",
  "MYSQL_PORT",
  "MYSQL_USER",
  "MYSQL_PASSWORD",
  "MYSQL_DATABASE",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_ORG",
  "OPENAI_PROJECT",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME"
];

const output = {
  NODE_ENV: "production",
  HOST: "127.0.0.1",
  PORT: "3080",
  TRUST_PROXY_HOPS: "1",
  DASHBOARD_AUTH_REQUIRED: "true",
  DASHBOARD_SESSION_SECRET: existing.DASHBOARD_SESSION_SECRET || crypto.randomBytes(48).toString("base64url"),
  ZDEUTSCH_GIT_REMOTE: "git@github.com:zdeutsch/zdeutsch.git",
  ZDEUTSCH_GIT_SSH_KEY: "/opt/zdeutsch/admin/shared/git/id_ed25519"
};

copiedNames.forEach((name) => {
  if (source[name] !== undefined && source[name] !== "") output[name] = source[name];
});

const serialized = Object.entries(output)
  .map(([name, value]) => `${name}=${JSON.stringify(String(value))}`)
  .join("\n");
fs.writeFileSync(targetPath, `${serialized}\n`, { mode: 0o600 });
console.log(`Prepared ${targetPath} with ${Object.keys(output).length} settings.`);
