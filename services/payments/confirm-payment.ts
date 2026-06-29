import { assertSupabaseAdminConfig } from "@/lib/env";
import { mergePaymentLifecycleMetadata } from "@/lib/orders/payment-lifecycle";
import { fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";
import { releaseCheckoutStock } from "@/services/checkout-stock";
import { appendOrderTimeline, buildOrderTimelineEntry, transitionOrderStatus } from "@/services/orders";
import { inrAmountsMatch, inrToPaise } from "./amount";
import { cashfreeCheckoutMode } from "./config";
import { confirmVerifiedPayment } from "./confirm-verified-payment";
import { logPaymentEvent, logPaymentWarning } from "./logger";
import { resolvePaymentRecordForEvent } from "./resolve-payment-record";
import type { CheckoutPaymentResponse, PaymentEvent, PaymentProviderId } from "./types";

type JsonRecord = Record<string, unknown>;

export function buildCheckoutPaymentResponse(input: {
  orderId: string;
  orderNumber: string;
  provider: PaymentProviderId;
  intent: {
    intentId: string;
    clientSecret?: string;
    checkoutUrl?: string;
    paymentSessionId?: string;
  };
  amount: number;
  currency: string;
  env?: Record<string, string | undefined>;
}): CheckoutPaymentResponse {
  const env = input.env ?? process.env;
  return {
    ok: true,
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    paymentIntentId: input.intent.intentId,
    provider: input.provider,
    checkoutUrl: input.intent.checkoutUrl ?? null,
    clientSecret: input.intent.clientSecret ?? input.intent.paymentSessionId ?? null,
    paymentSessionId: input.intent.paymentSessionId ?? null,
    amount: input.amount,
    currency: input.currency,
    razorpayKeyId: input.provider === "razorpay" ? env.RAZORPAY_KEY_ID?.trim() ?? null : null,
    cashfreeMode: input.provider === "cashfree" ? cashfreeCheckoutMode(env) : null,
    amountPaise: input.intent.amountPaise ?? Math.round(input.amount * 100)
  };
}

export async function recordWebhookEvent(provider: string, eventId: string, payload: unknown) {
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
    logPaymentWarning("customer_notification_failed", {
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error)
    });
  });
}

async function markPaymentInitiated(orderId: string, provider: PaymentProviderId, intentId: string) {
  const orders = await fetchAdminRecordsByColumn("orders", "id", orderId);
  const order = orders[0];
  if (!order) return;

  const metadata = mergePaymentLifecycleMetadata(
    (order.metadata && typeof order.metadata === "object" ? order.metadata : {}) as JsonRecord,
    {
      state: "PAYMENT_INITIATED",
      provider,
      providerIntentId: intentId,
      source: "checkout",
      note: "Gateway checkout session created."
    }
  );

  await updateAdminRecord(
    "orders",
    "id",
    orderId,
    {
      metadata,
      updated_at: new Date().toISOString()
    },
    null,
    process.env,
    { allowSystemActor: true }
  );
}

export async function markCheckoutPaymentInitiated(input: {
  orderId: string;
  provider: PaymentProviderId;
  intentId: string;
}) {
  await markPaymentInitiated(input.orderId, input.provider, input.intentId);
  logPaymentEvent("payment_initiated", {
    orderId: input.orderId,
    provider: input.provider,
    intentId: input.intentId
  });
}

export type ApplyPaymentEventResult =
  | { ok: true; status: PaymentEvent["status"]; skipped?: boolean; reason?: string }
  | { ok: false; status?: number; error: string };

export async function applyPaymentEvent(input: {
  provider: PaymentProviderId;
  event: PaymentEvent;
  source: "webhook" | "verify";
  eventId?: string;
  rawPayload?: unknown;
}): Promise<ApplyPaymentEventResult> {
  const { provider, event, source } = input;
  const eventId = input.eventId ?? `${event.intentId}:${event.status}:${event.paymentId ?? "unknown"}`;

  const payments = await resolvePaymentRecordForEvent(provider, event);
  const payment = payments;
  if (!payment) {
    logPaymentWarning("payment_record_missing", { provider, intentId: event.intentId, paymentId: event.paymentId ?? null });
    return { ok: false, status: 404, error: "Payment record not found." };
  }

  const orderId = String(payment.order_id ?? "");
  if (!orderId) {
    return { ok: false, status: 404, error: "Order not found for payment." };
  }

  if (String(payment.status ?? "") === "succeeded" && event.status === "succeeded") {
    return { ok: true, status: "succeeded", skipped: true, reason: "already_paid" };
  }

  if (event.status === "succeeded") {
    const paymentAmount = Number(payment.amount ?? 0);
    const paymentCurrency = String(payment.currency ?? "INR").trim().toUpperCase();
    const eventCurrency = String(event.currency ?? paymentCurrency).trim().toUpperCase();
    if (eventCurrency !== paymentCurrency) {
      logPaymentWarning("payment_currency_mismatch", {
        provider,
        intentId: event.intentId,
        expected: paymentCurrency,
        received: eventCurrency
      });
      return { ok: false, status: 400, error: "Payment currency mismatch." };
    }
    if (!inrAmountsMatch(paymentAmount, event.amount)) {
      const paymentPaise = inrToPaise(paymentAmount);
      const eventPaise = inrToPaise(event.amount);
      const paiseMatch = paymentPaise === eventPaise;
      if (!paiseMatch && Math.abs(paymentPaise - eventPaise) > 1) {
        logPaymentWarning("payment_amount_mismatch", {
          provider,
          intentId: event.intentId,
          expected: paymentAmount,
          received: event.amount
        });
        return { ok: false, status: 400, error: "Payment amount mismatch." };
      }
    }

    const confirmed = await confirmVerifiedPayment({
      paymentId: String(payment.id),
      orderId,
      provider,
      event,
      source,
      eventId
    });

    if (!confirmed.ok) {
      return { ok: false, status: confirmed.status ?? 400, error: confirmed.error };
    }

    if (!confirmed.skipped) {
      const orders = await fetchAdminRecordsByColumn("orders", "id", orderId);
      const order = orders[0];
      await createCustomerPaymentNotification({
        recipientId: typeof order?.created_by_user_id === "string" ? order.created_by_user_id : null,
        customerEmail: typeof order?.customer_email === "string" ? order.customer_email : null,
        orderId,
        orderNumber: String(order?.order_number ?? orderId)
      });
    }

    return {
      ok: true,
      status: "succeeded",
      skipped: confirmed.skipped,
      reason: confirmed.reason
    };
  }

  if (source === "webhook") {
    const inserted = await recordWebhookEvent(provider, eventId, input.rawPayload ?? event.raw);
    if (!inserted) {
      return { ok: true, status: event.status, skipped: true, reason: "duplicate_event" };
    }
  }

  await updateAdminRecord(
    "payments",
    "id",
    String(payment.id),
    {
      status: event.status,
      provider_intent_id: event.intentId || String(payment.provider_intent_id ?? ""),
      provider_payment_id: event.paymentId ?? null,
      webhook_payload: event.raw as JsonRecord,
      verified_at: null,
      updated_at: new Date().toISOString()
    },
    null,
    process.env,
    { allowSystemActor: true }
  );

  const orders = await fetchAdminRecordsByColumn("orders", "id", orderId);
  const order = orders[0];
  if (!order) {
    return { ok: true, status: event.status };
  }

  const baseMetadata =
    (order.metadata && typeof order.metadata === "object" ? order.metadata : {}) as JsonRecord;

  if (event.status === "failed") {
    try {
      await releaseCheckoutStock(orderId);
    } catch (releaseError) {
      logPaymentWarning("stock_release_failed", {
        orderId,
        error: releaseError instanceof Error ? releaseError.message : String(releaseError)
      });
    }

    await updateAdminRecord(
      "orders",
      "id",
      orderId,
      {
        status: "cancelled",
        payment_status: "failed",
        metadata: mergePaymentLifecycleMetadata(baseMetadata, {
          state: "FAILED",
          provider,
          providerIntentId: event.intentId,
          providerPaymentId: event.paymentId,
          source,
          note: "Gateway reported payment failure."
        }),
        updated_at: new Date().toISOString()
      },
      null,
      process.env,
      { allowSystemActor: true }
    );

    logPaymentEvent("payment_failed", { orderId, provider, source });
    return { ok: true, status: event.status };
  }

  if (event.status === "processing") {
    await updateAdminRecord(
      "orders",
      "id",
      orderId,
      {
        payment_status: "processing",
        metadata: mergePaymentLifecycleMetadata(baseMetadata, {
          state: "PAYMENT_PROCESSING",
          provider,
          providerIntentId: event.intentId,
          providerPaymentId: event.paymentId,
          source
        }),
        updated_at: new Date().toISOString()
      },
      null,
      process.env,
      { allowSystemActor: true }
    );
    return { ok: true, status: event.status };
  }

  if (event.status === "refunded") {
    try {
      await releaseCheckoutStock(orderId);
    } catch (releaseError) {
      logPaymentWarning("refund_stock_release_failed", {
        orderId,
        error: releaseError instanceof Error ? releaseError.message : String(releaseError)
      });
    }

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
        metadata: { payment_status: "refunded", provider }
      })
    );

    await updateAdminRecord(
      "orders",
      "id",
      orderId,
      {
        status: nextStatus,
        payment_status: "refunded",
        timeline,
        metadata: mergePaymentLifecycleMetadata(baseMetadata, {
          state: "REFUNDED",
          provider,
          providerIntentId: event.intentId,
          providerPaymentId: event.paymentId,
          source,
          note: "Payment refunded."
        }),
        updated_at: new Date().toISOString()
      },
      null,
      process.env,
      { allowSystemActor: true }
    );

    await createCustomerPaymentNotification({
      recipientId: typeof order.created_by_user_id === "string" ? order.created_by_user_id : null,
      customerEmail: typeof order.customer_email === "string" ? order.customer_email : null,
      orderId,
      orderNumber: String(order.order_number ?? orderId),
      title: "Payment refunded",
      body: `Your payment for order ${String(order.order_number ?? orderId)} has been refunded.`,
      event: "payment.refunded"
    });

    logPaymentEvent("payment_refunded", { orderId, provider, source });
    return { ok: true, status: event.status };
  }

  return { ok: true, status: event.status };
}
