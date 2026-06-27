import { NextResponse } from "next/server";
import { authorizeBearerSecret } from "@/lib/api/bearer-auth";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { mergePaymentLifecycleMetadata } from "@/lib/orders/payment-lifecycle";
import { fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";
import { releaseCheckoutStock } from "@/services/checkout-stock";
import { logPaymentEvent } from "@/services/payments/logger";

const PENDING_MAX_MINUTES = 30;

export async function POST(request: Request) {
  const auth = await authorizeBearerSecret(request, process.env.PAYMENT_EXPIRE_SECRET);
  if (auth === "rate_limited") {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  if (auth === "misconfigured") {
    return NextResponse.json({ error: "Payment expire secret is not configured." }, { status: 503 });
  }
  if (auth === "unauthorized") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const config = assertSupabaseAdminConfig(process.env);
  const cutoff = new Date(Date.now() - PENDING_MAX_MINUTES * 60_000).toISOString();
  const response = await fetch(
    `${config.url}/rest/v1/orders?select=id,status,payment_status,metadata&status=eq.pending_payment&payment_status=eq.requires_payment&created_at=lt.${encodeURIComponent(cutoff)}&limit=100`,
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

  const rows = (await response.json()) as Array<{ id?: string; metadata?: Record<string, unknown> }>;
  let released = 0;

  for (const row of rows) {
    const orderId = String(row.id ?? "");
    if (!orderId) continue;
    try {
      await releaseCheckoutStock(orderId);

      const payments = await fetchAdminRecordsByColumn("payments", "order_id", orderId);
      for (const payment of payments) {
        if (["succeeded", "failed", "refunded"].includes(String(payment.status ?? ""))) continue;
        await updateAdminRecord(
          "payments",
          "id",
          String(payment.id),
          {
            status: "failed",
            updated_at: new Date().toISOString()
          },
          null,
          process.env,
          { allowSystemActor: true }
        );
      }

      const metadata = mergePaymentLifecycleMetadata(row.metadata ?? {}, {
        state: "EXPIRED",
        source: "expire",
        note: "Payment session expired before completion."
      });

      await updateAdminRecord(
        "orders",
        "id",
        orderId,
        {
          status: "cancelled",
          payment_status: "failed",
          metadata: {
            ...metadata,
            cancellation_reason: "payment_expired"
          },
          updated_at: new Date().toISOString()
        },
        null,
        process.env,
        { allowSystemActor: true }
      );
      released += 1;
      logPaymentEvent("payment_expired", { orderId });
    } catch (error) {
      console.error("[payments/expire-pending] failed for order", orderId, error);
    }
  }

  return NextResponse.json({ ok: true, released, scanned: rows.length });
}
