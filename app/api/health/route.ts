import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/lib/env";

export const dynamic = "force-dynamic";

function isInternalHealthRequest(request: Request) {
  const secret = process.env.HEALTH_CHECK_SECRET?.trim() ?? "";
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

async function pingSupabase(timeoutMs = 1000) {
  const config = getSupabasePublicConfig();
  if (!config.configured) return { ok: false, detail: config.message };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${config.url}/rest/v1/`, {
      headers: {
        apikey: config.publishableKey,
        Authorization: `Bearer ${config.publishableKey}`
      },
      cache: "no-store",
      signal: controller.signal
    });
    return { ok: response.ok, detail: response.ok ? "reachable" : `${response.status}` };
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "unreachable"
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: Request) {
  const supabase = await pingSupabase();
  const status = supabase.ok ? "ok" : "degraded";

  if (!isInternalHealthRequest(request)) {
    return NextResponse.json({ status }, { status: supabase.ok ? 200 : 503 });
  }

  const paymentsConfigured = Boolean(process.env.PAYMENT_PROVIDER?.trim());
  const emailConfigured = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());

  return NextResponse.json({
    status,
    supabase,
    payments: { configured: paymentsConfigured, provider: process.env.PAYMENT_PROVIDER ?? null },
    email: { configured: emailConfigured },
    build_id: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.BUILD_ID ?? "local"
  }, { status: supabase.ok ? 200 : 503 });
}
