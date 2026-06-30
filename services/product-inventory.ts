import { assertSupabaseAdminConfig } from "@/lib/env";
import { deriveProductSku } from "@/lib/product-sku";
import type { ProductInventoryWorkflowInput } from "@/services/enterprise-admin-forms";

export { deriveProductSku };

type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

/** Atomically updates inventory, warehouse stock, and product availability in one database transaction. */
export async function upsertProductInventoryRecord(
  input: ProductInventoryWorkflowInput,
  actorId: string | null,
  env: EnvSource = process.env
) {
  const config = assertSupabaseAdminConfig(env);
  const sku = deriveProductSku(input.productSlug);
  const sellableQuantity = Math.max(0, input.quantity - input.reservedQuantity);

  const response = await fetch(`${config.url}/rest/v1/rpc/upsert_product_inventory`, {
    method: "POST",
    headers: headers(config.serviceRoleKey),
    body: JSON.stringify({
      p_product_slug: input.productSlug,
      p_sku: sku,
      p_warehouse_code: input.warehouseCode,
      p_quantity: input.quantity,
      p_reserved_quantity: input.reservedQuantity,
      p_reorder_threshold: input.reorderThreshold,
      p_stock_status: input.stockStatus,
      p_variant_id: input.variantId,
      p_updated_by: actorId
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Inventory update failed (${response.status})${body ? `: ${body.slice(0, 240)}` : ""}`);
  }

  const result = (await response.json()) as Record<string, unknown>;
  if (result.ok !== true) {
    throw new Error(String(result.error ?? "Inventory update rejected."));
  }

  return {
    productSlug: input.productSlug,
    sku: String(result.sku ?? sku),
    stockStatus: String(result.stock_status ?? input.stockStatus),
    quantity: Number(result.quantity ?? input.quantity),
    availableQuantity: Number(result.available_quantity ?? sellableQuantity),
    committedQuantity: Number(result.committed_quantity ?? input.committedQuantity),
    warehouseCode: String(result.warehouse_code ?? input.warehouseCode)
  };
}
