import { assertSupabaseAdminConfig } from "@/lib/env";
import { listSupplierProducts } from "@/services/supplier-actions";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };
}

export async function listSupplierOrderVisibility(supplierId: string, env: EnvSource = process.env) {
  const products = await listSupplierProducts(supplierId, env);
  const slugs = products.map((product) => String(product.slug ?? "")).filter(Boolean);
  if (!slugs.length) return [];

  const config = assertSupabaseAdminConfig(env);
  const itemsResponse = await fetch(
    `${config.url}/rest/v1/order_items?select=id,order_id,product_slug,product_name,quantity,line_total,created_at&product_slug=in.(${slugs.map(encodeURIComponent).join(",")})&order=created_at.desc&limit=100`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!itemsResponse.ok) return [];

  const items = (await itemsResponse.json()) as JsonRecord[];
  const orderIds = [...new Set(items.map((item) => String(item.order_id ?? "")).filter(Boolean))];
  if (!orderIds.length) return [];

  const ordersResponse = await fetch(
    `${config.url}/rest/v1/orders?select=id,order_number,status,fulfillment_status,payment_status,total,currency,created_at&id=in.(${orderIds.map(encodeURIComponent).join(",")})&order=created_at.desc`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!ordersResponse.ok) return [];

  const orders = (await ordersResponse.json()) as JsonRecord[];
  const orderMap = new Map(orders.map((order) => [String(order.id), order]));

  return items
    .map((item) => {
      const order = orderMap.get(String(item.order_id ?? ""));
      if (!order) return null;
      return {
        orderId: String(order.id),
        orderNumber: String(order.order_number ?? order.id),
        orderStatus: String(order.status ?? ""),
        fulfillmentStatus: String(order.fulfillment_status ?? ""),
        paymentStatus: String(order.payment_status ?? ""),
        total: Number(order.total ?? 0),
        currency: String(order.currency ?? "INR"),
        productSlug: String(item.product_slug ?? ""),
        productName: String(item.product_name ?? item.product_slug ?? ""),
        quantity: Number(item.quantity ?? 0),
        lineTotal: Number(item.line_total ?? 0),
        createdAt: String(order.created_at ?? item.created_at ?? "")
      };
    })
    .filter(Boolean) as Array<{
    orderId: string;
    orderNumber: string;
    orderStatus: string;
    fulfillmentStatus: string;
    paymentStatus: string;
    total: number;
    currency: string;
    productSlug: string;
    productName: string;
    quantity: number;
    lineTotal: number;
    createdAt: string;
  }>;
}
