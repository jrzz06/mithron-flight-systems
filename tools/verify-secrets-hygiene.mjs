#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const envLocal = join(root, ".env.local");
let exitCode = 0;

function fail(message) {
  console.error(`[secrets-hygiene] FAIL: ${message}`);
  exitCode = 1;
}

function pass(message) {
  console.log(`[secrets-hygiene] OK: ${message}`);
}

try {
  const ignoreCheck = execSync("git check-ignore -v .env.local", { cwd: root, encoding: "utf8" }).trim();
  if (ignoreCheck) {
    pass(`.env.local is gitignored (${ignoreCheck})`);
  } else {
    fail(".env.local is not ignored by git");
  }
} catch {
  fail("git check-ignore failed — is this a git repository?");
}

try {
  const history = execSync("git log --all --full-history --oneline -- .env.local", {
    cwd: root,
    encoding: "utf8"
  }).trim();
  if (history) {
    fail(".env.local appears in git history — rotate all secrets immediately");
    console.error(history);
  } else {
    pass(".env.local has never been committed");
  }
} catch {
  fail("unable to inspect .env.local git history");
}

if (existsSync(envLocal)) {
  pass(".env.local exists locally (expected for development only)");
} else {
  console.warn("[secrets-hygiene] WARN: .env.local not found — use .env.example as a template");
}

if (process.env.NODE_ENV === "production" && existsSync(envLocal)) {
  console.warn(
    "[secrets-hygiene] WARN: .env.local present in production runtime — prefer platform env vars (Vercel/Railway/Supabase)"
  );
}

process.exit(exitCode);
