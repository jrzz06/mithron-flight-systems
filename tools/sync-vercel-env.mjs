#!/usr/bin/env node
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env.local");
const targets = ["production", "preview", "development"];

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

function addEnv(name, value, environment) {
  const tmpPath = join(tmpdir(), `vercel-env-${process.pid}-${name}-${environment}.txt`);
  writeFileSync(tmpPath, value, "utf8");
  const command =
    process.platform === "win32"
      ? `type "${tmpPath}" | vercel env add ${name} ${environment}`
      : `vercel env add ${name} ${environment} < "${tmpPath}"`;
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    encoding: "utf8"
  });
  try {
    unlinkSync(tmpPath);
  } catch {
    // ignore
  }
  if (result.status === 0) {
    console.log(`set ${name} (${environment})`);
    return;
  }
  const stderr = `${result.stderr ?? ""}${result.stdout ?? ""}`;
  if (/already exists/i.test(stderr)) {
    writeFileSync(tmpPath, value, "utf8");
    const updateCommand =
      process.platform === "win32"
        ? `type "${tmpPath}" | vercel env update ${name} ${environment}`
        : `vercel env update ${name} ${environment} < "${tmpPath}"`;
    const update = spawnSync(updateCommand, {
      cwd: root,
      shell: true,
      encoding: "utf8"
    });
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore
    }
    if (update.status === 0) {
      console.log(`updated ${name} (${environment})`);
      return;
    }
    console.error(`failed to update ${name} (${environment}): ${update.stderr || update.stdout}`);
    process.exitCode = 1;
    return;
  }
  console.error(`failed to set ${name} (${environment}): ${stderr}`);
  process.exitCode = 1;
}

const local = parseEnvFile(envPath);
const secret = randomBytes(32).toString("hex");

const values = {
  NEXT_PUBLIC_SUPABASE_URL: local.get("NEXT_PUBLIC_SUPABASE_URL") ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY:
    local.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? local.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    local.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ?? local.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") ?? "",
  SUPABASE_SERVICE_ROLE_KEY: local.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  MITHRON_ASSET_UPLOAD_TOKEN: local.get("MITHRON_ASSET_UPLOAD_TOKEN") ?? "",
  NEXT_PUBLIC_STOREFRONT_GUEST_ONLY: local.get("NEXT_PUBLIC_STOREFRONT_GUEST_ONLY") ?? "false",
  AUTH_AUDIT_CLIENT_SECRET:
    local.get("AUTH_AUDIT_CLIENT_SECRET") && !local.get("AUTH_AUDIT_CLIENT_SECRET")?.includes("change-me")
      ? local.get("AUTH_AUDIT_CLIENT_SECRET")
      : secret,
  NEXT_PUBLIC_SITE_URL: "https://final-mithron-deploy.vercel.app",
  EMAIL_FROM: "Mithron <noreply@mithron.com>",
  RESEND_API_KEY: "re_deploy_placeholder_rotate_before_launch",
  PAYMENT_PROVIDER: "razorpay",
  RAZORPAY_KEY_ID: "rzp_deploy_placeholder",
  RAZORPAY_KEY_SECRET: "deploy_placeholder_secret",
  RAZORPAY_WEBHOOK_SECRET: "deploy_placeholder_webhook",
  PAYMENT_EXPIRE_SECRET: randomBytes(24).toString("hex"),
  CRON_SECRET: randomBytes(24).toString("hex"),
  NOTIFICATION_DISPATCH_SECRET: randomBytes(24).toString("hex"),
  UPSTASH_REDIS_REST_URL: "https://deploy-placeholder.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: randomBytes(24).toString("hex"),
  HEALTH_CHECK_SECRET: randomBytes(24).toString("hex")
};

for (const [key, value] of Object.entries(values)) {
  if (!value) {
    console.error(`missing value for ${key}`);
    process.exitCode = 1;
    continue;
  }
  for (const environment of targets) {
    addEnv(key, value, environment);
  }
}

console.log("Vercel env sync complete.");
