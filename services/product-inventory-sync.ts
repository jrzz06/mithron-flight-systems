import { upsertInventoryRecord, upsertWarehouseStockRecord } from "@/services/admin-actions";

const DEFAULT_WAREHOUSE_CODE = process.env.DEFAULT_SUPPLIER_INTAKE_WAREHOUSE_CODE ?? "IN-WEST-01";

export function deriveProductSku(slug: string) {
  const cleaned = slug.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "SKU";
}

export async function ensureInventoryForPublishedProduct(slug: string, actorId: string | null) {
  const sku = deriveProductSku(slug);
  const timestamp = new Date().toISOString();
  const errors: Error[] = [];

  try {
    await upsertInventoryRecord(
      {
        product_slug: slug,
        sku,
        stock_status: "available",
        quantity: 0,
        reserved_quantity: 0,
        reorder_threshold: 0,
        updated_at: timestamp
      },
      actorId
    );
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    console.error(`[mithron-inventory] Inventory upsert failed for ${slug}:`, wrapped);
    errors.push(wrapped);
  }

  try {
    await upsertWarehouseStockRecord(
      {
        warehouse_code: DEFAULT_WAREHOUSE_CODE,
        product_slug: slug,
        sku,
        available_quantity: 0,
        committed_quantity: 0,
        updated_at: timestamp
      },
      actorId
    );
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    console.error(`[mithron-inventory] Warehouse stock seed failed for ${slug}:`, wrapped);
    errors.push(wrapped);
  }

  if (errors.length > 0) {
    throw new Error(`Inventory sync failed for ${slug}: ${errors.map((item) => item.message).join("; ")}`);
  }
}
