import { assertSupabaseAdminConfig } from "@/lib/env";

export async function getSalesReportSummary() {
  const config = assertSupabaseAdminConfig(process.env);
  const response = await fetch(
    `${config.url}/rest/v1/orders?select=id,status,total,currency,created_at&order=created_at.desc&limit=200`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    }
  );
  if (!response.ok) return { totalOrders: 0, revenue: 0, byStatus: {} as Record<string, number> };
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  const byStatus = rows.reduce<Record<string, number>>((acc, row) => {
    const status = String(row.status ?? "unknown");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
  const revenue = rows
    .filter((row) => ["paid", "confirmed", "assigned", "processing", "packed", "dispatched", "in_transit", "delivered"].includes(String(row.status)))
    .reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  return { totalOrders: rows.length, revenue, byStatus };
}

export async function getSupplierReportSummary() {
  const config = assertSupabaseAdminConfig(process.env);
  const response = await fetch(
    `${config.url}/rest/v1/mithron_products?select=workflow_status,supplier_id&limit=500`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    }
  );
  if (!response.ok) return { total: 0, pending: 0, published: 0 };
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return {
    total: rows.filter((row) => row.supplier_id).length,
    pending: rows.filter((row) => row.workflow_status === "pending_review").length,
    published: rows.filter((row) => row.workflow_status === "published").length
  };
}

export async function getInventoryReportSummary() {
  const config = assertSupabaseAdminConfig(process.env);
  const response = await fetch(
    `${config.url}/rest/v1/inventory?select=product_slug,quantity,stock_status,reorder_threshold&limit=500`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    }
  );
  if (!response.ok) return { lowStock: 0, outOfStock: 0 };
  const rows = (await response.json()) as Array<Record<string, unknown>>;
  return {
    lowStock: rows.filter((row) => Number(row.quantity ?? 0) <= Number(row.reorder_threshold ?? 0)).length,
    outOfStock: rows.filter((row) => String(row.stock_status) === "out_of_stock" || Number(row.quantity ?? 0) === 0).length
  };
}
