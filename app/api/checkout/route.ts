import { NextResponse } from "next/server";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { parseCheckoutRequestBody } from "@/lib/api/checkout-schema";
import { buildCheckoutAddressMetadata } from "@/lib/addresses/resolve-server";
import { requireClientAuditToken } from "@/lib/api/require-client-audit-token";
import { createClient } from "@/lib/server";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { assertCustomerAddressBelongsToUser } from "@/services/customer-addresses";
import {
  createCustomerCheckoutOrderItemRecord,
  createCustomerCheckoutOrderRecord,
  createCustomerCheckoutPaymentRecord,
  fetchAdminRecordsByColumn,
  updateAdminRecord
} from "@/services/admin-actions";
import { buildCustomerCheckoutDraft } from "@/services/orders";
import { verifyCheckoutStockAvailability, CheckoutStockVerificationError, CheckoutWarehouseConfigurationError, resolveCheckoutStockSkus } from "@/services/checkout-stock";
import {
  buildCheckoutPaymentResponse,
  markCheckoutPaymentInitiated
} from "@/services/payments/confirm-payment";
import {
  createPaymentIntent,
  isPaymentGatewayConfigured,
  isPaymentProviderId,
  resolveCheckoutPaymentProvider
} from "@/services/payments/gateway";
import { logPaymentError } from "@/services/payments/logger";
import { getCheckoutPricingBySlugs } from "@/services/catalog";
import type { CheckoutPaymentResponse, PaymentProviderId } from "@/services/payments/types";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function findCheckoutByIdempotencyKey(
  idempotencyKey: string,
  scope: { userId: string } | { guestEmail: string; guestPhone: string }
): Promise<CheckoutPaymentResponse | null> {
  const config = assertSupabaseAdminConfig(process.env);
  const filter =
    "userId" in scope
      ? `created_by_user_id=eq.${scope.userId}`
      : `created_by_user_id=is.null&customer_email=eq.${encodeURIComponent(scope.guestEmail.trim())}&metadata->>customer_phone=eq.${encodeURIComponent(scope.guestPhone.trim())}`;

  const response = await fetch(
    `${config.url}/rest/v1/orders?select=id,order_number,total,currency,status,payment_status,metadata&${filter}&metadata->>idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&limit=1`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    }
  );
  if (!response.ok) return null;

  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const order = rows[0];
  if (!order?.id) return null;
  if (String(order.status ?? "") === "cancelled" || String(order.payment_status ?? "") === "succeeded") {
    return null;
  }

  const orderId = String(order.id);
  const payments = await fetchAdminRecordsByColumn("payments", "order_id", orderId);
  const payment = payments.find((row) => !["failed", "cancelled"].includes(String(row.status ?? ""))) ?? payments[0];
  if (!payment?.provider_intent_id) return null;

  const provider = String(payment.provider ?? process.env.PAYMENT_PROVIDER ?? "razorpay");
  if (!isPaymentProviderId(provider)) return null;

  const webhookPayload =
    payment.webhook_payload && typeof payment.webhook_payload === "object" && !Array.isArray(payment.webhook_payload)
      ? (payment.webhook_payload as Record<string, unknown>)
      : {};
  const paymentSessionId =
    typeof webhookPayload.payment_session_id === "string" ? webhookPayload.payment_session_id : null;

  return buildCheckoutPaymentResponse({
    orderId,
    orderNumber: String(order.order_number ?? orderId),
    provider,
    intent: {
      intentId: String(payment.provider_intent_id),
      clientSecret: provider === "cashfree" ? paymentSessionId ?? String(payment.provider_intent_id) : String(payment.provider_intent_id),
      paymentSessionId: paymentSessionId ?? undefined
    },
    amount: Number(payment.amount ?? order.total ?? 0),
    currency: String(payment.currency ?? order.currency ?? "INR")
  });
}

function isDuplicateIdempotencyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("23505") || /duplicate key|idempotency_key/i.test(message);
}

async function cancelCheckoutOrder(orderId: string, actorId: string | null, reason: string) {
  await updateAdminRecord(
    "orders",
    "id",
    orderId,
    {
      status: "cancelled",
      payment_status: "failed",
      metadata: { cancellation_reason: reason },
      updated_at: new Date().toISOString()
    },
    actorId,
    process.env,
    actorId ? {} : { allowSystemActor: true }
  );
}

export async function POST(request: Request) {
  const idempotencyKey = request.headers.get("X-Idempotency-Key")?.trim() ?? "";
  if (idempotencyKey && !UUID_V4.test(idempotencyKey)) {
    return NextResponse.json({ error: "X-Idempotency-Key must be a UUID v4." }, { status: 400 });
  }
  const rawBody = await request.json().catch(() => null);
  const body = parseCheckoutRequestBody(rawBody);

  if (!body) {
    return NextResponse.json({ error: "Valid full name, email, phone, and cart items are required." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  const rateKey = userId ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkDistributedRateLimit(`checkout:${rateKey}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  if (!userId) {
    const audit = requireClientAuditToken(request);
    if (!audit.ok) {
      return NextResponse.json({ error: audit.error }, { status: 401 });
    }
  }

  if (process.env.NODE_ENV === "production" && !isPaymentGatewayConfigured()) {
    return NextResponse.json(
      { error: "Payments are not configured. Set payment provider credentials before accepting checkout." },
      { status: 503 }
    );
  }

  let paymentProvider: PaymentProviderId;
  try {
    paymentProvider = resolveCheckoutPaymentProvider(body.paymentProvider);
  } catch {
    return NextResponse.json({ error: "No payment provider is available for checkout." }, { status: 503 });
  }

  if (!body.addressId && !body.guestAddress) {
    return NextResponse.json({ error: "A shipping address is required to pay online." }, { status: 400 });
  }

  if (body.addressId && !userId) {
    return NextResponse.json({ error: "Sign in to use a saved address, or enter a shipping address below." }, { status: 400 });
  }

  if (idempotencyKey) {
    const existing = userId
      ? await findCheckoutByIdempotencyKey(idempotencyKey, { userId })
      : await findCheckoutByIdempotencyKey(idempotencyKey, { guestEmail: body.email, guestPhone: body.phone });
    if (existing) {
      return NextResponse.json(existing);
    }
  }

  if (body.addressId && userId) {
    try {
      await assertCustomerAddressBelongsToUser(userId, body.addressId, process.env, { requireShipping: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid shipping address for this account.";
      return NextResponse.json({ error: message }, { status: 403 });
    }
  }

  if (body.billingAddressId && userId) {
    try {
      await assertCustomerAddressBelongsToUser(userId, body.billingAddressId, process.env, { requireBilling: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid billing address for this account.";
      return NextResponse.json({ error: message }, { status: 403 });
    }
  }

  if (!body.billingSameAsShipping && !body.billingAddressId && !body.guestBillingAddress) {
    return NextResponse.json({ error: "A billing address is required when it differs from shipping." }, { status: 400 });
  }

  let stockItems;
  try {
    await verifyCheckoutStockAvailability(body.items);
    stockItems = await resolveCheckoutStockSkus(body.items);
  } catch (error) {
    const internal = error instanceof Error ? error.message : "Unable to resolve product inventory.";
    const stockContext = error instanceof CheckoutStockVerificationError
      ? {
          warehouseCode: error.warehouseCode,
          stockIssues: JSON.stringify(
            error.issues.map((issue) => ({
              productSlug: issue.productSlug,
              requested: issue.requested,
              available: issue.available,
              hasWarehouseRow: issue.hasWarehouseRow
            }))
          )
        }
      : {};
    logPaymentError("checkout_stock_verification_failed", error, stockContext);
    if (error instanceof CheckoutWarehouseConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const isStockError = error instanceof CheckoutStockVerificationError || /insufficient stock|out of stock/i.test(internal);
    return NextResponse.json(
      { error: isStockError ? "One or more items are out of stock or unavailable." : "Unable to process your order at this time." },
      { status: 409 }
    );
  }

  let catalog;
  try {
    catalog = await getCheckoutPricingBySlugs(body.items.map((item) => item.productSlug));
  } catch (error) {
    logPaymentError("checkout_catalog_load_failed", error);
    return NextResponse.json({ error: "Unable to load product pricing. Please try again shortly." }, { status: 503 });
  }

  const catalogSlugs = new Set(catalog.map((product) => product.slug));
  const unavailableSlugs = body.items
    .map((item) => item.productSlug)
    .filter((slug) => !catalogSlugs.has(slug));
  if (unavailableSlugs.length) {
    return NextResponse.json(
      { error: "One or more products are no longer available for checkout." },
      { status: 409 }
    );
  }

  let addressMetadata;
  try {
    addressMetadata = await buildCheckoutAddressMetadata(
      {
        addressId: body.addressId,
        billingAddressId: body.billingAddressId,
        guestAddress: body.guestAddress,
        guestBillingAddress: body.guestBillingAddress,
        billingSameAsShipping: body.billingSameAsShipping
      },
      userId
    );
  } catch (error) {
    logPaymentError("checkout_address_resolution_failed", error);
    const message = error instanceof Error ? error.message : "Unable to resolve shipping address.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let draft;
  try {
    draft = buildCustomerCheckoutDraft(
      {
        customerEmail: body.email,
        phone: body.phone,
        region: body.region,
        items: stockItems.map((item) => ({
          productSlug: item.productSlug,
          quantity: item.quantity,
          sku: item.sku ?? undefined
        })),
        metadata: {
          ...addressMetadata,
          customer_full_name: body.fullName,
          ...(body.company ? { customer_company: body.company } : {}),
          ...(body.promoCode ? { promo_code: body.promoCode } : {}),
          ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
          payment_provider: paymentProvider
        }
      },
      catalog,
      userId
    );
  } catch (error) {
    logPaymentError("checkout_draft_build_failed", error);
    const message = error instanceof Error ? error.message : "Unable to prepare your order.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const orderNumber = `ORD-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  let order: Record<string, unknown>;
  try {
    order = await createCustomerCheckoutOrderRecord(
      {
        ...draft.order,
        created_by_user_id: userId,
        order_number: orderNumber,
        ...(typeof addressMetadata.shipping_address_id === "string"
          ? { shipping_address_id: addressMetadata.shipping_address_id }
          : {}),
        ...(typeof addressMetadata.billing_address_id === "string"
          ? { billing_address_id: addressMetadata.billing_address_id }
          : {})
      },
      userId
    );
  } catch (error) {
    if (idempotencyKey && isDuplicateIdempotencyError(error)) {
      const existing = userId
        ? await findCheckoutByIdempotencyKey(idempotencyKey, { userId })
        : await findCheckoutByIdempotencyKey(idempotencyKey, { guestEmail: body.email, guestPhone: body.phone });
      if (existing) {
        return NextResponse.json(existing);
      }
    }
    logPaymentError("checkout_order_create_failed", error, { idempotencyKey: idempotencyKey || null });
    const message = error instanceof Error ? error.message : "Order creation failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const orderId = String(order.id ?? "");
  if (!orderId) {
    return NextResponse.json({ error: "Order creation failed." }, { status: 500 });
  }

  try {
    for (const item of draft.orderItems) {
      await createCustomerCheckoutOrderItemRecord({ ...item, order_id: orderId }, userId);
    }
  } catch (error) {
    await cancelCheckoutOrder(orderId, userId, "order_items_failed");
    logPaymentError("checkout_order_items_failed", error, { orderId });
    return NextResponse.json({ error: "Unable to process your order at this time." }, { status: 500 });
  }

  let intent;
  try {
    intent = await createPaymentIntent(
      {
        orderId,
        amount: draft.order.total,
        currency: draft.order.currency,
        customerEmail: body.email,
        customerPhone: body.phone,
        metadata: {
          address_id: body.addressId ?? "",
          phone: body.phone,
          receipt: orderNumber
        }
      },
      paymentProvider
    );
  } catch (error) {
    await cancelCheckoutOrder(orderId, userId, "payment_intent_failed");
    logPaymentError("checkout_payment_intent_failed", error, { orderId, provider: paymentProvider });
    return NextResponse.json({ error: "Payment service is unavailable. Please try again shortly." }, { status: 503 });
  }

  try {
    await createCustomerCheckoutPaymentRecord(
      {
        order_id: orderId,
        provider: paymentProvider,
        provider_intent_id: intent.intentId,
        amount: draft.order.total,
        currency: draft.order.currency,
        status: "requires_payment",
        webhook_payload: {
          internal_order_id: orderId,
          order_number: orderNumber,
          merchant_order_id: intent.providerOrderId ?? intent.intentId,
          ...(intent.paymentSessionId ? { payment_session_id: intent.paymentSessionId } : {}),
          ...(paymentProvider === "razorpay" ? { razorpay_order_id: intent.intentId } : {})
        }
      },
      userId
    );
  } catch (error) {
    await cancelCheckoutOrder(orderId, userId, "payment_record_failed");
    logPaymentError("checkout_payment_record_failed", error, { orderId, provider: paymentProvider });
    return NextResponse.json({ error: "Unable to process your order at this time." }, { status: 500 });
  }

  await markCheckoutPaymentInitiated({
    orderId,
    provider: paymentProvider,
    intentId: intent.intentId
  });

  return NextResponse.json(
    buildCheckoutPaymentResponse({
      orderId,
      orderNumber,
      provider: paymentProvider,
      intent,
      amount: draft.order.total,
      currency: draft.order.currency
    })
  );
}
