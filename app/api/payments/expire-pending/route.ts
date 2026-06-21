import { NextResponse } from "next/server";
import { safeBearerEquals } from "@/lib/auth/timing-safe-bearer";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { releaseCheckoutStock } from "@/services/checkout-stock";
import { fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";

const PENDING_MAX_MINUTES = 30;

export async function POST(request: Request) {
  if (!safeBearerEquals(request, process.env.PAYMENT_EXPIRE_SECRET)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const config = assertSupabaseAdminConfig(process.env);
  const cutoff = new Date(Date.now() - PENDING_MAX_MINUTES * 60_000).toISOString();
  const response = await fetch(
    `${config.url}/rest/v1/orders?select=id,status,payment_status&status=eq.pending_payment&payment_status=eq.requires_payment&created_at=lt.${encodeURIComponent(cutoff)}&limit=100`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to load stale orders." }, { status: 500 });
  }

  const rows = (await response.json()) as Array<{ id?: string }>;
  let released = 0;

  for (const row of rows) {
    const orderId = String(row.id ?? "");
    if (!orderId) continue;
    try {
      await releaseCheckoutStock(orderId);
      await updateAdminRecord(
        "orders",
        "id",
        orderId,
        {
          status: "cancelled",
          payment_status: "failed",
          updated_at: new Date().toISOString(),
          metadata: { cancellation_reason: "payment_expired" }
        },
        null,
        process.env,
        { allowSystemActor: true }
      );
      released += 1;
    } catch (error) {
      console.error("[payments/expire-pending] failed for order", orderId, error);
    }
  }

  return NextResponse.json({ ok: true, released, scanned: rows.length });
}
