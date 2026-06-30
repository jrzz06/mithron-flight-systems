"use server";

import { revalidatePath } from "next/cache";
import { revalidateCatalogSurfaces } from "@/lib/catalog-cache";
import { assertSupabaseAdminConfig } from "@/lib/env";
import {
  assertAdminMutationPermission,
  createActivityLogRecord,
  createCustomerCheckoutNotificationRecord,
  createNotificationRecord,
  fetchAdminRecordsByColumn,
  recordEntityRevisionSnapshot,
  updateOrderRecord,
  updateProductPublicationRecord,
  upsertProductRecord
} from "@/services/admin-actions";
import { readExpectedUpdatedAt, readOptionalExpectedUpdatedAt } from "@/lib/admin/conflict-handling";
import { AdminRecordConflictError } from "@/services/admin-actions";
import { assertValidWarehouseCode } from "@/services/warehouses";
import {
  getDefaultWarehouseCode,
  getWarehouseConfiguration,
  parseWarehouseConfigurationFormData
} from "@/services/warehouse-config";
import {
  assertOrderFulfillmentTransition,
  buildOrderCreateWorkflowFromFormData,
  buildOrderLifecycleUpdateFromFormData,
  buildProductInventoryWorkflowFromFormData,
  buildSimpleInventoryUpdateFromFormData
} from "@/services/enterprise-admin-forms";
import {
  CSV_IMPORT_SOURCE_TAGS,
  inventoryStatusForQuantity,
  mapInventoryCsvRows,
  parseInventoryCsv,
  type InventoryCsvRecord
} from "@/services/inventory-csv";
import { buildOrderTimelineEntry, appendOrderTimeline, syncOrderStatusFromFulfillment } from "@/services/orders";
import { createStaffOrderFromWorkflowInput } from "@/services/manual-order";
import { generateWarehouseOrderNumber } from "@/lib/orders/order-number";
import { orderInventoryDeducted } from "@/services/inventory";
import { deriveProductSku } from "@/lib/product-sku";
import { upsertProductInventoryRecord } from "@/services/product-inventory";
import { saveProductInventory } from "@/services/product-inventory-workflow";
import { requirePermission, getCurrentAuthContext } from "@/services/auth";
import { resolveWarehouseScope } from "@/services/warehouse-scope";
import { roleHasPermission, PermissionDeniedError } from "@/lib/auth/permissions";
import { ProfileDisabledError } from "@/lib/auth/profile-disabled";
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
  fetchShipmentItemsByOrderId,
  fetchShipmentOrderItems,
  fetchShipmentsByOrderId,
  updateShipmentWorkflow
} from "@/services/shipments";
import {
  assertPackingChecklistComplete,
  buildPackingChecklistFromFormData,
  buildRemainingShipmentItems
} from "@/services/warehouse-packing";

type JsonRecord = Record<string, unknown>;
type InventorySourceTable = "inventory" | "warehouse_stock";

const warehouseActionReadColumns = {
  orderLifecycle: "select=id,status,payment_status,fulfillment_status,shipment_tracking,timeline,created_by_user_id,order_number,customer_email"
};

async function currentActorId() {
  const context = await requireWarehouseActor();
  return context.userId;
}

async function requireWarehouseActor() {
  return requirePermission("orders.lifecycle");
}

async function requireWarehouseScope() {
  const context = await requireWarehouseActor();
  return resolveWarehouseScope({ userId: context.userId, role: context.role });
}

async function requireProductCatalogActor() {
  const context = await requirePermission("products.write");
  return context.userId;
}

async function requireInventoryImportActor() {
  const context = await getCurrentAuthContext();
  if (context.disabled) {
    throw new ProfileDisabledError();
  }
  if (roleHasPermission(context.role, "products.write") || roleHasPermission(context.role, "warehouse.write")) {
    return context.userId;
  }
  throw new PermissionDeniedError("The current user does not have permission to import inventory CSV.");
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

async function notifyCustomerAboutFulfillmentIfNeeded(input: {
  orderId: string;
  previousFulfillment: string;
  nextFulfillment: string;
}) {
  if (input.previousFulfillment === input.nextFulfillment) return;
  if (!["shipped", "delivered"].includes(input.nextFulfillment)) return;

  const order = await fetchOrderRecord(input.orderId);
  const customerUserId = String(order.created_by_user_id ?? "").trim();
  const customerEmail = String(order.customer_email ?? "").trim();
  if (!customerUserId && !customerEmail) return;

  const orderNumber = String(order.order_number ?? input.orderId);
  const title = input.nextFulfillment === "delivered" ? "Order delivered" : "Order shipped";
  const body = input.nextFulfillment === "delivered"
    ? `Your order ${orderNumber} has been delivered.`
    : `Your order ${orderNumber} is on its way.`;

  await createCustomerCheckoutNotificationRecord({
    recipient_id: customerUserId || null,
    channel: "customer",
    title,
    body,
    status: "unread",
    entity_table: "orders",
    entity_id: input.orderId,
    metadata: {
      fulfillment_status: input.nextFulfillment,
      order_number: orderNumber,
      recipient_email: customerEmail || undefined
    }
  }).catch(() => undefined);
}

async function resolveWarehouseCodeFromFormData(formData: FormData) {
  const value = formData.get("warehouse_code");
  const raw = typeof value === "string" && value.trim()
    ? value.trim()
    : await getDefaultWarehouseCode();
  return assertValidWarehouseCode(raw);
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

function normalizeLinkageStockStatus(
  status: string,
  quantity: number
): "available" | "out_of_stock" {
  if (status === "out_of_stock" || status === "available") return status;
  return quantity <= 0 ? "out_of_stock" : "available";
}

function readInventoryStatus(formData: FormData, key = "stock_status") {
  const status = readInventoryString(formData, key, "available");
  if (status === "available" || status === "low_stock" || status === "out_of_stock" || status === "archived" || status === "discontinued" || status === "reserved") {
    return status;
  }
  throw new Error(`${key} must be one of: available, low_stock, out_of_stock, archived, discontinued, reserved.`);
}


function revalidateInventoryPaths(productSlug?: string) {
  revalidateCatalogSurfaces(productSlug);
  revalidatePath("/admin/inventory");
  revalidatePath("/warehouse/inventory");
}

function revalidateWarehouseFulfillmentPaths() {
  revalidatePath("/admin/orders");
  revalidatePath("/warehouse/orders");
  revalidatePath("/warehouse/dashboard");
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
  if (!actorId) throw new Error("Authentication required.");

  await saveProductInventory(input, actorId, {
    auditAction: "warehouse.stock_adjustment"
  });

  revalidatePath("/admin/products");
  revalidatePath("/warehouse");
  revalidatePath("/warehouse/inventory");
  revalidatePath("/warehouse/movements");
}

export async function saveSimpleInventoryFormAction(formData: FormData) {
  const input = buildSimpleInventoryUpdateFromFormData(formData);
  const actorId = await currentActorId();
  if (!actorId) throw new Error("Authentication required.");

  const previousInventory = await fetchInventoryBySku(input.productSlug, input.sku);
  const previousStock = await fetchWarehouseStockBySku(input.productSlug, input.sku, input.warehouseCode);
  const previousVariantId = String(previousStock?.variant_id ?? previousInventory?.variant_id ?? "").trim();
  const variantId = input.variantId ?? (previousVariantId || null);

  await saveProductInventory(
    {
      productSlug: input.productSlug,
      sku: input.sku,
      variantId,
      stockStatus: input.stockStatus,
      quantity: input.quantity,
      warehouseCode: input.warehouseCode,
      changeSummary: input.note ?? input.changeSummary
    },
    actorId,
    {
      auditAction: "warehouse.simple_stock_update"
    }
  );

  revalidateInventoryPaths();
}

export async function saveInventoryQuickEditFormAction(formData: FormData) {
  const auth = await getCurrentAuthContext();
  if (auth.disabled) {
    throw new ProfileDisabledError();
  }
  if (!roleHasPermission(auth.role, "products.write")) {
    throw new PermissionDeniedError(
      "Stock edits are managed in the Admin panel. Warehouse operators can view stock levels only."
    );
  }

  const productSlug = readInventoryString(formData, "product_slug");
  const sku = readInventoryString(formData, "sku");
  if (!productSlug || !sku) throw new Error("Product and SKU are required for inventory updates.");

  const warehouseCode = await resolveWarehouseCodeFromFormData(formData);
  const stockStatus = readInventoryStatus(formData);
  const adjustmentMode = readInventoryString(formData, "adjustment_mode")
    || (readInventoryString(formData, "adjustment_type") === "decrease" ? "decrease" : "replace");
  const adjustmentQuantity = readInventoryInteger(formData, "adjustment_quantity");
  let quantity = readInventoryInteger(formData, "quantity");
  const category = readInventoryString(formData, "category");
  const price = readInventoryNumber(formData, "price");
  const variantId = readInventoryString(formData, "variant_id") || null;
  const note = readInventoryString(formData, "note") || null;
  const reasonCode = readInventoryString(formData, "reason_code") || "warehouse_quick_edit";
  const expectedWarehouseUpdatedAt = readExpectedUpdatedAt(formData);
  const expectedInventoryUpdatedAt = readOptionalExpectedUpdatedAt(formData, "expected_inventory_updated_at");
  const actorId = await currentActorId();
  const now = new Date().toISOString();
  const previousInventory = await fetchInventoryBySku(productSlug, sku);
  const previousStock = await fetchWarehouseStockBySku(productSlug, sku, warehouseCode);
  const quantityBefore = Number(previousInventory?.quantity ?? previousStock?.available_quantity ?? 0);

  if (adjustmentMode === "increase") {
    quantity = quantityBefore + (adjustmentQuantity ?? quantity);
  } else if (adjustmentMode === "decrease") {
    quantity = quantityBefore - (adjustmentQuantity ?? quantity);
  } else if (adjustmentMode === "replace") {
    quantity = adjustmentQuantity ?? quantity;
  }

  if (quantity < 0) {
    throw new Error("Stock cannot go below zero.");
  }
  const shouldArchiveProduct = stockStatus === "archived";
  if (shouldArchiveProduct) await assertAdminMutationPermission("mithron_products", actorId);
  const persistedStatus = stockStatus === "archived" ? "out_of_stock" : stockStatus;

  if (
    expectedInventoryUpdatedAt
    && previousInventory?.updated_at
    && String(previousInventory.updated_at) !== expectedInventoryUpdatedAt
  ) {
    throw new AdminRecordConflictError(
      "Concurrent inventory update detected. Reload stock levels and retry.",
      previousInventory
    );
  }
  if (
    expectedWarehouseUpdatedAt
    && previousStock?.updated_at
    && String(previousStock.updated_at) !== expectedWarehouseUpdatedAt
  ) {
    throw new AdminRecordConflictError(
      "Concurrent inventory update detected. Reload stock levels and retry.",
      previousStock
    );
  }

  await saveProductInventory(
    {
      productSlug,
      sku,
      variantId,
      stockStatus: normalizeLinkageStockStatus(persistedStatus, quantity),
      quantity,
      warehouseCode,
      changeSummary: note ?? `Update inventory for ${productSlug}:${sku}`
    },
    actorId!,
    { auditAction: reasonCode }
  );

  if (shouldArchiveProduct || category || price) {
    const productPayload: JsonRecord = {
      slug: productSlug,
      updated_at: now
    };
    if (category) productPayload.category = category;
    if (price) productPayload.price = price;
    if (shouldArchiveProduct) {
      productPayload.workflow_status = "archived";
      productPayload.is_visible = false;
    }
    await updateProductPublicationRecord(productPayload, actorId);
  }

  revalidateInventoryPaths(productSlug);
}

async function importInventoryCsvRecord(
  record: InventoryCsvRecord,
  actorId: string | null,
  now: string,
  warehouseCode: string
) {
  const productSlug = record.productSlug.trim();
  const canonicalSku = deriveProductSku(productSlug);
  const existingProducts = await fetchAdminRecordsByColumn("mithron_products", "slug", productSlug);
  if (!existingProducts.length) {
    throw new Error(
      `Product "${productSlug}" does not exist. Create it in Products before importing inventory for row ${record.sourceRow}.`
    );
  }

  const previousStock = await fetchWarehouseStockBySku(productSlug, canonicalSku, warehouseCode);
  const previousInventory = await fetchInventoryBySku(productSlug, canonicalSku);
  const quantityBefore = Number(previousInventory?.quantity ?? previousStock?.available_quantity ?? 0);
  const product = existingProducts[0];

  await upsertProductInventoryRecord(
    {
      productSlug,
      sku: canonicalSku,
      variantId: null,
      stockStatus: normalizeLinkageStockStatus(record.stockStatus, record.stock),
      quantity: record.stock,
      warehouseCode,
      changeSummary: `Imported from inventory CSV row ${record.sourceRow}.`
    },
    actorId
  );

  const movement = await recordInventoryMovementForStockChange(
    {
      productId: productSlug,
      sku: canonicalSku,
      variantId: null,
      warehouseCode,
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

  return { product, movement };
}

export async function importInventoryCsvFormAction(formData: FormData) {
  await requireInventoryImportActor();
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
  const scope = await requireWarehouseScope();
  const now = new Date().toISOString();
  const sourceSlugs = await fetchInventoryCsvSourceSlugs();
  const cleared = await clearInventorySourceTables(actorId, sourceSlugs);

  for (const record of mapped.records) {
    await importInventoryCsvRecord(record, actorId, now, scope.warehouseCode);
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
  if (nextCategory || nextStatus === "archived") {
    await requireProductCatalogActor();
  }
  const actorId = await currentActorId();
  const scope = await requireWarehouseScope();
  const now = new Date().toISOString();
  let updated = 0;

  for (const selected of selectedRows) {
    const [warehouseCode = scope.warehouseCode, productSlug = "", sku = ""] = selected.split("::");
    if (!productSlug || !sku) continue;
    const previousInventory = await fetchInventoryBySku(productSlug, sku);
    const previousStock = await fetchWarehouseStockBySku(productSlug, sku, warehouseCode);
    const onHandQuantity = Number(previousInventory?.quantity ?? 0);
    const variantId = String(previousInventory?.variant_id ?? previousStock?.variant_id ?? "").trim() || null;
    const persistedStatus = nextStatus === "archived" ? "out_of_stock" : nextStatus;

    await upsertProductInventoryRecord(
      {
        productSlug,
        sku,
        variantId,
        stockStatus: normalizeLinkageStockStatus(persistedStatus || inventoryStatusForQuantity(onHandQuantity), onHandQuantity),
        quantity: onHandQuantity,
        warehouseCode,
        changeSummary: "Bulk inventory update"
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
      action: "warehouse.inventory_bulk_update",
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
  if (!productSlug) throw new Error("Product is required before archiving.");
  const actorId = await requireProductCatalogActor();
  const now = new Date().toISOString();
  await updateProductPublicationRecord(
    {
      slug: productSlug,
      workflow_status: "archived",
      is_visible: false,
      published_at: null,
      archived_at: now,
      updated_at: now
    },
    actorId
  );
  revalidateInventoryPaths(productSlug);
}

export async function duplicateInventoryProductFormAction(formData: FormData) {
  const productSlug = readInventoryString(formData, "product_slug");
  const productName = readInventoryString(formData, "product_name", productSlug);
  const sku = readInventoryString(formData, "sku");
  if (!productSlug || !sku) throw new Error("Product and SKU are required before duplicating inventory.");

  const actorId = await requireProductCatalogActor();
  const context = await getCurrentAuthContext();
  const scope = await resolveWarehouseScope({ userId: context.userId, role: context.role });
  const now = new Date().toISOString();
  const copySlug = `${productSlug}-copy-${Date.now()}`;
  const copySku = deriveProductSku(copySlug);
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

  if (quantity > 0) {
    await saveProductInventory(
      {
        productSlug: copySlug,
        sku: copySku,
        variantId: null,
        stockStatus: normalizeLinkageStockStatus(stockStatus, quantity),
        quantity,
        warehouseCode: scope.warehouseCode,
        changeSummary: `Duplicate inventory from ${productSlug}`
      },
      actorId!,
      { auditAction: "warehouse.inventory_duplicate" }
    );
  } else {
    await createActivityLogRecord(
      {
        actor_id: actorId,
        action: "warehouse.inventory_duplicate",
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
  }

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
  if (!actorId) throw new Error("Unauthorized: no active session.");
  const warehouseCode = await resolveWarehouseCodeFromFormData(formData);

  await createStaffOrderFromWorkflowInput(
    {
      checkout: input.checkout,
      status: input.status,
      paymentStatus: input.paymentStatus,
      fulfillmentStatus: input.fulfillmentStatus,
      currency: input.currency,
      note: input.note,
      changeSummary: input.changeSummary,
      warehouseCode,
      orderNumber: generateWarehouseOrderNumber(),
      createdByStaffId: actorId,
      timelineSource: "warehouse"
    },
    actorId
  );

  revalidateWarehouseFulfillmentPaths();
}

export async function updateWarehouseOrderLifecycleFormAction(formData: FormData) {
  const input = buildOrderLifecycleUpdateFromFormData(formData);
  const actorId = await currentActorId();
  const now = new Date().toISOString();
  const warehouseCode = await resolveWarehouseCodeFromFormData(formData);
  const current = await fetchOrderRecord(input.orderId);
  const expectedUpdatedAt = readExpectedUpdatedAt(formData, String(current.updated_at ?? ""));
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

  const warehouseConfig = await getWarehouseConfiguration();
  const alreadyDeducted = await orderInventoryDeducted(input.orderId).catch(() => false);
  const fulfillmentMovements = !alreadyDeducted
    && shouldDeductFulfillmentStock(previousFulfillment, nextFulfillment, warehouseConfig.stockDeductionTrigger)
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
        inventory_movements: fulfillmentMovements.length,
        stock_deduction_trigger: warehouseConfig.stockDeductionTrigger
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
    actorId,
    process.env,
    { expectedUpdatedAt }
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
        stock_deduction_trigger: warehouseConfig.stockDeductionTrigger,
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

  await notifyCustomerAboutFulfillmentIfNeeded({
    orderId: input.orderId,
    previousFulfillment,
    nextFulfillment
  });

  revalidateWarehouseFulfillmentPaths();
  revalidatePath("/warehouse/inventory");
}

export async function completeWarehousePackingFormAction(formData: FormData) {
  const actorId = await currentActorId();
  const now = new Date().toISOString();
  const checklist = buildPackingChecklistFromFormData(formData);
  const requireItemScan = formData.get("require_item_scan") === "on";
  const order = await fetchOrderRecord(checklist.orderId);
  const previousFulfillment = String(order.fulfillment_status ?? "pending");
  if (!["picked", "packed"].includes(previousFulfillment)) {
    throw new Error(`Order must be picked before packing. Current fulfillment status is "${previousFulfillment}".`);
  }

  const orderItems = await fetchShipmentOrderItems(checklist.orderId);
  assertPackingChecklistComplete(checklist, orderItems, { requireItemScan });

  const warehouseId = readInventoryString(formData, "warehouse_id")
    || await resolveWarehouseCodeFromFormData(formData);
  const carrierName = readInventoryString(formData, "carrier_name") || null;
  const trackingNumber = readInventoryString(formData, "tracking_number") || null;
  const existingShipmentItems = await fetchShipmentItemsByOrderId(checklist.orderId);
  const items = buildRemainingShipmentItems(orderItems, existingShipmentItems, checklist.verifiedItemIds);

  const result = await createShipmentWorkflow(
    {
      orderId: checklist.orderId,
      warehouseId,
      carrierName,
      trackingNumber,
      notes: checklist.packingNote,
      items,
      changeSummary: readInventoryString(formData, "change_summary", `Complete pack for order ${checklist.orderId}`),
      initialStatus: "packed"
    },
    { actorId, at: now }
  );

  const syncedFulfillment = String((result.order as JsonRecord)?.fulfillment_status ?? "");
  if (syncedFulfillment !== "packed" && previousFulfillment === "picked") {
    const nextFulfillment = assertOrderFulfillmentTransition(previousFulfillment, "packed");
    const nextStatus = syncOrderStatusFromFulfillment(String(order.status ?? "assigned"), nextFulfillment);
    await updateOrderRecord(
      checklist.orderId,
      {
        status: nextStatus,
        fulfillment_status: nextFulfillment,
        updated_at: now
      },
      actorId
    );
  }

  revalidateWarehouseFulfillmentPaths();
  revalidatePath("/warehouse/inventory");
  const shipmentId = String((result.shipment as JsonRecord).id ?? "");
  if (shipmentId) {
    revalidatePath(`/warehouse/shipments/${shipmentId}`);
  }

  return {
    shipmentId,
    shipmentNumber: String((result.shipment as JsonRecord).shipment_number ?? ""),
    itemCount: items.length
  };
}

export async function saveWarehouseConfigurationFormAction(formData: FormData) {
  const actorId = await currentActorId();
  const input = parseWarehouseConfigurationFormData(formData);
  if (!input.defaultWarehouseCode) throw new Error("Default warehouse is required.");
  await assertValidWarehouseCode(input.defaultWarehouseCode);
  await assertValidWarehouseCode(input.checkoutWarehouseCode);
  await assertValidWarehouseCode(input.supplierIntakeWarehouseCode);

  const config = assertSupabaseAdminConfig();
  const payload = {
    id: "global",
    default_warehouse_code: input.defaultWarehouseCode,
    checkout_warehouse_code: input.checkoutWarehouseCode,
    supplier_intake_warehouse_code: input.supplierIntakeWarehouseCode,
    auto_reserve_on_allocate: false,
    stock_deduction_trigger: input.stockDeductionTrigger,
    default_carrier: input.defaultCarrier,
    barcode_prefix: input.barcodePrefix,
    printer_name: input.printerName,
    label_width_mm: input.labelWidthMm,
    require_item_scan: input.requireItemScan,
    updated_at: new Date().toISOString(),
    updated_by: actorId
  };

  const response = await fetch(`${config.url}/rest/v1/warehouse_configuration`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Failed to save warehouse configuration (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: "warehouse.configuration.update",
      entity_table: "warehouse_configuration",
      entity_id: "global",
      severity: "info",
      metadata: {
        default_warehouse_code: input.defaultWarehouseCode,
        checkout_warehouse_code: input.checkoutWarehouseCode,
        supplier_intake_warehouse_code: input.supplierIntakeWarehouseCode,
        stock_deduction_trigger: input.stockDeductionTrigger
      }
    },
    actorId
  );

  revalidatePath("/warehouse/settings");
  revalidatePath("/admin/inventory");
  revalidateWarehouseFulfillmentPaths();
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
  const shipmentRows = await fetchAdminRecordsByColumn("shipments", "id", input.shipmentId);
  const shipmentBefore = shipmentRows[0];
  const orderId = String(shipmentBefore?.order_id ?? "");
  const orderBefore = orderId ? await fetchOrderRecord(orderId) : null;
  const previousFulfillment = String(orderBefore?.fulfillment_status ?? "pending");

  const result = await updateShipmentWorkflow(input, {
    actorId,
    at: now
  });

  if (orderId && (input.shipmentStatus === "shipped" || input.shipmentStatus === "delivered")) {
    const nextFulfillment = String(
      result.order?.fulfillment_status ?? (input.shipmentStatus === "delivered" ? "delivered" : "shipped")
    );
    const currentStatus = String(result.order?.status ?? orderBefore?.status ?? "active");
    const nextStatus = syncOrderStatusFromFulfillment(currentStatus, nextFulfillment);
    const carrier = input.carrierName ?? String(shipmentBefore?.carrier_name ?? "");
    const tracking = input.trackingNumber ?? String(shipmentBefore?.tracking_number ?? "");

    await updateOrderRecord(
      orderId,
      {
        status: nextStatus,
        shipment_tracking: {
          carrier,
          tracking_number: tracking
        },
        updated_at: now
      },
      actorId
    );

    await notifyCustomerAboutFulfillmentIfNeeded({
      orderId,
      previousFulfillment,
      nextFulfillment
    });
  }

  revalidateWarehouseFulfillmentPaths();
  revalidatePath("/warehouse/inventory");
  revalidatePath(`/warehouse/shipments/${input.shipmentId}`);
}

export async function advanceWarehouseOrderStepFormAction(formData: FormData) {
  await updateWarehouseOrderLifecycleFormAction(formData);
}

export async function dispatchWarehouseOrderFormAction(formData: FormData) {
  const orderId = readInventoryString(formData, "order_id");
  if (!orderId) throw new Error("Order is required for dispatch.");

  const shipments = await fetchShipmentsByOrderId(orderId);
  const shipment = shipments.find((row) =>
    ["packed", "ready_for_pickup"].includes(String(row.shipment_status ?? "pending"))
  ) ?? shipments[0];

  if (!shipment) {
    throw new Error("No packed shipment is available for this order.");
  }

  const shipmentId = String(shipment.id ?? "");
  const carrierName = String(shipment.carrier_name ?? "");
  const trackingNumber = String(shipment.tracking_number ?? "");
  const shipmentForm = new FormData();
  shipmentForm.set("shipment_id", shipmentId);
  shipmentForm.set("shipment_status", "shipped");
  shipmentForm.set("carrier_name", carrierName);
  shipmentForm.set("tracking_number", trackingNumber);
  shipmentForm.set("notes", "Dispatched from warehouse order queue");
  shipmentForm.set("change_summary", `Dispatch order ${orderId}`);
  await updateShipmentLifecycleFormAction(shipmentForm);

  const order = await fetchOrderRecord(orderId);
  const fulfillment = String(order.fulfillment_status ?? "pending");
  if (["packed", "ready_to_dispatch"].includes(fulfillment)) {
    const lifecycleForm = new FormData();
    lifecycleForm.set("order_id", orderId);
    lifecycleForm.set("fulfillment_status", "shipped");
    lifecycleForm.set("warehouse_code", await resolveWarehouseCodeFromFormData(formData));
    lifecycleForm.set("note", "Order dispatched from warehouse queue");
    lifecycleForm.set("change_summary", `Dispatch order ${orderId}`);
    await updateWarehouseOrderLifecycleFormAction(lifecycleForm);
  }
}
