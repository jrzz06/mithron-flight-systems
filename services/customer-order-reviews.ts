import { assertSupabaseAdminConfig } from "@/lib/env";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string, prefer?: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {})
  };
}

export async function listCustomerReviewsForOrder(orderId: string, userId: string, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/customer_order_reviews?select=id,product_slug,rating,body,status,created_at&order_id=eq.${encodeURIComponent(orderId)}&user_id=eq.${encodeURIComponent(userId)}`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function submitCustomerOrderReview(
  input: {
    userId: string;
    orderId: string;
    productSlug: string;
    rating: number;
    body: string;
    idempotencyKey?: string;
  },
  env: EnvSource = process.env
) {
  const body = input.body.trim();
  if (!body) throw new Error("Review text is required.");
  if (!Number.isFinite(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new Error("Rating must be between 1 and 5.");
  }

  const config = assertSupabaseAdminConfig(env);
  const orderResponse = await fetch(
    `${config.url}/rest/v1/orders?select=id,fulfillment_status,created_by_user_id&id=eq.${encodeURIComponent(input.orderId)}&limit=1`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!orderResponse.ok) throw new Error("Could not verify order.");
  const orders = (await orderResponse.json()) as JsonRecord[];
  const order = orders[0];
  if (!order || String(order.created_by_user_id ?? "") !== input.userId) {
    throw new Error("Order not found.");
  }
  if (String(order.fulfillment_status ?? "") !== "delivered") {
    throw new Error("Reviews are available after delivery.");
  }

  const itemResponse = await fetch(
    `${config.url}/rest/v1/order_items?select=id&order_id=eq.${encodeURIComponent(input.orderId)}&product_slug=eq.${encodeURIComponent(input.productSlug)}&limit=1`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!itemResponse.ok) throw new Error("Product not found on this order.");
  const items = (await itemResponse.json()) as JsonRecord[];
  if (!items.length) throw new Error("Product not found on this order.");

  const payload: JsonRecord = {
    order_id: input.orderId,
    user_id: input.userId,
    product_slug: input.productSlug,
    rating: input.rating,
    body,
    status: "pending",
    updated_at: new Date().toISOString()
  };
  if (input.idempotencyKey) payload.idempotency_key = input.idempotencyKey;

  const response = await fetch(`${config.url}/rest/v1/customer_order_reviews`, {
    method: "POST",
    headers: headers(config.serviceRoleKey, "return=representation,resolution=ignore-duplicates"),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (text.includes("23505") || response.status === 409) {
      const existing = await listCustomerReviewsForOrder(input.orderId, input.userId, env);
      const match = existing.find((row) => String(row.product_slug) === input.productSlug);
      if (match) return match;
    }
    throw new Error(`Review submission failed: ${response.status}`);
  }

  const [record] = (await response.json()) as JsonRecord[];
  await fetch(`${config.url}/rest/v1/activity_logs`, {
    method: "POST",
    headers: headers(config.serviceRoleKey, "return=minimal"),
    body: JSON.stringify({
      actor_id: input.userId,
      action: "review.submitted",
      entity_table: "customer_order_reviews",
      entity_id: String(record?.id ?? ""),
      severity: "info",
      metadata: { order_id: input.orderId, product_slug: input.productSlug }
    })
  });
  return record;
}
