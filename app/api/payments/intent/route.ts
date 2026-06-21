import { NextResponse } from "next/server";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { createClient } from "@/lib/server";
import { createAdminRecord, fetchAdminRecordsByColumn } from "@/services/admin-actions";
import { createPaymentIntent } from "@/services/payments/gateway";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { orderId?: string; email?: string } | null;
  if (!body?.orderId || !body.email) {
    return NextResponse.json({ error: "orderId and email are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rateKey = userId ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkDistributedRateLimit(`payments-intent:${rateKey}`, 10, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const orders = await fetchAdminRecordsByColumn("orders", "id", body.orderId);
  const order = orders[0];
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (String(order.created_by_user_id ?? "") !== userId) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const existingPayments = await fetchAdminRecordsByColumn("payments", "order_id", body.orderId);
  const activePayment = existingPayments.find((row) => !["failed", "cancelled"].includes(String(row.status ?? "")));
  if (activePayment) {
    return NextResponse.json({
      paymentId: activePayment.id ?? null,
      intentId: activePayment.provider_intent_id ?? null,
      checkoutUrl: null,
      clientSecret: null
    });
  }

  const intent = await createPaymentIntent({
    orderId: body.orderId,
    amount: Number(order.total ?? 0),
    currency: String(order.currency ?? "INR"),
    customerEmail: body.email
  });

  const payment = await createAdminRecord(
    "payments",
    {
      order_id: body.orderId,
      provider: process.env.PAYMENT_PROVIDER ?? "stub",
      provider_intent_id: intent.intentId,
      amount: Number(order.total ?? 0),
      currency: String(order.currency ?? "INR"),
      status: "requires_payment"
    },
    userId
  );

  return NextResponse.json({
    paymentId: payment.id ?? null,
    intentId: intent.intentId,
    checkoutUrl: intent.checkoutUrl ?? null,
    clientSecret: intent.clientSecret ?? null
  });
}
