import { deriveProductSku } from "@/services/product-inventory-sync";

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

export function readAdminText(value: unknown, fallback = "n/a") {
  return asText(value, fallback);
}

export function readAdminNumber(value: unknown, fallback = 0) {
  return asNumber(value, fallback);
}

export function buildSimpleInventoryRows(
  products: AdminRow[],
  inventory: AdminRow[],
  stock: AdminRow[],
  defaultWarehouseCode = ""
): SimpleInventoryRow[] {
  const productsBySlug = new Map(products.map((product) => [asText(product.slug, ""), product]));
  const stockBySku = new Map(stock.map((row) => [`${asText(row.product_slug, "")}:${asText(row.sku, "")}`, row]));
  const rows = new Map<string, SimpleInventoryRow>();

  for (const row of inventory) {
    const productSlug = asText(row.product_slug, "");
    const sku = asText(row.sku, "");
    if (!productSlug || !sku) continue;

    const product = productsBySlug.get(productSlug);
    const stockRow = stockBySku.get(`${productSlug}:${sku}`);
    const warehouseCode = asText(stockRow?.warehouse_code, defaultWarehouseCode);
    const quantity = asNumber(row.quantity, asNumber(stockRow?.available_quantity));
    const id = `${warehouseCode}:${productSlug}:${sku}`;

    rows.set(id, {
      id,
      productSlug,
      productName: asText(product?.name, productSlug),
      productImage: productImage(product),
      sku,
      variantId: asText(row.variant_id ?? stockRow?.variant_id, "") || null,
      warehouseCode,
      stockStatus: asStockStatus(row.stock_status, quantity, product),
      quantity,
      category: asText(product?.category, "Uncategorized"),
      price: asNumber(product?.price),
      inventoryValue: asNumber(product?.price) * quantity,
      lastUpdated: asText(row.updated_at ?? stockRow?.updated_at ?? stockRow?.last_counted_at, "") || null,
      warehouseUpdatedAt: asText(stockRow?.updated_at ?? stockRow?.last_counted_at, "") || null,
      inventoryUpdatedAt: asText(row.updated_at, "") || null,
      reservedQuantity: asNumber(row.reserved_quantity),
      reorderThreshold: asNumber(row.reorder_threshold),
      availableQuantity: asNumber(stockRow?.available_quantity, quantity),
      committedQuantity: asNumber(stockRow?.committed_quantity),
      supplierName: asText(product?.supplier_name, "")
    });
  }

  for (const row of stock) {
    const productSlug = asText(row.product_slug, "");
    const sku = asText(row.sku, "");
    const warehouseCode = asText(row.warehouse_code, defaultWarehouseCode);
    const id = `${warehouseCode}:${productSlug}:${sku}`;
    if (!productSlug || !sku || rows.has(id)) continue;

    const product = productsBySlug.get(productSlug);
    const quantity = asNumber(row.available_quantity);
    rows.set(id, {
      id,
      productSlug,
      productName: asText(product?.name, productSlug),
      productImage: productImage(product),
      sku,
      variantId: asText(row.variant_id, "") || null,
      warehouseCode,
      stockStatus: asStockStatus(null, quantity, product),
      quantity,
      category: asText(product?.category, "Uncategorized"),
      price: asNumber(product?.price),
      inventoryValue: asNumber(product?.price) * quantity,
      lastUpdated: asText(row.updated_at ?? row.last_counted_at, "") || null,
      warehouseUpdatedAt: asText(row.updated_at ?? row.last_counted_at, "") || null,
      inventoryUpdatedAt: null,
      reservedQuantity: 0,
      reorderThreshold: 0,
      availableQuantity: quantity,
      committedQuantity: asNumber(row.committed_quantity),
      supplierName: asText(product?.supplier_name, "")
    });
  }

  const slugsWithRows = new Set(Array.from(rows.values()).map((row) => row.productSlug));
  // Read-time fallback only: persisted inventory rows are created by ensureProductInventoryRecord and the DB trigger.
  for (const product of products) {
    const productSlug = asText(product.slug, "");
    if (!productSlug || slugsWithRows.has(productSlug)) continue;

    const sku = deriveProductSku(productSlug);
    const warehouseCode = defaultWarehouseCode;
    const quantity = 0;
    const id = `${warehouseCode}:${productSlug}:${sku}`;

    rows.set(id, {
      id,
      productSlug,
      productName: asText(product.name, productSlug),
      productImage: productImage(product),
      sku,
      variantId: null,
      warehouseCode,
      stockStatus: asStockStatus("out_of_stock", quantity, product),
      quantity,
      category: asText(product.category, "Uncategorized"),
      price: asNumber(product.price),
      inventoryValue: 0,
      lastUpdated: null,
      warehouseUpdatedAt: null,
      inventoryUpdatedAt: null,
      reservedQuantity: 0,
      reorderThreshold: 0,
      availableQuantity: 0,
      committedQuantity: 0,
      supplierName: asText(product.supplier_name, "")
    });
  }

  const productOrder = new Map(products.map((product, index) => [asText(product.slug, ""), index]));
  return Array.from(rows.values()).sort(
    (left, right) => (productOrder.get(left.productSlug) ?? 999) - (productOrder.get(right.productSlug) ?? 999)
  );
}
