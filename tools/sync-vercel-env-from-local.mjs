#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const envPath = resolve(root, ".env.local");
const environment = process.argv[2] ?? "production";

const KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "MITHRON_ASSET_UPLOAD_TOKEN",
  "NEXT_PUBLIC_STOREFRONT_GUEST_ONLY",
  "AUTH_AUDIT_CLIENT_SECRET",
  "PAYMENT_PROVIDER",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "CASHFREE_APP_ID",
  "CASHFREE_SECRET_KEY",
  "CASHFREE_ENV",
  "CASHFREE_WEBHOOK_SECRET",
  "GEMINI_API_KEY",
  "GEMINI_TEXT_MODEL",
  "GEMINI_IMAGE_MODEL",
  "BREVO_SMTP_HOST",
  "BREVO_SMTP_PORT",
  "BREVO_SMTP_LOGIN",
  "BREVO_SMTP_KEY",
  "BREVO_API_KEY",
  "BREVO_FROM_EMAIL",
  "BREVO_FROM_NAME"
];

function parseEnvFile(path) {
  const entries = new Map();
  if (!existsSync(path)) return entries;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    entries.set(key, value);
  }
  return entries;
}

function upsertEnv(name, value, targetEnvironment) {
  const update = spawnSync(
    "vercel",
    ["env", "update", name, targetEnvironment, "--yes", "--value", value],
    { cwd: root, encoding: "utf8", shell: true }
  );
  if (update.status === 0) {
    console.log(`updated ${name} (${targetEnvironment})`);
    return;
  }

  const add = spawnSync(
    "vercel",
    ["env", "add", name, targetEnvironment, "--yes", "--value", value],
    { cwd: root, encoding: "utf8", shell: true }
  );
  if (add.status === 0) {
    console.log(`set ${name} (${targetEnvironment})`);
    return;
  }
  const output = `${update.stderr ?? ""}${update.stdout ?? ""}${add.stderr ?? ""}${add.stdout ?? ""}`;
  if (/already been added to all environments/i.test(output)) {
    console.log(`unchanged ${name} (${targetEnvironment})`);
    return;
  }
  console.error(`failed to upsert ${name} (${targetEnvironment}): ${output.trim()}`);
  process.exitCode = 1;
}

const local = parseEnvFile(envPath);
const overrides = {
  NEXT_PUBLIC_SITE_URL: "https://final-mithron-deploy.vercel.app"
};

for (const [key, value] of Object.entries(overrides)) {
  if (value) upsertEnv(key, value, environment);
}

for (const key of KEYS) {
  const value = local.get(key)?.trim();
  if (!value) {
    console.log(`skip ${key} (${environment}) — empty in .env.local`);
    continue;
  }
  upsertEnv(key, value, environment);
}

console.log(`Vercel env sync from .env.local complete for ${environment}.`);
