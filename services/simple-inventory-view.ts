import { deriveProductSku } from "@/lib/product-sku";

export type SimpleInventoryStatus = "available" | "low_stock" | "out_of_stock" | "archived" | "discontinued" | "reserved";

export type SimpleInventoryRow = {
  id: string;
  productSlug: string;
  productName: string;
  productImage: string | null;
  sku: string;
  variantId: string | null;
  warehouseCode: string;
  stockStatus: SimpleInventoryStatus;
  quantity: number;
  onHandQuantity: number;
  category: string;
  price: number;
  inventoryValue: number;
  lastUpdated: string | null;
  warehouseUpdatedAt: string | null;
  inventoryUpdatedAt: string | null;
  reservedQuantity: number;
  reorderThreshold: number;
  availableQuantity: number;
  committedQuantity: number;
  supplierName: string;
  isArchived: boolean;
};

type AdminRow = Record<string, unknown>;

function asText(value: unknown, fallback = "n/a") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
}

export function resolveStockStatus(value: unknown, quantity: number, product?: AdminRow): SimpleInventoryStatus {
  const workflowStatus = asText(product?.workflow_status, "").toLowerCase();
  const archivedAt = asText(product?.archived_at, "");
  if (workflowStatus === "archived" || archivedAt) return "archived";
  if (value === "archived") return "archived";
  if (value === "discontinued") return "discontinued";
  if (value === "reserved") return "reserved";
  if (value === "inactive" || value === "hidden") return "discontinued";
  if (quantity <= 0) return "out_of_stock";
  if (value === "low_stock" || value === "out_of_stock" || value === "available") return value;
  return "available";
}

function asStockStatus(value: unknown, quantity: number, product?: AdminRow): SimpleInventoryStatus {
  return resolveStockStatus(value, quantity, product);
}

function firstImageFrom(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = firstImageFrom(item);
      if (image) return image;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return firstImageFrom(record.src ?? record.url ?? record.image ?? record.desktop ?? record.mobile ?? record[0]);
  }
  return null;
}

function productImage(product?: AdminRow) {
  return firstImageFrom(product?.image)
    ?? firstImageFrom(product?.hero)
    ?? firstImageFrom(product?.gallery)
    ?? firstImageFrom(product?.source_images);
}

function isProductArchived(product?: AdminRow) {
  if (!product) return false;
  const workflowStatus = asText(product.workflow_status, "").toLowerCase();
  return workflowStatus === "archived" || Boolean(asText(product.archived_at, ""));
}

export function readAdminText(value: unknown, fallback = "n/a") {
  return asText(value, fallback);
}

export function readAdminNumber(value: unknown, fallback = 0) {
  return asNumber(value, fallback);
}

export function pickWarehouseStockRow(stock: AdminRow[], productSlug: string, preferredWarehouseCode: string) {
  const rows = stock.filter((row) => asText(row.product_slug, "") === productSlug);
  if (!rows.length) return undefined;
  return rows.find((row) => asText(row.warehouse_code, "") === preferredWarehouseCode) ?? rows[0];
}

/** Builds exactly one warehouse inventory row per product in the loaded set. */
export function buildSimpleInventoryRows(
  products: AdminRow[],
  inventory: AdminRow[],
  stock: AdminRow[],
  preferredWarehouseCode = ""
): SimpleInventoryRow[] {
  const inventoryBySlug = new Map<string, AdminRow>();
  for (const row of inventory) {
    const productSlug = asText(row.product_slug, "");
    if (productSlug && !inventoryBySlug.has(productSlug)) {
      inventoryBySlug.set(productSlug, row);
    }
  }

  const productOrder = new Map(products.map((product, index) => [asText(product.slug, ""), index]));

  const rows = products.map((product) => {
    const productSlug = asText(product.slug, "");
    const inv = inventoryBySlug.get(productSlug);
    const stockRow = pickWarehouseStockRow(stock, productSlug, preferredWarehouseCode);
    const sku = asText(inv?.sku, deriveProductSku(productSlug));
    const warehouseCode = asText(stockRow?.warehouse_code, preferredWarehouseCode);
    const onHandQuantity = asNumber(inv?.quantity);
    const availableQuantity = asNumber(stockRow?.available_quantity, onHandQuantity);
    const quantity = availableQuantity;
    const price = asNumber(product.price);

    return {
      id: productSlug || sku,
      productSlug,
      productName: asText(product.name, productSlug),
      productImage: productImage(product),
      sku,
      variantId: asText(inv?.variant_id ?? stockRow?.variant_id, "") || null,
      warehouseCode,
      stockStatus: asStockStatus(inv?.stock_status, quantity, product),
      quantity,
      onHandQuantity,
      category: asText(product.category, "Uncategorized"),
      price,
      inventoryValue: price * quantity,
      lastUpdated: asText(inv?.updated_at ?? stockRow?.updated_at ?? stockRow?.last_counted_at, "") || null,
      warehouseUpdatedAt: asText(stockRow?.updated_at ?? stockRow?.last_counted_at, "") || null,
      inventoryUpdatedAt: asText(inv?.updated_at, "") || null,
      reservedQuantity: asNumber(inv?.reserved_quantity),
      reorderThreshold: asNumber(inv?.reorder_threshold),
      availableQuantity,
      committedQuantity: asNumber(stockRow?.committed_quantity),
      supplierName: asText(product.supplier_name, ""),
      isArchived: isProductArchived(product)
    } satisfies SimpleInventoryRow;
  });

  return rows.sort(
    (left, right) => (productOrder.get(left.productSlug) ?? 999) - (productOrder.get(right.productSlug) ?? 999)
  );
}

/** @deprecated Use buildSimpleInventoryRows — alias kept for clarity in warehouse contexts. */
export const buildWarehouseInventoryRows = buildSimpleInventoryRows;
