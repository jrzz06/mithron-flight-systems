import { NextResponse } from "next/server";
import { safeBearerEquals } from "@/lib/auth/timing-safe-bearer";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { dispatchEmailNotification } from "@/services/email/resend";

export async function POST(request: Request) {
  const secret = process.env.NOTIFICATION_DISPATCH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Notification dispatch is not configured." }, { status: 503 });
  }
  if (!safeBearerEquals(request, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const config = assertSupabaseAdminConfig(process.env);
  const response = await fetch(
    `${config.url}/rest/v1/notifications?select=id,title,body,recipient_id,status,metadata,payload&status=eq.unread&order=created_at.asc&limit=50`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return NextResponse.json({ ok: false, dispatched: 0, failed: 0, total: 0 }, { status: 500 });
  }

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  let dispatched = 0;
  let failed = 0;

  for (const row of rows) {
    const metadata = row.metadata as Record<string, unknown> | null;
    const payload = row.payload as Record<string, unknown> | null;
    const email = typeof metadata?.recipient_email === "string"
      ? metadata.recipient_email
      : typeof payload?.recipient_email === "string"
        ? payload.recipient_email
        : null;
    if (!email) {
      failed += 1;
      console.warn("[notifications/dispatch] skipped row without recipient email", { id: row.id });
      continue;
    }
    try {
      await dispatchEmailNotification({
        recipientEmail: email,
        title: String(row.title ?? "Mithron notification"),
        body: String(row.body ?? "")
      });
      const patchResponse = await fetch(`${config.url}/rest/v1/notifications?id=eq.${row.id}`, {
        method: "PATCH",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "sent", updated_at: new Date().toISOString() })
      });
      if (!patchResponse.ok) {
        throw new Error(`PATCH failed: ${patchResponse.status}`);
      }
      dispatched += 1;
    } catch (error) {
      failed += 1;
      console.error("[notifications/dispatch] row dispatch failed", {
        id: row.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return NextResponse.json({
    ok: failed === 0 || dispatched > 0,
    dispatched,
    failed,
    total: rows.length
  });
}
