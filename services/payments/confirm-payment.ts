import { assertSupabaseAdminConfig } from "@/lib/env";
import { mergePaymentLifecycleMetadata, paymentEventToLifecycleState } from "@/lib/orders/payment-lifecycle";
import { fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";
import { releaseCheckoutStock } from "@/services/checkout-stock";
import { notifyAdminsAboutPaidOrder } from "@/services/enquiries";
import { appendOrderTimeline, buildOrderTimelineEntry, transitionOrderStatus } from "@/services/orders";
import { cashfreeCheckoutMode } from "./config";
import { logPaymentEvent, logPaymentWarning } from "./logger";
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
    cashfreeMode: input.provider === "cashfree" ? cashfreeCheckoutMode(env) : null
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

  if (source === "webhook") {
    const inserted = await recordWebhookEvent(provider, eventId, input.rawPayload ?? event.raw);
    if (!inserted) {
      return { ok: true, status: event.status, skipped: true, reason: "duplicate_event" };
    }
  }

  const payments = await fetchAdminRecordsByColumn("payments", "provider_intent_id", event.intentId);
  const payment = payments.find((row) => String(row.provider ?? "") === provider) ?? payments[0];
  if (!payment) {
    logPaymentWarning("payment_record_missing", { provider, intentId: event.intentId });
    return { ok: false, status: 404, error: "Payment record not found." };
  }

  if (String(payment.status ?? "") === "succeeded" && event.status === "succeeded") {
    return { ok: true, status: "succeeded", skipped: true, reason: "already_paid" };
  }

  const paymentAmount = Number(payment.amount ?? 0);
  if (event.status === "succeeded" && Math.abs(event.amount - paymentAmount) > 0.01) {
    logPaymentWarning("payment_amount_mismatch", {
      provider,
      intentId: event.intentId,
      expected: paymentAmount,
      received: event.amount
    });
    return { ok: false, status: 400, error: "Payment amount mismatch." };
  }

  await updateAdminRecord(
    "payments",
    "id",
    String(payment.id),
    {
      status: event.status,
      provider_payment_id: event.paymentId ?? null,
      webhook_payload: event.raw as JsonRecord,
      verified_at: event.status === "succeeded" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    },
    null,
    process.env,
    { allowSystemActor: true }
  );

  const orderId = String(payment.order_id ?? "");
  if (!orderId) {
    return { ok: true, status: event.status };
  }

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

  if (event.status === "succeeded") {
    const currentStatus = String(order.status ?? "pending_payment");
    let nextStatus = currentStatus;
    try {
      nextStatus = transitionOrderStatus(currentStatus, "paid");
    } catch {
      if (currentStatus === "paid" || currentStatus === "admin_review" || currentStatus === "confirmed") {
        nextStatus = currentStatus;
      } else {
        return { ok: false, status: 409, error: "Order is not in a payable state." };
      }
    }

    const lifecycleState = paymentEventToLifecycleState(event.status);
    const timeline = appendOrderTimeline(
      order.timeline,
      buildOrderTimelineEntry({
        status: nextStatus,
        event: "payment.succeeded",
        note: `Payment verified via ${source}.`,
        actorId: null,
        metadata: {
          provider,
          provider_intent_id: event.intentId,
          provider_payment_id: event.paymentId ?? null,
          payment_lifecycle: lifecycleState
        }
      })
    );

    await updateAdminRecord(
      "orders",
      "id",
      orderId,
      {
        status: nextStatus,
        payment_status: "succeeded",
        timeline,
        metadata: mergePaymentLifecycleMetadata(baseMetadata, {
          state: "PAYMENT_VERIFIED",
          provider,
          providerIntentId: event.intentId,
          providerPaymentId: event.paymentId,
          source,
          note: "Payment verified by server."
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
      orderNumber: String(order.order_number ?? orderId)
    });

    await notifyAdminsAboutPaidOrder({
      orderId,
      orderNumber: String(order.order_number ?? orderId)
    });

    logPaymentEvent("payment_verified", { orderId, provider, source });
    // Extension point: invoice generation, GST documents, accounting exports, and
    // transactional emails should hook in here after server-side verification only.
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
