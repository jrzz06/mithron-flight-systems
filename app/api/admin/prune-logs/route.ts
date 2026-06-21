import { NextResponse } from "next/server";
import { safeBearerEquals } from "@/lib/auth/timing-safe-bearer";
import { assertSupabaseAdminConfig } from "@/lib/env";

const DEFAULT_RETENTION_DAYS = 90;
const MIN_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 365;

function parseRetentionDays(value: string | null) {
  if (!value?.trim()) return DEFAULT_RETENTION_DAYS;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return DEFAULT_RETENTION_DAYS;
  return Math.min(MAX_RETENTION_DAYS, Math.max(MIN_RETENTION_DAYS, parsed));
}

function isAuthorized(request: Request) {
  return safeBearerEquals(request, process.env.CRON_SECRET);
}

async function runPrune(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const retentionDays = parseRetentionDays(url.searchParams.get("retention_days"));
  const config = assertSupabaseAdminConfig(process.env);
  const response = await fetch(`${config.url}/rest/v1/rpc/prune_observability_logs`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ retention_days: retentionDays }),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[admin/prune-logs] prune_observability_logs failed:", response.status, text);
    return NextResponse.json({ error: "Failed to prune observability logs." }, { status: 500 });
  }

  const result = await response.json().catch(() => null);
  return NextResponse.json({ ok: true, retentionDays, result });
}

export async function GET(request: Request) {
  return runPrune(request);
}

export async function POST(request: Request) {
  return runPrune(request);
}
