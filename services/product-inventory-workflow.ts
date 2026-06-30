import {
  createActivityLogRecord,
  fetchAdminRecordsByColumn,
  recordEntityRevisionSnapshot
} from "@/services/admin-actions";
import {
  buildInventoryLinkageRecords,
  type ProductInventoryWorkflowInput
} from "@/services/enterprise-admin-forms";
import { revalidateCatalogSurfaces } from "@/lib/catalog-cache";
import { deriveProductSku, upsertProductInventoryRecord } from "@/services/product-inventory";
import { fetchWarehouseStockBySku, recordInventoryMovementForStockChange } from "@/services/warehouse-movements";
import { assertValidWarehouseCode } from "@/services/warehouses";
import type { SupplierInventoryInitInput } from "@/lib/supplier/product-form";

type EnvSource = Record<string, string | undefined>;

export type SupplierInventoryInit = SupplierInventoryInitInput;

function readOptionalInteger(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readTrackInventory(formData: FormData, key = "inventory_track") {
  const values = formData.getAll(key).map((value) => String(value).trim().toLowerCase());
  if (!values.length) return true;
  return values.some((value) => value === "on" || value === "true" || value === "1");
}

export async function assertInventorySkuAvailable(
  sku: string,
  productSlug: string,
  env: EnvSource = process.env
) {
  const normalizedSku = sku.trim();
  if (!normalizedSku) {
    throw new Error("SKU is required.");
  }

  const existingRows = await fetchAdminRecordsByColumn("inventory", "sku", normalizedSku, env);
  const conflict = existingRows.find((row) => String(row.product_slug ?? "") !== productSlug);
  if (conflict) {
    throw new Error(`SKU "${normalizedSku}" is already assigned to another product.`);
  }

  return normalizedSku;
}

export function parseProductCreateInventoryFromFormData(
  formData: FormData,
  productSlug: string
): ProductInventoryWorkflowInput | null {
  if (!readTrackInventory(formData)) return null;

  const warehouseCode = String(formData.get("inventory_warehouse_code") ?? "").trim();
  const initialQuantity = readOptionalInteger(formData, "inventory_initial_quantity") ?? 0;
  const reorderThreshold = readOptionalInteger(formData, "inventory_reorder_threshold") ?? 0;

  if (!warehouseCode) {
    if (initialQuantity <= 0) return null;
    throw new Error("Warehouse is required when setting initial inventory.");
  }
  if (initialQuantity < 0) {
    throw new Error("Initial quantity cannot be negative.");
  }
  if (reorderThreshold < 0) {
    throw new Error("Reorder threshold cannot be negative.");
  }
  if (initialQuantity > 0 && reorderThreshold > initialQuantity) {
    throw new Error("Reorder threshold cannot exceed initial quantity.");
  }

  const sku = deriveProductSku(productSlug);
  const stockStatus = initialQuantity <= 0
    ? "out_of_stock"
    : reorderThreshold > 0 && initialQuantity <= reorderThreshold
      ? "low_stock"
      : "available";

  return {
    productSlug,
    sku,
    variantId: null,
    stockStatus,
    quantity: initialQuantity,
    reservedQuantity: 0,
    reorderThreshold,
    warehouseCode,
    availableQuantity: initialQuantity,
    committedQuantity: 0,
    changeSummary: "Initial inventory on product creation"
  };
}

export function parseApprovalInventoryFromFormData(
  formData: FormData,
  productSlug: string,
  fallback: SupplierInventoryInit | null = null
): ProductInventoryWorkflowInput | null {
  const warehouseCode = String(formData.get("approval_warehouse_code") ?? fallback?.warehouse_code ?? "").trim();
  const initialQuantity = readOptionalInteger(formData, "approval_initial_quantity")
    ?? fallback?.initial_quantity
    ?? 0;
  const reorderThreshold = readOptionalInteger(formData, "approval_reorder_threshold")
    ?? fallback?.reorder_threshold
    ?? 0;
  const sku = String(formData.get("approval_sku") ?? fallback?.sku ?? "").trim() || deriveProductSku(productSlug);
  const trackInventory = fallback?.track_inventory !== false;

  if (!trackInventory) return null;
  if (!warehouseCode && initialQuantity <= 0) return null;
  if (!warehouseCode) {
    throw new Error("Warehouse is required when approving product stock.");
  }
  if (initialQuantity < 0) {
    throw new Error("Initial quantity cannot be negative.");
  }
  if (reorderThreshold < 0) {
    throw new Error("Reorder threshold cannot be negative.");
  }
  if (initialQuantity > 0 && reorderThreshold > initialQuantity) {
    throw new Error("Reorder threshold cannot exceed initial quantity.");
  }

  const stockStatus = initialQuantity <= 0
    ? "out_of_stock"
    : reorderThreshold > 0 && initialQuantity <= reorderThreshold
      ? "low_stock"
      : "available";

  const stockNotes = String(formData.get("approval_stock_notes") ?? fallback?.stock_notes ?? "").trim();

  return {
    productSlug,
    sku,
    variantId: null,
    stockStatus,
    quantity: initialQuantity,
    reservedQuantity: 0,
    reorderThreshold,
    warehouseCode,
    availableQuantity: initialQuantity,
    committedQuantity: 0,
    changeSummary: stockNotes || "Initial inventory on supplier approval"
  };
}

export async function saveProductInventory(
  input: ProductInventoryWorkflowInput,
  actorId: string,
  options: {
    actorRole?: string | null;
    auditAction?: string;
    env?: EnvSource;
  } = {}
) {
  const env = options.env ?? process.env;
  const now = new Date().toISOString();
  const normalizedInput: ProductInventoryWorkflowInput = {
    ...input,
    sku: deriveProductSku(input.productSlug)
  };

  await assertValidWarehouseCode(normalizedInput.warehouseCode, env);
  await assertInventorySkuAvailable(normalizedInput.sku, normalizedInput.productSlug, env);

  const previousStock = await fetchWarehouseStockBySku(
    normalizedInput.productSlug,
    normalizedInput.sku,
    normalizedInput.warehouseCode,
    env
  );
  const quantityBefore = Number(previousStock?.available_quantity ?? 0);
  const records = buildInventoryLinkageRecords(normalizedInput, { actorId, at: now });

  const saved = await upsertProductInventoryRecord(normalizedInput, actorId, env);

  if (saved.availableQuantity !== quantityBefore) {
    await recordInventoryMovementForStockChange(
      {
        productId: normalizedInput.productSlug,
        sku: normalizedInput.sku,
        variantId: normalizedInput.variantId,
        warehouseCode: normalizedInput.warehouseCode,
        warehouseStockId: String(previousStock?.id ?? "") || null,
        movementType: quantityBefore === 0 && saved.availableQuantity > 0 ? "stock_in" : "adjustment",
        quantityBefore,
        quantityAfter: saved.availableQuantity,
        reasonCode: options.auditAction ?? "inventory.update",
        notes: normalizedInput.changeSummary,
        actorUserId: actorId,
        relatedOrderId: null,
        relatedShipmentId: null,
        at: now
      },
      actorId,
      env
    );
  }

  await recordEntityRevisionSnapshot(
    "inventory",
    `${normalizedInput.productSlug}:${normalizedInput.sku}`,
    {
      inventory: records.inventoryRecord,
      warehouse_stock: records.warehouseStockRecord,
      variant_id: normalizedInput.variantId,
      saved
    },
    actorId,
    normalizedInput.changeSummary,
    env
  );

  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: options.auditAction ?? "inventory.update",
      entity_table: "inventory",
      entity_id: `${normalizedInput.productSlug}:${normalizedInput.sku}`,
      severity: records.lowStock ? "warning" : "info",
      metadata: {
        product_slug: normalizedInput.productSlug,
        sku: normalizedInput.sku,
        variant_id: normalizedInput.variantId,
        warehouse_code: normalizedInput.warehouseCode,
        stock_status: saved.stockStatus,
        quantity: normalizedInput.quantity,
        reserved_quantity: normalizedInput.reservedQuantity,
        reorder_threshold: normalizedInput.reorderThreshold,
        available_quantity: saved.availableQuantity,
        committed_quantity: saved.committedQuantity
      }
    },
    actorId,
    env
  );

  revalidateCatalogSurfaces(normalizedInput.productSlug);

  return { inventoryRecord: records.inventoryRecord, stockRecord: records.warehouseStockRecord, saved };
}

/** @deprecated Use saveProductInventory */
export const syncProductInventoryWorkflow = saveProductInventory;
