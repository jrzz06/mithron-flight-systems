"use server";

import { revalidatePath } from "next/cache";
import { assertSupabaseAdminConfig } from "@/lib/env";
import {
  assertAdminMutationPermission,
  createActivityLogRecord,
  createOrderItemRecord,
  createOrderRecord,
  createNotificationRecord,
  deleteProductRecordSafely,
  recordEntityRevisionSnapshot,
  updateAdminRecord,
  updateOrderRecord,
  updateProductPublicationRecord,
  upsertInventoryRecord,
  upsertProductRecord,
  upsertWarehouseStockRecord
} from "@/services/admin-actions";
import { readExpectedUpdatedAt, readOptionalExpectedUpdatedAt } from "@/lib/admin/conflict-handling";
import { reserveCheckoutStock } from "@/services/checkout-stock";
import {
  assertOrderFulfillmentTransition,
  buildInventoryLinkageRecords,
  buildOrderCreateWorkflowFromFormData,
  buildOrderLifecycleUpdateFromFormData,
  buildProductInventoryWorkflowFromFormData,
  buildSimpleInventoryUpdateFromFormData
} from "@/services/enterprise-admin-forms";
import {
  CSV_IMPORT_SOURCE_TAG,
  CSV_IMPORT_SOURCE_TAGS,
  inventoryStatusForQuantity,
  mapInventoryCsvRows,
  parseInventoryCsv,
  type InventoryCsvRecord
} from "@/services/inventory-csv";
import { buildValidatedOrderDraft, buildOrderTimelineEntry, appendOrderTimeline, syncOrderStatusFromFulfillment } from "@/services/orders";
import { getProducts } from "@/services/catalog";
import { requirePermission } from "@/services/auth";
import {
  applyFulfillmentStockMovements,
  applyWarehouseStockMovement,
  buildWarehouseMovementFormFromFormData,
  fetchInventoryBySku,
  fetchWarehouseStockBySku,
  recordInventoryMovementForStockChange,
  shouldDeductFulfillmentStock
} from "@/services/warehouse-movements";
import {
  buildShipmentCreateWorkflowFromFormData,
  buildShipmentUpdateWorkflowFromFormData,
  createShipmentWorkflow,
  fetchShipmentsByOrderId,
  updateShipmentWorkflow
} from "@/services/shipments";

type JsonRecord = Record<string, unknown>;
type InventorySourceTable = "inventory" | "warehouse_stock";

const warehouseActionReadColumns = {
  orderLifecycle: "select=id,status,payment_status,fulfillment_status,shipment_tracking,timeline"
};

async function currentActorId() {
  const context = await requireWarehouseActor();
  return context.userId;
}

async function requireWarehouseActor() {
  return requirePermission("orders.lifecycle");
}

function orderNumberFromTimestamp(timestamp: Date) {
  const y = timestamp.getUTCFullYear();
  const m = String(timestamp.getUTCMonth() + 1).padStart(2, "0");
  const d = String(timestamp.getUTCDate()).padStart(2, "0");
  const h = String(timestamp.getUTCHours()).padStart(2, "0");
  const min = String(timestamp.getUTCMinutes()).padStart(2, "0");
  const s = String(timestamp.getUTCSeconds()).padStart(2, "0");
  return `MTH-${y}${m}${d}-${h}${min}${s}`;
}

async function fetchOrderRecord(orderId: string, env: Record<string, string | undefined> = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(`${config.url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&${warehouseActionReadColumns.orderLifecycle}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load order ${orderId}: ${response.status} ${response.statusText}`);
  }

  const rows = (await response.json()) as JsonRecord[];
  if (!rows.length) {
    throw new Error(`Order ${orderId} was not found.`);
  }

  return rows[0];
}

async function fetchOrderLifecycleNotifications(orderId: string, fulfillmentStatus: string, env: Record<string, string | undefined> = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/notifications?select=id,payload&entity_table=eq.orders&entity_id=eq.${encodeURIComponent(orderId)}&limit=50`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load order lifecycle notifications: ${response.status} ${response.statusText}`);
  }

  const rows = (await response.json()) as JsonRecord[];
  return rows.filter((row) => {
    const payload = row.payload;
    return Boolean(
      payload
      && typeof payload === "object"
      && !Array.isArray(payload)
      && (payload as JsonRecord).event === "order.fulfillment_notification"
      && (payload as JsonRecord).fulfillment_status === fulfillmentStatus
    );
  });
}

function notificationForFulfillmentStatus(status: string, orderId: string) {
  const templates: Record<string, { title: string; priority: string }> = {
    shipped: { title: `Order ${orderId} shipped`, priority: "normal" },
    delivered: { title: `Order ${orderId} delivered`, priority: "normal" },
    cancelled: { title: `Order ${orderId} cancelled`, priority: "high" },
    returned: { title: `Order ${orderId} returned`, priority: "high" }
  };

  return templates[status] ?? null;
}

async function createOrderLifecycleNotificationIfNeeded(input: {
  orderId: string;
  previousFulfillment: string;
  nextFulfillment: string;
  actorId: string | null;
  note: string | null;
  at: string;
}) {
  const template = notificationForFulfillmentStatus(input.nextFulfillment, input.orderId);
  if (!template) return null;

  const existing = await fetchOrderLifecycleNotifications(input.orderId, input.nextFulfillment);
  if (existing.length) return null;

  return createNotificationRecord(
    {
      recipient_id: null,
      channel: "operations",
      title: template.title,
      body: input.note ?? `Order fulfillment moved from ${input.previousFulfillment} to ${input.nextFulfillment}.`,
      status: "unread",
      priority: template.priority,
      entity_table: "orders",
      entity_id: input.orderId,
      payload: {
        event: "order.fulfillment_notification",
        previous_fulfillment_status: input.previousFulfillment,
        fulfillment_status: input.nextFulfillment,
        created_by: input.actorId,
        created_at: input.at
      }
    },
    input.actorId
  );
}

function warehouseCodeFromFormData(formData: FormData) {
  const value = formData.get("warehouse_code");
  return typeof value === "string" && value.trim() ? value.trim() : "IN-WEST-01";
}

function readInventoryString(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readInventoryInteger(formData: FormData, key: string, fallback = 0) {
  const raw = readInventoryString(formData, key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative integer.`);
  }
  return parsed;
}

function readInventoryNumber(formData: FormData, key: string, fallback = 0) {
  const raw = readInventoryString(formData, key);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative number.`);
  }
  return parsed;
}

function readInventoryStatus(formData: FormData, key = "stock_status") {
  const status = readInventoryString(formData, key, "available");
  if (status === "available" || status === "low_stock" || status === "out_of_stock" || status === "archived") return status;
  throw new Error(`${key} must be one of: available, low_stock, out_of_stock, archived.`);
}

function revalidateInventoryPaths() {
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  revalidatePath("/warehouse");
  revalidatePath("/warehouse/dashboard");
  revalidatePath("/warehouse/inventory");
  revalidatePath("/warehouse/movements");
  revalidatePath("/warehouse/transfers");
  revalidatePath("/warehouse/activity");
}

function revalidateWarehouseFulfillmentPaths() {
  revalidatePath("/admin/orders");
  revalidatePath("/operations/orders");
  revalidatePath("/warehouse");
  revalidatePath("/warehouse/dashboard");
  revalidatePath("/warehouse/orders");
  revalidatePath("/warehouse/picking");
  revalidatePath("/warehouse/packing");
  revalidatePath("/warehouse/dispatch");
  revalidatePath("/warehouse/returns");
  revalidatePath("/warehouse/movements");
  revalidatePath("/warehouse/shipments");
  revalidatePath("/warehouse/activity");
}

function adminRestHeaders(serviceRoleKey: string, prefer = "return=representation") {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: prefer
  };
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function sourceTableError(response: Response, table: InventorySourceTable, action: string) {
  const body = await response.text();
  return `Failed to ${action} ${table} during CSV source replacement: ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 500)}` : ""}`;
}

async function fetchInventoryCsvSourceSlugs(env: Record<string, string | undefined> = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const tags = [...CSV_IMPORT_SOURCE_TAGS];
  const slugs = new Set<string>();
  const pageSize = 500;

  for (const tag of tags) {
    let offset = 0;

    while (true) {
      const response = await fetch(
        `${config.url}/rest/v1/mithron_products?select=slug&source_availability=eq.${encodeURIComponent(tag)}&limit=${pageSize}&offset=${offset}`,
        {
          headers: adminRestHeaders(config.serviceRoleKey),
          cache: "no-store"
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Failed to read legacy CSV inventory product slugs: ${response.status} ${response.statusText}${body ? ` - ${body.slice(0, 500)}` : ""}`);
      }

      const rows = await response.json() as JsonRecord[];
      if (!rows.length) break;

      for (const row of rows) {
        const slug = String(row.slug ?? "").trim();
        if (slug) slugs.add(slug);
      }

      if (rows.length < pageSize) break;
      offset += pageSize;
    }
  }

  return [...slugs];
}

async function deleteInventorySourceRows(table: InventorySourceTable, productSlugs: string[], env: Record<string, string | undefined> = process.env) {
  if (!productSlugs.length) return 0;
  const config = assertSupabaseAdminConfig(env);
  let deletedRows = 0;
  for (const slugChunk of chunks([...new Set(productSlugs)], 100)) {
    const slugFilter = slugChunk.map((slug) => encodeURIComponent(slug)).join(",");
    const response = await fetch(`${config.url}/rest/v1/${table}?product_slug=in.(${slugFilter})&select=id`, {
      method: "DELETE",
      headers: adminRestHeaders(config.serviceRoleKey)
    });

    if (!response.ok) {
      throw new Error(await sourceTableError(response, table, "delete existing rows from"));
    }
    const deleted = await response.json() as JsonRecord[];
    deletedRows += deleted.length;
  }
  return deletedRows;
}

async function clearInventorySourceTable(table: InventorySourceTable, actorId: string | null, productSlugs: string[]) {
  await assertAdminMutationPermission(table, actorId);
  return deleteInventorySourceRows(table, productSlugs);
}

async function clearInventorySourceTables(actorId: string | null, productSlugs: string[]) {
  return {
    warehouse_stock: await clearInventorySourceTable("warehouse_stock", actorId, productSlugs),
    inventory: await clearInventorySourceTable("inventory", actorId, productSlugs)
  };
}

export async function saveWarehouseInventoryFormAction(formData: FormData) {
  const input = buildProductInventoryWorkflowFromFormData(formData);
  const actorId = await currentActorId();
  const now = new Date().toISOString();
  const previousStock = await fetchWarehouseStockBySku(input.productSlug, input.sku, input.warehouseCode);
  const quantityBefore = Number(previousStock?.available_quantity ?? 0);
  const records = buildInventoryLinkageRecords(input, { actorId, at: now });
  const warehouseStockId = String(previousStock?.id ?? "") || null;
  const movement = await recordInventoryMovementForStockChange(
    {
      productId: input.productSlug,
      sku: input.sku,
      variantId: input.variantId,
      warehouseCode: input.warehouseCode,
      warehouseStockId,
      movementType: "adjustment",
      quantityBefore,
      quantityAfter: input.availableQuantity,
      reasonCode: "warehouse_inventory_edit",
      notes: input.changeSummary,
      actorUserId: actorId,
      relatedOrderId: null,
      relatedShipmentId: null,
      at: now
    },
    actorId
  );

  const inventoryRecord = await upsertInventoryRecord(
    records.inventoryRecord,
    actorId
  );

  const warehouseRecord = await upsertWarehouseStockRecord(
    records.warehouseStockRecord,
    actorId
  );

  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: "warehouse.stock_adjustment",
      entity_table: "warehouse_stock",
      entity_id: `${input.warehouseCode}:${input.productSlug}:${input.sku}`,
      severity: records.lowStock ? "warning" : "info",
      metadata: {
        product_slug: input.productSlug,
        sku: input.sku,
        warehouse_code: input.warehouseCode,
        stock_status: records.inventoryRecord.stock_status,
        quantity: input.quantity,
        reserved_quantity: input.reservedQuantity,
        reorder_threshold: input.reorderThreshold,
        available_quantity: input.availableQuantity,
        committed_quantity: input.committedQuantity,
        variant_id: input.variantId
      }
    },
    actorId
  );

  await recordEntityRevisionSnapshot(
    "inventory",
    `${input.productSlug}:${input.sku}`,
    {
      inventory: inventoryRecord,
      warehouse_stock: warehouseRecord,
      movement,
      variant_id: input.variantId
    },
    actorId,
    input.changeSummary
  );

  revalidatePath("/admin/products");
  revalidatePath("/warehouse");
  revalidatePath("/warehouse/inventory");
  revalidatePath("/warehouse/movements");
}

export async function saveSimpleInventoryFormAction(formData: FormData) {
  const input = buildSimpleInventoryUpdateFromFormData(formData);
  const actorId = await currentActorId();
  const now = new Date().toISOString();
  const previousInventory = await fetchInventoryBySku(input.productSlug, input.sku);
  const previousStock = await fetchWarehouseStockBySku(input.productSlug, input.sku, input.warehouseCode);
  const quantityBefore = Number(previousStock?.available_quantity ?? previousInventory?.quantity ?? 0);
  const reservedQuantity = Math.min(Number(previousInventory?.reserved_quantity ?? 0), input.quantity);
  const reorderThreshold = Number(previousInventory?.reorder_threshold ?? 0);
  const committedQuantity = Math.min(Number(previousStock?.committed_quantity ?? reservedQuantity), input.quantity);
  const previousVariantId = String(previousStock?.variant_id ?? previousInventory?.variant_id ?? "").trim();
  const variantId = input.variantId ?? (previousVariantId || null);
  const records = buildInventoryLinkageRecords(
    {
      productSlug: input.productSlug,
      sku: input.sku,
      variantId,
      stockStatus: input.stockStatus,
      quantity: input.quantity,
      reservedQuantity,
      reorderThreshold,
      warehouseCode: input.warehouseCode,
      availableQuantity: input.quantity,
      committedQuantity,
      changeSummary: input.changeSummary
    },
    { actorId, at: now }
  );
  const warehouseStockId = String(previousStock?.id ?? "") || null;
  const movement = await recordInventoryMovementForStockChange(
    {
      productId: input.productSlug,
      sku: input.sku,
      variantId,
      warehouseCode: input.warehouseCode,
      warehouseStockId,
      movementType: "correction",
      quantityBefore,
      quantityAfter: input.quantity,
      reasonCode: "simple_inventory_update",
      notes: input.note ?? input.changeSummary,
      actorUserId: actorId,
      relatedOrderId: null,
      relatedShipmentId: null,
      at: now
    },
    actorId
  );

  const inventoryRecord = await upsertInventoryRecord(records.inventoryRecord, actorId);
  const warehouseRecord = await upsertWarehouseStockRecord(records.warehouseStockRecord, actorId);

  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: "warehouse.simple_stock_update",
      entity_table: "warehouse_stock",
      entity_id: `${input.warehouseCode}:${input.productSlug}:${input.sku}`,
      severity: records.lowStock ? "warning" : "info",
      metadata: {
        product_slug: input.productSlug,
        sku: input.sku,
        warehouse_code: input.warehouseCode,
        stock_status: records.inventoryRecord.stock_status,
        quantity: input.quantity,
        previous_quantity: quantityBefore,
        variant_id: variantId,
        note: input.note
      }
    },
    actorId
  );

  await recordEntityRevisionSnapshot(
    "inventory",
    `${input.productSlug}:${input.sku}`,
    {
      inventory: inventoryRecord,
      warehouse_stock: warehouseRecord,
      movement,
      variant_id: variantId
    },
    actorId,
    input.changeSummary
  );

  revalidateInventoryPaths();
}

export async function saveInventoryQuickEditFormAction(formData: FormData) {
  const productSlug = readInventoryString(formData, "product_slug");
  const sku = readInventoryString(formData, "sku");
  if (!productSlug || !sku) throw new Error("Product and SKU are required for inventory updates.");

  const warehouseCode = warehouseCodeFromFormData(formData);
  const stockStatus = readInventoryStatus(formData);
  const quantity = readInventoryInteger(formData, "quantity");
  const category = readInventoryString(formData, "category");
  const price = readInventoryNumber(formData, "price");
  const variantId = readInventoryString(formData, "variant_id") || null;
  const note = readInventoryString(formData, "note") || null;
  const expectedWarehouseUpdatedAt = readExpectedUpdatedAt(formData);
  const expectedInventoryUpdatedAt = readOptionalExpectedUpdatedAt(formData, "expected_inventory_updated_at");
  const actorId = await currentActorId();
  const now = new Date().toISOString();
  const previousInventory = await fetchInventoryBySku(productSlug, sku);
  const previousStock = await fetchWarehouseStockBySku(productSlug, sku, warehouseCode);
  const quantityBefore = Number(previousStock?.available_quantity ?? previousInventory?.quantity ?? 0);
  const reservedQuantity = Math.min(Number(previousInventory?.reserved_quantity ?? 0), quantity);
  const reorderThreshold = Number(previousInventory?.reorder_threshold ?? 0);
  const committedQuantity = Math.min(Number(previousStock?.committed_quantity ?? reservedQuantity), quantity);
  const shouldArchiveProduct = stockStatus === "archived";
  if (shouldArchiveProduct) await assertAdminMutationPermission("mithron_products", actorId);
  const persistedStatus = stockStatus === "archived" ? "out_of_stock" : stockStatus;
  const quantityDelta = quantity - quantityBefore;

  let movement: JsonRecord | null = null;
  if (quantityDelta !== 0) {
    const adjustment = await applyWarehouseStockMovement(
      {
        productSlug,
        sku,
        variantId,
        warehouseCode,
        movementType: "correction",
        quantityDelta,
        targetQuantity: null,
        reasonCode: "warehouse_quick_edit",
        notes: note,
        relatedOrderId: null,
        relatedShipmentId: null,
        changeSummary: note ?? `Update inventory for ${productSlug}:${sku}`,
        expectedUpdatedAt: expectedWarehouseUpdatedAt
      },
      { actorId, at: now }
    );
    movement = adjustment.movement as JsonRecord;
  }

  const records = buildInventoryLinkageRecords(
    {
      productSlug,
      sku,
      variantId,
      stockStatus: persistedStatus,
      quantity,
      reservedQuantity,
      reorderThreshold,
      warehouseCode,
      availableQuantity: quantity,
      committedQuantity,
      changeSummary: note ?? `Update inventory for ${productSlug}:${sku}`
    },
    { actorId, at: now }
  );

  const productRecord = shouldArchiveProduct
    ? await updateProductPublicationRecord(
        {
          slug: productSlug,
          category: category || undefined,
          price,
          workflow_status: "archived",
          is_visible: false,
          updated_at: now
        },
        actorId
      )
    : null;

  const inventoryId = String(previousInventory?.id ?? "");
  const inventoryRecord = inventoryId
    ? await updateAdminRecord(
        "inventory",
        "id",
        inventoryId,
        {
          ...records.inventoryRecord,
          updated_at: now
        },
        actorId,
        process.env,
        { expectedUpdatedAt: expectedInventoryUpdatedAt }
      )
    : await upsertInventoryRecord(records.inventoryRecord, actorId);

  const currentStock = await fetchWarehouseStockBySku(productSlug, sku, warehouseCode);
  const warehouseStockId = String(currentStock?.id ?? previousStock?.id ?? "");
  const warehouseRecord = warehouseStockId
    ? await updateAdminRecord(
        "warehouse_stock",
        "id",
        warehouseStockId,
        {
          committed_quantity: committedQuantity,
          variant_id: variantId,
          updated_at: now
        },
        actorId
      )
    : await upsertWarehouseStockRecord(records.warehouseStockRecord, actorId);

  if (quantityDelta === 0 && !movement) {
    movement = (await recordInventoryMovementForStockChange(
      {
        productId: productSlug,
        sku,
        variantId,
        warehouseCode,
        warehouseStockId: warehouseStockId || null,
        movementType: "correction",
        quantityBefore,
        quantityAfter: quantity,
        reasonCode: "warehouse_quick_edit_metadata",
        notes: note,
        actorUserId: actorId,
        relatedOrderId: null,
        relatedShipmentId: null,
        at: now
      },
      actorId
    )) as JsonRecord;
  }

  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: "warehouse.csv_import_inventory_update",
      entity_table: "inventory",
      entity_id: `${productSlug}:${sku}`,
      severity: records.lowStock ? "warning" : "info",
      metadata: {
        product_slug: productSlug,
        sku,
        warehouse_code: warehouseCode,
        stock_status: stockStatus,
        quantity,
        previous_quantity: quantityBefore,
        category,
        price,
        note,
        quantity_delta: quantityDelta
      }
    },
    actorId
  );

  await recordEntityRevisionSnapshot(
    "inventory",
    `${productSlug}:${sku}`,
    { product: productRecord, inventory: inventoryRecord, warehouse_stock: warehouseRecord, movement },
    actorId,
    note ?? `Inventory update for ${productSlug}:${sku}`
  );

  revalidateInventoryPaths();
}

async function importInventoryCsvRecord(record: InventoryCsvRecord, actorId: string | null, now: string) {
  const previousStock = await fetchWarehouseStockBySku(record.productSlug, record.sku, "IN-WEST-01");
  const quantityBefore = Number(previousStock?.available_quantity ?? 0);
  const product = await upsertProductRecord(
    {
      slug: record.productSlug,
      name: record.productName,
      category: record.category,
      price: record.unitPrice,
      image: record.imageUrl ? { src: record.imageUrl, alt: record.productName, source: CSV_IMPORT_SOURCE_TAG } : null,
      workflow_status: "published",
      is_visible: true,
      source_availability: CSV_IMPORT_SOURCE_TAG,
      updated_at: now
    },
    actorId
  );
  const inventory = await upsertInventoryRecord(
    {
      product_slug: record.productSlug,
      sku: record.sku,
      variant_id: null,
      stock_status: record.stockStatus,
      quantity: record.stock,
      reserved_quantity: 0,
      reorder_threshold: 0,
      updated_by: actorId,
      updated_at: now
    },
    actorId
  );
  const stock = await upsertWarehouseStockRecord(
    {
      warehouse_code: "IN-WEST-01",
      product_slug: record.productSlug,
      sku: record.sku,
      variant_id: null,
      available_quantity: record.stock,
      committed_quantity: 0,
      last_counted_at: now,
      updated_by: actorId,
      updated_at: now
    },
    actorId
  );

  const movement = await recordInventoryMovementForStockChange(
    {
      productId: record.productSlug,
      sku: record.sku,
      variantId: null,
      warehouseCode: "IN-WEST-01",
      warehouseStockId: String(previousStock?.id ?? "") || null,
      movementType: "correction",
      quantityBefore,
      quantityAfter: record.stock,
      reasonCode: "csv_import",
      notes: `Imported from inventory CSV row ${record.sourceRow}.`,
      actorUserId: actorId,
      relatedOrderId: null,
      relatedShipmentId: null,
      at: now
    },
    actorId
  );

  return { product, inventory, stock, movement };
}

export async function importInventoryCsvFormAction(formData: FormData) {
  const file = formData.get("inventory_csv");
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error("Choose an inventory CSV file before importing.");
  }
  if (file.size > 2_000_000) {
    throw new Error("Inventory CSV is too large for this import pass.");
  }

  const mapped = mapInventoryCsvRows(parseInventoryCsv(await file.text()));
  if (mapped.errors.length) {
    throw new Error(mapped.errors.slice(0, 5).join(" "));
  }
  if (!mapped.records.length) {
    throw new Error("Inventory CSV did not contain any valid rows.");
  }

  const actorId = await currentActorId();
  const now = new Date().toISOString();
  const sourceSlugs = await fetchInventoryCsvSourceSlugs();
  const cleared = await clearInventorySourceTables(actorId, sourceSlugs);

  for (const record of mapped.records) {
    await importInventoryCsvRecord(record, actorId, now);
  }

  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: "warehouse.csv_import",
      entity_table: "inventory",
      entity_id: "csv-import",
      severity: mapped.warnings.length ? "warning" : "info",
      metadata: {
        imported_rows: mapped.records.length,
        cleared_rows: cleared,
        source_of_truth: "uploaded_csv",
        warnings: mapped.warnings.slice(0, 20),
        generated_skus: mapped.generatedSkus.slice(0, 20)
      }
    },
    actorId
  );

  revalidateInventoryPaths();
}

export async function saveInventoryBulkUpdateFormAction(formData: FormData) {
  const selectedRows = formData.getAll("selected_inventory_row").filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (!selectedRows.length) throw new Error("Select at least one inventory row.");

  const nextStatus = readInventoryStatus(formData, "bulk_stock_status");
  const nextCategory = readInventoryString(formData, "bulk_category");
  const actorId = await currentActorId();
  const now = new Date().toISOString();
  let updated = 0;

  for (const selected of selectedRows) {
    const [warehouseCode = "IN-WEST-01", productSlug = "", sku = ""] = selected.split("::");
    if (!productSlug || !sku) continue;
    const previousInventory = await fetchInventoryBySku(productSlug, sku);
    const previousStock = await fetchWarehouseStockBySku(productSlug, sku, warehouseCode);
    const quantity = Number(previousStock?.available_quantity ?? previousInventory?.quantity ?? 0);
    const persistedStatus = nextStatus === "archived" ? "out_of_stock" : nextStatus;
    await upsertInventoryRecord(
      {
        product_slug: productSlug,
        sku,
        variant_id: previousInventory?.variant_id ?? previousStock?.variant_id ?? null,
        stock_status: persistedStatus || inventoryStatusForQuantity(quantity),
        quantity,
        reserved_quantity: Number(previousInventory?.reserved_quantity ?? 0),
        reorder_threshold: Number(previousInventory?.reorder_threshold ?? 0),
        updated_by: actorId,
        updated_at: now
      },
      actorId
    );
    await upsertWarehouseStockRecord(
      {
        warehouse_code: warehouseCode,
        product_slug: productSlug,
        sku,
        variant_id: previousStock?.variant_id ?? previousInventory?.variant_id ?? null,
        available_quantity: quantity,
        committed_quantity: Number(previousStock?.committed_quantity ?? 0),
        last_counted_at: now,
        updated_by: actorId,
        updated_at: now
      },
      actorId
    );

    const productPayload: JsonRecord = { slug: productSlug, updated_at: now };
    if (nextCategory) productPayload.category = nextCategory;
    if (nextStatus === "archived") {
      productPayload.workflow_status = "archived";
      productPayload.is_visible = false;
    }
    if (nextCategory || nextStatus === "archived") {
      await updateProductPublicationRecord(productPayload, actorId);
    }
    updated += 1;
  }

  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: "warehouse.csv_import_bulk_update",
      entity_table: "inventory",
      entity_id: "bulk",
      severity: nextStatus === "out_of_stock" || nextStatus === "archived" ? "warning" : "info",
      metadata: {
        selected_rows: selectedRows.length,
        updated_rows: updated,
        stock_status: nextStatus,
        category: nextCategory || null
      }
    },
    actorId
  );

  revalidateInventoryPaths();
}

export async function deleteInventoryProductFormAction(formData: FormData) {
  const productSlug = readInventoryString(formData, "product_slug");
  if (!productSlug) throw new Error("Product is required before deleting inventory.");
  const actorId = await currentActorId();
  await deleteProductRecordSafely(productSlug, actorId);
  revalidateInventoryPaths();
}

export async function duplicateInventoryProductFormAction(formData: FormData) {
  const productSlug = readInventoryString(formData, "product_slug");
  const productName = readInventoryString(formData, "product_name", productSlug);
  const sku = readInventoryString(formData, "sku");
  if (!productSlug || !sku) throw new Error("Product and SKU are required before duplicating inventory.");

  const actorId = await currentActorId();
  const now = new Date().toISOString();
  const copySlug = `${productSlug}-copy-${Date.now()}`;
  const copySku = `${sku}-COPY`;
  const quantity = readInventoryInteger(formData, "quantity");
  const price = readInventoryNumber(formData, "price");
  const category = readInventoryString(formData, "category", "Uncategorized");
  const imageUrl = readInventoryString(formData, "product_image");
  const stockStatus = inventoryStatusForQuantity(quantity);

  await upsertProductRecord(
    {
      slug: copySlug,
      name: `${productName} Copy`,
      category,
      price,
      image: imageUrl ? { src: imageUrl, alt: `${productName} Copy`, source: "inventory_duplicate" } : null,
      workflow_status: "draft",
      is_visible: false,
      source_availability: "inventory_duplicate",
      updated_at: now
    },
    actorId
  );
  await upsertInventoryRecord(
    {
      product_slug: copySlug,
      sku: copySku,
      variant_id: null,
      stock_status: stockStatus,
      quantity,
      reserved_quantity: 0,
      reorder_threshold: 0,
      updated_by: actorId,
      updated_at: now
    },
    actorId
  );
  await upsertWarehouseStockRecord(
    {
      warehouse_code: "IN-WEST-01",
      product_slug: copySlug,
      sku: copySku,
      variant_id: null,
      available_quantity: quantity,
      committed_quantity: 0,
      last_counted_at: now,
      updated_by: actorId,
      updated_at: now
    },
    actorId
  );
  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: "warehouse.csv_import_duplicate",
      entity_table: "inventory",
      entity_id: `${copySlug}:${copySku}`,
      severity: "info",
      metadata: {
        source_product_slug: productSlug,
        source_sku: sku,
        product_slug: copySlug,
        sku: copySku
      }
    },
    actorId
  );

  revalidateInventoryPaths();
}

export async function applyWarehouseMovementFormAction(formData: FormData) {
  const input = buildWarehouseMovementFormFromFormData(formData);
  const actorId = await currentActorId();
  const now = new Date().toISOString();

  await applyWarehouseStockMovement(input, {
    actorId,
    at: now
  });

  revalidatePath("/admin/products");
  revalidatePath("/warehouse");
  revalidatePath("/warehouse/inventory");
  revalidatePath("/warehouse/movements");
}

export async function createWarehouseOrderFormAction(formData: FormData) {
  const input = buildOrderCreateWorkflowFromFormData(formData);
  const actorId = await currentActorId();
  const now = new Date();
  const warehouseCode = warehouseCodeFromFormData(formData);
  const catalog = (await getProducts()).map((product) => ({
    slug: product.slug,
    name: product.name,
    price: product.price,
    category: product.category,
    chargeTax: product.chargeTax,
    taxGroup: product.taxGroup,
    taxRate: product.taxRate,
    taxIncluded: product.taxIncluded
  }));
  const draft = buildValidatedOrderDraft(input.checkout, catalog);
  const timeline = appendOrderTimeline(
    [],
    buildOrderTimelineEntry({
      status: input.status,
      event: "order.created",
      note: input.note,
      actorId,
      metadata: {
        source: "warehouse",
        item_count: draft.orderItems.length
      },
      at: now
    })
  );

  const orderRecord = await createOrderRecord(
    {
      order_number: orderNumberFromTimestamp(now),
      customer_email: draft.order.customer_email,
      status: input.status,
      payment_status: input.paymentStatus,
      fulfillment_status: input.fulfillmentStatus,
      channel: draft.order.channel,
      subtotal: draft.order.subtotal,
      total: draft.order.total,
      currency: input.currency,
      // @deprecated orders.items duplicates order_items — keep for compatibility; stop writing in a future migration.
      items: draft.order.items,
      timeline,
      metadata: draft.order.metadata,
      // created_by_user_id is canonical for auth-linked ownership; created_by is legacy staff actor text — remove created_by later.
      created_by: actorId,
      updated_at: now.toISOString()
    },
    actorId
  );

  const orderId = String(orderRecord.id ?? "");
  if (!orderId) {
    throw new Error("Order creation failed to return an id.");
  }

  for (const item of draft.orderItems) {
    await createOrderItemRecord(
      {
        order_id: orderId,
        product_slug: item.product_slug,
        product_name: item.product_name,
        bundle_id: item.bundle_id,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        metadata: item.metadata,
        updated_at: now.toISOString()
      },
      actorId
    );
  }

  const reservationItems = draft.orderItems
    .filter((item) => item.sku)
    .map((item) => ({
      productSlug: item.product_slug,
      quantity: item.quantity,
      sku: item.sku
    }));

  if (reservationItems.length) {
    await reserveCheckoutStock(orderId, reservationItems, process.env, warehouseCode);
  }

  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: "orders.create",
      entity_table: "orders",
      entity_id: orderId,
      severity: "info",
      metadata: {
        status: input.status,
        fulfillment_status: input.fulfillmentStatus,
        payment_status: input.paymentStatus,
        customer_email: draft.order.customer_email,
        item_count: draft.orderItems.length,
        total: draft.order.total,
        warehouse_code: warehouseCode
      }
    },
    actorId
  );

  await recordEntityRevisionSnapshot("orders", orderId, orderRecord as JsonRecord, actorId, input.changeSummary);

  revalidateWarehouseFulfillmentPaths();
}

export async function updateWarehouseOrderLifecycleFormAction(formData: FormData) {
  const input = buildOrderLifecycleUpdateFromFormData(formData);
  const actorId = await currentActorId();
  const now = new Date().toISOString();
  const warehouseCode = warehouseCodeFromFormData(formData);
  const current = await fetchOrderRecord(input.orderId);
  let nextStatus = input.status ?? String(current.status ?? "draft");
  const nextPayment = input.paymentStatus ?? String(current.payment_status ?? "not_required");
  const previousStatus = String(current.status ?? "draft");
  const previousPayment = String(current.payment_status ?? "not_required");
  const previousFulfillment = String(current.fulfillment_status ?? "pending");
  const nextFulfillment = input.fulfillmentStatus
    ? assertOrderFulfillmentTransition(previousFulfillment, input.fulfillmentStatus)
    : previousFulfillment;
  if (input.fulfillmentStatus) {
    nextStatus = syncOrderStatusFromFulfillment(nextStatus, nextFulfillment);
  }
  const existingShipments = await fetchShipmentsByOrderId(input.orderId);
  const fulfillmentMovements = existingShipments.length === 0 && shouldDeductFulfillmentStock(previousFulfillment, nextFulfillment)
    ? await applyFulfillmentStockMovements({
      orderId: input.orderId,
      warehouseCode,
      actorId,
      at: now
    })
    : [];
  const timeline = appendOrderTimeline(
    current.timeline,
    buildOrderTimelineEntry({
      status: nextStatus,
      event: "order.lifecycle_update",
      note: input.note,
      actorId,
      metadata: {
        payment_status: nextPayment,
        previous_status: previousStatus,
        previous_payment_status: previousPayment,
        previous_fulfillment_status: previousFulfillment,
        fulfillment_status: nextFulfillment,
        warehouse_code: warehouseCode,
        inventory_movements: fulfillmentMovements.length
      },
      at: now
    })
  );

  const updated = await updateOrderRecord(
    input.orderId,
    {
      status: nextStatus,
      payment_status: nextPayment,
      fulfillment_status: nextFulfillment,
      shipment_tracking: input.shipmentTracking ?? current.shipment_tracking ?? {},
      timeline,
      updated_at: now
    },
    actorId
  );

  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: "orders.lifecycle_update",
      entity_table: "orders",
      entity_id: input.orderId,
      severity: nextFulfillment === "delivered" || nextFulfillment === "fulfilled" ? "info" : "warning",
      metadata: {
        status: nextStatus,
        payment_status: nextPayment,
        previous_status: previousStatus,
        previous_payment_status: previousPayment,
        previous_fulfillment_status: previousFulfillment,
        fulfillment_status: nextFulfillment,
        warehouse_code: warehouseCode,
        inventory_movements: fulfillmentMovements.length,
        note: input.note
      }
    },
    actorId
  );

  await recordEntityRevisionSnapshot("orders", input.orderId, updated as JsonRecord, actorId, input.changeSummary);

  await createOrderLifecycleNotificationIfNeeded({
    orderId: input.orderId,
    previousFulfillment,
    nextFulfillment,
    actorId,
    note: input.note,
    at: now
  });

  revalidateWarehouseFulfillmentPaths();
  revalidatePath("/warehouse/inventory");
}

export async function createShipmentFormAction(formData: FormData) {
  const input = buildShipmentCreateWorkflowFromFormData(formData);
  const actorId = await currentActorId();
  const now = new Date().toISOString();

  const result = await createShipmentWorkflow(input, {
    actorId,
    at: now
  });

  const shipmentId = String((result.shipment as JsonRecord).id ?? "");
  revalidateWarehouseFulfillmentPaths();
  revalidatePath("/warehouse/inventory");
  if (shipmentId) {
    revalidatePath(`/warehouse/shipments/${shipmentId}`);
  }
}

export async function updateShipmentLifecycleFormAction(formData: FormData) {
  const input = buildShipmentUpdateWorkflowFromFormData(formData);
  const actorId = await currentActorId();
  const now = new Date().toISOString();

  await updateShipmentWorkflow(input, {
    actorId,
    at: now
  });

  revalidateWarehouseFulfillmentPaths();
  revalidatePath("/warehouse/inventory");
  revalidatePath(`/warehouse/shipments/${input.shipmentId}`);
}
