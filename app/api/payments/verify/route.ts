import { NextResponse } from "next/server";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { requireClientAuditToken } from "@/lib/api/require-client-audit-token";
import { createClient } from "@/lib/server";
import { fetchAdminRecordsByColumn } from "@/services/admin-actions";
import { logPaymentError, logPaymentEvent } from "@/services/payments/logger";
import { applyPaymentEvent } from "@/services/payments/confirm-payment";
import { isPaymentProviderId, verifyClientPayment } from "@/services/payments/gateway";
import type { PaymentProviderId } from "@/services/payments/types";

type VerifyBody = {
  orderId?: string;
  provider?: string;
  email?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  cashfreeOrderId?: string;
};

async function assertOrderAccess(input: {
  orderId: string;
  userId: string | null;
  email?: string;
  request: Request;
}) {
  const orders = await fetchAdminRecordsByColumn("orders", "id", input.orderId);
  const order = orders[0];
  if (!order) return { ok: false as const, status: 404, error: "Order not found." };

  if (input.userId) {
    const ownerId = typeof order.created_by_user_id === "string" ? order.created_by_user_id : null;
    if (ownerId && ownerId !== input.userId) {
      return { ok: false as const, status: 404, error: "Order not found." };
    }
    return { ok: true as const, order };
  }

  const audit = requireClientAuditToken(input.request);
  if (!audit.ok) {
    return { ok: false as const, status: 401, error: audit.error };
  }

  const orderEmail = String(order.customer_email ?? "").trim().toLowerCase();
  const requestEmail = input.email?.trim().toLowerCase() ?? "";
  if (!requestEmail || orderEmail !== requestEmail) {
    return { ok: false as const, status: 403, error: "Email does not match order." };
  }

  return { ok: true as const, order };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as VerifyBody | null;
  const orderId = body?.orderId?.trim() ?? "";
  const provider = body?.provider?.trim().toLowerCase() ?? "";

  if (!orderId || !provider || !isPaymentProviderId(provider) || provider === "stub" || provider === "stripe") {
    return NextResponse.json({ error: "Valid orderId and payment provider are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  const rateKey = userId ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkDistributedRateLimit(`payments-verify:${rateKey}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const access = await assertOrderAccess({
    orderId,
    userId,
    email: body?.email,
    request
  });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const payments = await fetchAdminRecordsByColumn("payments", "order_id", orderId);
  const payment = payments.find((row) => String(row.provider ?? "") === provider && String(row.status ?? "") !== "failed");
  if (!payment?.provider_intent_id) {
    return NextResponse.json({ error: "No active payment session found for this order." }, { status: 404 });
  }

  if (String(payment.status ?? "") === "succeeded") {
    return NextResponse.json({ ok: true, paid: true, paymentStatus: "succeeded" });
  }

  try {
    let event;
    if (provider === "razorpay") {
      const intentId = body?.razorpayOrderId?.trim() || String(payment.provider_intent_id);
      const paymentId = body?.razorpayPaymentId?.trim() ?? "";
      const signature = body?.razorpaySignature?.trim() ?? "";
      if (!paymentId || !signature) {
        return NextResponse.json({ error: "Razorpay payment verification fields are required." }, { status: 400 });
      }
      event = await verifyClientPayment("razorpay", {
        intentId,
        paymentId,
        signature,
        orderId
      });
    } else {
      const intentId = body?.cashfreeOrderId?.trim() || String(payment.provider_intent_id);
      event = await verifyClientPayment("cashfree", { intentId, orderId });
    }

    if (event.status !== "succeeded") {
      return NextResponse.json({
        ok: true,
        paid: false,
        paymentStatus: event.status
      });
    }

    const result = await applyPaymentEvent({
      provider: provider as PaymentProviderId,
      event,
      source: "verify",
      eventId: `verify:${provider}:${event.intentId}:${event.paymentId ?? "unknown"}`
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }

    logPaymentEvent("payment_verified_via_api", { orderId, provider, source: "verify" });
    return NextResponse.json({
      ok: true,
      paid: result.status === "succeeded",
      paymentStatus: result.status,
      skipped: result.skipped ?? false
    });
  } catch (error) {
    logPaymentError("payment_verify_failed", error, { orderId, provider });
    const message = error instanceof Error ? error.message : "Payment verification failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
