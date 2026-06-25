import { assertSupabaseAdminConfig } from "@/lib/env";
import { deriveProductSku } from "@/services/product-inventory-sync";

type EnvSource = Record<string, string | undefined>;

export type CheckoutStockItem = {
  productSlug: string;
  quantity: number;
  sku?: string | null;
};

const DEFAULT_WAREHOUSE_CODE = process.env.DEFAULT_WAREHOUSE_CODE ?? "IN-WEST-01";

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

export async function resolveCheckoutStockSkus(
  items: Array<{ productSlug: string; quantity: number }>,
  env: EnvSource = process.env
): Promise<CheckoutStockItem[]> {
  const config = assertSupabaseAdminConfig(env);
  if (!items.length) return [];

  const slugs = [...new Set(items.map((item) => item.productSlug))];
  const slugFilter = slugs.map((slug) => encodeURIComponent(slug)).join(",");
  const response = await fetch(
    `${config.url}/rest/v1/warehouse_stock?select=product_slug,sku,available_quantity&product_slug=in.(${slugFilter})&warehouse_code=eq.${encodeURIComponent(DEFAULT_WAREHOUSE_CODE)}&order=available_quantity.desc`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error("Unable to resolve product inventory for checkout.");
  }

  const rows = (await response.json()) as Array<{ product_slug?: string; sku?: string | null; available_quantity?: number }>;
  const bestBySlug = new Map<string, { sku: string; available: number }>();

  for (const row of rows) {
    const slug = String(row.product_slug ?? "");
    if (!slug) continue;
    const available = Number(row.available_quantity ?? 0);
    const sku = row.sku?.trim() || deriveProductSku(slug);
    const existing = bestBySlug.get(slug);
    if (!existing || available > existing.available) {
      bestBySlug.set(slug, { sku, available });
    }
  }

  return items.map((item) => ({
    productSlug: item.productSlug,
    quantity: item.quantity,
    sku: bestBySlug.get(item.productSlug)?.sku ?? deriveProductSku(item.productSlug)
  }));
}

export async function reserveCheckoutStock(
  orderId: string,
  items: CheckoutStockItem[],
  env: EnvSource = process.env,
  warehouseCode: string = DEFAULT_WAREHOUSE_CODE
) {
  const config = assertSupabaseAdminConfig(env);
  const payload = items.map((item) => ({
    product_slug: item.productSlug,
    quantity: item.quantity,
    sku: item.sku ?? null
  }));

  const response = await fetch(`${config.url}/rest/v1/rpc/reserve_checkout_stock`, {
    method: "POST",
    headers: headers(config.serviceRoleKey),
    body: JSON.stringify({
      p_order_id: orderId,
      p_items: payload,
      p_warehouse_code: warehouseCode
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const message = body.includes("Insufficient stock")
      ? body.match(/Insufficient stock[^"]*/)?.[0] ?? body
      : body.includes("No warehouse stock")
        ? body.match(/No warehouse stock[^"]*/)?.[0] ?? body
        : `Stock reservation failed (${response.status})`;
    throw new Error(message);
  }

  return (await response.json()) as { order_id?: string; rows_reserved?: number };
}

export async function fulfillReservedStock(
  orderId: string,
  actorId: string | null,
  env: EnvSource = process.env,
  warehouseCode: string = DEFAULT_WAREHOUSE_CODE
) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(`${config.url}/rest/v1/rpc/fulfill_reserved_stock`, {
    method: "POST",
    headers: headers(config.serviceRoleKey),
    body: JSON.stringify({
      p_order_id: orderId,
      p_actor_id: actorId,
      p_warehouse_code: warehouseCode
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Fulfillment stock RPC failed (${response.status})${body ? `: ${body.slice(0, 300)}` : ""}`);
  }

  return response.json();
}

export async function orderHasCheckoutReservations(
  orderId: string,
  env: EnvSource = process.env
) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(`${config.url}/rest/v1/rpc/order_has_checkout_reservations`, {
    method: "POST",
    headers: headers(config.serviceRoleKey),
    body: JSON.stringify({ p_order_id: orderId }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Unable to verify checkout reservations (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  return Boolean(await response.json());
}

export async function releaseCheckoutStock(
  orderId: string,
  env: EnvSource = process.env,
  warehouseCode: string = DEFAULT_WAREHOUSE_CODE
) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(`${config.url}/rest/v1/rpc/release_checkout_stock`, {
    method: "POST",
    headers: headers(config.serviceRoleKey),
    body: JSON.stringify({
      p_order_id: orderId,
      p_warehouse_code: warehouseCode
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Stock release failed (${response.status})${body ? `: ${body.slice(0, 300)}` : ""}`);
  }

  return response.json();
}
