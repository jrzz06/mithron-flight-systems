import { assertSupabaseAdminConfig } from "@/lib/env";

// Customer order ownership uses created_by_user_id (auth user id).
// Staff/warehouse order creation may set created_by separately — do not conflate the two columns.
type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };
}

export async function listCustomerOrders(userId: string, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/orders?select=id,order_number,status,payment_status,fulfillment_status,total,currency,created_at,updated_at&created_by_user_id=eq.${userId}&order=created_at.desc&limit=50`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function getCustomerOrder(userId: string, orderId: string, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/orders?select=id,order_number,customer_email,status,payment_status,fulfillment_status,total,currency,metadata,timeline,shipment_tracking,created_by_user_id,created_at,updated_at&id=eq.${encodeURIComponent(orderId)}&limit=1`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return null;

  const rows = (await response.json()) as JsonRecord[];
  const order = rows[0];
  if (!order || String(order.created_by_user_id ?? "") !== userId) return null;

  const [itemsResponse, paymentsResponse] = await Promise.all([
    fetch(
      `${config.url}/rest/v1/order_items?select=id,order_id,product_slug,product_name,quantity,line_total,metadata&order_id=eq.${encodeURIComponent(orderId)}&limit=50`,
      { headers: headers(config.serviceRoleKey), cache: "no-store" }
    ),
    fetch(
      `${config.url}/rest/v1/payments?select=id,order_id,provider,provider_intent_id,provider_payment_id,amount,currency,status,verified_at,created_at&order_id=eq.${encodeURIComponent(orderId)}&limit=10`,
      { headers: headers(config.serviceRoleKey), cache: "no-store" }
    )
  ]);

  const items = itemsResponse.ok ? ((await itemsResponse.json()) as JsonRecord[]) : [];
  const payments = paymentsResponse.ok ? ((await paymentsResponse.json()) as JsonRecord[]) : [];

  const metadata = order.metadata as JsonRecord | undefined;
  const addressId = typeof metadata?.shipping_address_id === "string" ? metadata.shipping_address_id : null;
  let shippingAddress: JsonRecord | null = null;
  if (addressId) {
    const addressResponse = await fetch(
      `${config.url}/rest/v1/customer_addresses?select=id,user_id,label,line1,line2,city,region,postal_code,country&user_id=eq.${userId}&id=eq.${encodeURIComponent(addressId)}&limit=1`,
      { headers: headers(config.serviceRoleKey), cache: "no-store" }
    );
    if (addressResponse.ok) {
      const addresses = (await addressResponse.json()) as JsonRecord[];
      shippingAddress = addresses[0] ?? null;
    }
  }

  const payment = payments.find((row) => String(row.status ?? "") === "succeeded") ?? payments[0] ?? null;

  return { order, items, payment, shippingAddress };
}
