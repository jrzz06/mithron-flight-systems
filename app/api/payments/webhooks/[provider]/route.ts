import { NextResponse } from "next/server";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { isInternetDeployedEnvironment } from "@/lib/auth/deploy-environment";
import { safeSecretEquals } from "@/lib/auth/timing-safe-bearer";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";
import { releaseCheckoutStock } from "@/services/checkout-stock";
import { notifyAdminsAboutPaidOrder } from "@/services/enquiries";
import { appendOrderTimeline, buildOrderTimelineEntry, transitionOrderStatus } from "@/services/orders";
import { verifyPaymentWebhook } from "@/services/payments/gateway";

async function recordWebhookEvent(provider: string, eventId: string, payload: unknown) {
  const config = assertSupabaseAdminConfig(process.env);
  const response = await fetch(`${config.url}/rest/v1/payment_webhook_events`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal"
    },
    body: JSON.stringify({
      provider,
      event_id: eventId,
      payload,
      processed_at: new Date().toISOString()
    })
  });
  return response.status === 201 || response.status === 409;
}

async function createCustomerPaymentNotification(input: {
  recipientId: string | null;
  customerEmail: string | null;
  orderId: string;
  orderNumber: string;
  title?: string;
  body?: string;
  event?: string;
}) {
  const config = assertSupabaseAdminConfig(process.env);
  await fetch(`${config.url}/rest/v1/notifications`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({
      recipient_id: input.recipientId,
      channel: "customer",
      title: input.title ?? "Payment confirmed",
      body: input.body ?? `Your payment for order ${input.orderNumber} was successful. We'll notify you when it ships.`,
      status: "unread",
      priority: "normal",
      entity_table: "orders",
      entity_id: input.orderId,
      payload: {
        event: input.event ?? "payment.succeeded",
        recipient_email: input.customerEmail
      }
    })
  }).catch((error) => {
    console.error("[payments/webhook] customer notification failed", {
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error)
    });
  });
}

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  const rateKey = `${provider}:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"}`;
  const limit = await checkDistributedRateLimit(`payments-webhook:${rateKey}`, 120, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const rawBody = await request.text();
  const paymentProvider = (process.env.PAYMENT_PROVIDER ?? "stub").toLowerCase();

  if (provider === "stub" || paymentProvider === "stub") {
    if (isInternetDeployedEnvironment()) {
      return NextResponse.json({ error: "Stub payment webhooks are disabled on deployed environments." }, { status: 403 });
    }
  }

  let signature = "";
  if (paymentProvider === "razorpay") {
    signature = request.headers.get("x-razorpay-signature") ?? "";
    if (!signature) {
      return NextResponse.json({ error: "Missing Razorpay signature." }, { status: 401 });
    }
  } else if (paymentProvider === "stub" || provider === "stub") {
    // Local development only; deployed stub traffic is rejected above.
  } else {
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() ?? "";
    if (!webhookSecret) {
      return NextResponse.json({ error: "Payment webhook secret is not configured." }, { status: 503 });
    }
    signature = request.headers.get("x-payment-signature") ?? request.headers.get("x-payment-webhook-secret") ?? "";
    if (!safeSecretEquals(signature, webhookSecret)) {
      return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
    }
  }

  let payload: unknown = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  let event;
  try {
    event = await verifyPaymentWebhook({ ...payload as Record<string, unknown>, provider }, signature, rawBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook verification failed.";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const eventId = String(
    (payload as { id?: string }).id
    ?? (payload as { event?: string }).event
    ?? `${event.intentId}:${event.status}:${event.paymentId ?? "unknown"}`
  );

  const inserted = await recordWebhookEvent(provider, eventId, payload);
  if (!inserted) {
    return NextResponse.json({ ok: true, provider, status: event.status, skipped: true, reason: "duplicate_event" });
  }

  const payments = await fetchAdminRecordsByColumn("payments", "provider_intent_id", event.intentId);
  const payment = payments[0];
  if (!payment) return NextResponse.json({ ok: false }, { status: 404 });

  if (String(payment.status ?? "") === "succeeded") {
    return NextResponse.json({ ok: true, provider, status: "succeeded", skipped: true });
  }

  const paymentAmount = Number(payment.amount ?? 0);
  if (event.status === "succeeded" && Math.abs(event.amount - paymentAmount) > 0.01) {
    return NextResponse.json({ ok: false, error: "Payment amount mismatch." }, { status: 400 });
  }

  await updateAdminRecord(
    "payments",
    "id",
    String(payment.id),
    {
      status: event.status,
      provider_payment_id: event.paymentId ?? null,
      webhook_payload: event.raw as Record<string, unknown>,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    null,
    process.env,
    { allowSystemActor: true }
  );

  const orderId = String(payment.order_id ?? "");

  if (event.status === "failed") {
    if (orderId) {
      try {
        await releaseCheckoutStock(orderId);
      } catch (releaseError) {
        console.error("[payments/webhook] stock release failed", releaseError);
      }
      await updateAdminRecord(
        "orders",
        "id",
        orderId,
        {
          status: "cancelled",
          payment_status: "failed",
          updated_at: new Date().toISOString()
        },
        null,
        process.env,
        { allowSystemActor: true }
      );
    }
    return NextResponse.json({ ok: true, provider, status: event.status });
  }

  if (event.status === "succeeded") {
    const orders = await fetchAdminRecordsByColumn("orders", "id", orderId);
    const order = orders[0];
    if (order) {
      const nextStatus = transitionOrderStatus(String(order.status ?? "pending_payment"), "paid");
      await updateAdminRecord(
        "orders",
        "id",
        String(order.id),
        {
          status: nextStatus,
          payment_status: "succeeded",
          updated_at: new Date().toISOString()
        },
        null,
        process.env,
        { allowSystemActor: true }
      );

      await createCustomerPaymentNotification({
        recipientId: typeof order.created_by_user_id === "string" ? order.created_by_user_id : null,
        customerEmail: typeof order.customer_email === "string" ? order.customer_email : null,
        orderId: String(order.id),
        orderNumber: String(order.order_number ?? order.id)
      });

      await notifyAdminsAboutPaidOrder({
        orderId: String(order.id),
        orderNumber: String(order.order_number ?? order.id)
      });
    }
    return NextResponse.json({ ok: true, provider, status: event.status });
  }

  if (event.status === "refunded") {
    if (orderId) {
      try {
        await releaseCheckoutStock(orderId);
      } catch (releaseError) {
        console.error("[payments/webhook] refund stock release failed", releaseError);
      }

      const orders = await fetchAdminRecordsByColumn("orders", "id", orderId);
      const order = orders[0];
      if (order) {
        const currentStatus = String(order.status ?? "paid");
        let nextStatus: string = "refunded";
        try {
          nextStatus = transitionOrderStatus(currentStatus, "refunded");
        } catch {
          nextStatus = "refunded";
        }

        const timeline = appendOrderTimeline(
          order.timeline,
          buildOrderTimelineEntry({
            status: nextStatus,
            event: "payment.refunded",
            note: "Payment refunded via provider webhook.",
            actorId: null,
            metadata: { payment_status: "refunded" }
          })
        );

        await updateAdminRecord(
          "orders",
          "id",
          String(order.id),
          {
            status: nextStatus,
            payment_status: "refunded",
            timeline,
            updated_at: new Date().toISOString()
          },
          null,
          process.env,
          { allowSystemActor: true }
        );

        await createCustomerPaymentNotification({
          recipientId: typeof order.created_by_user_id === "string" ? order.created_by_user_id : null,
          customerEmail: typeof order.customer_email === "string" ? order.customer_email : null,
          orderId: String(order.id),
          orderNumber: String(order.order_number ?? order.id),
          title: "Payment refunded",
          body: `Your payment for order ${String(order.order_number ?? order.id)} has been refunded.`,
          event: "payment.refunded"
        });
      }
    }
    return NextResponse.json({ ok: true, provider, status: event.status });
  }

  return NextResponse.json({ ok: true, provider, status: event.status });
}
