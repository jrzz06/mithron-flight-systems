import { assertSupabaseAdminConfig } from "@/lib/env";
import { canTransition } from "@/lib/workflows/registry";
import { listSupplierProducts } from "@/services/supplier-actions";
import { fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";

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

export async function listSupplierStockRequests(supplierId: string, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/supplier_stock_requests?select=id,product_slug,requested_quantity,current_quantity,note,status,reviewed_at,created_at&supplier_id=eq.${encodeURIComponent(supplierId)}&order=created_at.desc&limit=50`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function listPendingStockRequests(env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/supplier_stock_requests?select=id,supplier_id,product_slug,requested_quantity,current_quantity,note,status,created_at&status=eq.pending&order=created_at.asc&limit=50`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function createSupplierStockRequest(
  input: {
    supplierId: string;
    productSlug: string;
    requestedQuantity: number;
    note?: string;
    idempotencyKey?: string;
  },
  env: EnvSource = process.env
) {
  const products = await listSupplierProducts(input.supplierId, env);
  const owned = products.some((product) => String(product.slug) === input.productSlug);
  if (!owned) throw new Error("You can only request stock updates for your own products.");

  if (!Number.isInteger(input.requestedQuantity) || input.requestedQuantity < 0) {
    throw new Error("Requested quantity must be a non-negative integer.");
  }

  const config = assertSupabaseAdminConfig(env);
  const inventoryResponse = await fetch(
    `${config.url}/rest/v1/inventory?select=quantity&product_slug=eq.${encodeURIComponent(input.productSlug)}&limit=1`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  const inventoryRows = inventoryResponse.ok ? ((await inventoryResponse.json()) as JsonRecord[]) : [];
  const currentQuantity = inventoryRows[0] ? Number(inventoryRows[0].quantity ?? 0) : 0;

  const payload: JsonRecord = {
    supplier_id: input.supplierId,
    product_slug: input.productSlug,
    requested_quantity: input.requestedQuantity,
    current_quantity: currentQuantity,
    note: input.note?.trim() || null,
    status: "pending",
    updated_at: new Date().toISOString()
  };
  if (input.idempotencyKey) payload.idempotency_key = input.idempotencyKey;

  const response = await fetch(`${config.url}/rest/v1/supplier_stock_requests`, {
    method: "POST",
    headers: headers(config.serviceRoleKey, "return=representation,resolution=ignore-duplicates"),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Stock request failed: ${response.status}${text ? ` - ${text.slice(0, 120)}` : ""}`);
  }

  const [record] = (await response.json()) as JsonRecord[];
  const adminConfig = assertSupabaseAdminConfig(env);
  const adminResponse = await fetch(
    `${adminConfig.url}/rest/v1/user_roles?select=user_id&role_key=eq.admin&limit=20`,
    { headers: headers(adminConfig.serviceRoleKey), cache: "no-store" }
  );
  if (adminResponse.ok) {
    const admins = (await adminResponse.json()) as Array<{ user_id?: string }>;
    for (const admin of admins) {
      const recipientId = String(admin.user_id ?? "");
      if (!recipientId) continue;
      await fetch(`${adminConfig.url}/rest/v1/notifications`, {
        method: "POST",
        headers: headers(adminConfig.serviceRoleKey, "return=minimal"),
        body: JSON.stringify({
          recipient_id: recipientId,
          channel: "in_app",
          title: "Stock update requested",
          body: `${input.productSlug}: supplier requested quantity ${input.requestedQuantity}.`,
          status: "unread",
          priority: "normal",
          entity_table: "supplier_stock_requests",
          entity_id: String(record?.id ?? "")
        })
      });
    }
  }

  return record;
}

export async function approveAndApplyStockRequest(
  input: { requestId: string; actorId: string; apply?: boolean },
  env: EnvSource = process.env
) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/supplier_stock_requests?select=id,supplier_id,product_slug,requested_quantity,status&id=eq.${encodeURIComponent(input.requestId)}&limit=1`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) throw new Error("Stock request not found.");
  const rows = (await response.json()) as JsonRecord[];
  const request = rows[0];
  if (!request) throw new Error("Stock request not found.");

  const status = String(request.status ?? "");
  if (status === "pending") {
    if (!canTransition("stock_request", "pending", "approved", "admin")) {
      throw new Error("Invalid stock request transition.");
    }
    await fetch(
      `${config.url}/rest/v1/supplier_stock_requests?id=eq.${encodeURIComponent(input.requestId)}&status=eq.pending`,
      {
        method: "PATCH",
        headers: headers(config.serviceRoleKey, "return=representation"),
        body: JSON.stringify({
          status: "approved",
          reviewed_by: input.actorId,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    );
  } else if (status !== "approved") {
    throw new Error(`Stock request is ${status}; cannot apply.`);
  }

  if (input.apply !== false) {
    const slug = String(request.product_slug ?? "");
    const quantity = Number(request.requested_quantity ?? 0);
    const inventory = await fetchAdminRecordsByColumn("inventory", "product_slug", slug, env);
    const row = inventory[0];
    if (row?.id) {
      await updateAdminRecord(
        "inventory",
        String(row.id),
        { quantity, stock_status: quantity > 0 ? "in_stock" : "out_of_stock", updated_at: new Date().toISOString() },
        input.actorId,
        env
      );
    }

    await fetch(
      `${config.url}/rest/v1/supplier_stock_requests?id=eq.${encodeURIComponent(input.requestId)}&status=eq.approved`,
      {
        method: "PATCH",
        headers: headers(config.serviceRoleKey, "return=minimal"),
        body: JSON.stringify({ status: "applied", updated_at: new Date().toISOString() })
      }
    );
  }

  const supplierId = String(request.supplier_id ?? "");
  if (supplierId) {
    await fetch(`${config.url}/rest/v1/notifications`, {
      method: "POST",
      headers: headers(config.serviceRoleKey, "return=minimal"),
      body: JSON.stringify({
        recipient_id: supplierId,
        channel: "in_app",
        title: "Stock request approved",
        body: `Your stock update for ${String(request.product_slug)} was approved.`,
        status: "unread",
        priority: "normal",
        entity_table: "supplier_stock_requests",
        entity_id: input.requestId
      })
    });
  }

  return request;
}

export async function rejectStockRequest(input: { requestId: string; actorId: string }, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/supplier_stock_requests?id=eq.${encodeURIComponent(input.requestId)}&status=eq.pending`,
    {
      method: "PATCH",
      headers: headers(config.serviceRoleKey, "return=representation"),
      body: JSON.stringify({
        status: "rejected",
        reviewed_by: input.actorId,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
  );
  if (!response.ok) throw new Error("Failed to reject stock request.");
  const [record] = (await response.json()) as JsonRecord[];
  return record;
}
