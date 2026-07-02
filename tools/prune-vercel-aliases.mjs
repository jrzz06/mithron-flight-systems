#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const CANONICAL_HOST = "final-mithron-deploy.vercel.app";
const OBSOLETE_ALIASES = [
  "mithron-flight-systems-kbkbkh.vercel.app",
  "mithron-flight-systems-jrzz06-kbkbkh.vercel.app"
];

function runVercel(args) {
  return spawnSync("vercel", args, { encoding: "utf8", shell: true });
}

const list = runVercel(["alias", "ls"]);
if (list.status !== 0) {
  console.error((list.stderr ?? list.stdout ?? "").trim());
  process.exit(list.status ?? 1);
}

const output = list.stdout ?? "";

for (const alias of OBSOLETE_ALIASES) {
  if (!output.includes(alias)) {
    console.log(`skip ${alias} — not assigned`);
    continue;
  }

  const removed = runVercel(["alias", "remove", alias, "--yes"]);
  const output = `${removed.stdout ?? ""}${removed.stderr ?? ""}`.trim();
  if (removed.status === 0) {
    console.log(`removed ${alias}`);
    continue;
  }

  console.error(`failed to remove ${alias}: ${output}`);
  process.exit(removed.status ?? 1);
}

const remaining = runVercel(["alias", "ls"]);
const hosts = (remaining.stdout ?? "").match(/[\w-]+\.vercel\.app/g) ?? [];
const productionAliases = [...new Set(hosts)].filter((host) => !host.includes("-kbkbkh.vercel.app") || host === CANONICAL_HOST);

console.log(`canonical production URL: https://${CANONICAL_HOST}`);
console.log(`public aliases remaining: ${productionAliases.join(", ") || CANONICAL_HOST}`);
