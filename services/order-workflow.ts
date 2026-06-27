import { assertSupabaseAdminConfig } from "@/lib/env";
import {
  AdminRecordConflictError,
  appendOrderTimelineViaRpc,
  createActivityLogRecord,
  createNotificationRecord,
  deleteAdminRecord,
  fetchAdminRecordsByColumn,
  transitionOrderWithTimelineViaRpc,
  updateAdminRecord
} from "@/services/admin-actions";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";
import { orderHasCheckoutReservations, releaseCheckoutStock } from "@/services/checkout-stock";
import {
  buildOrderTimelineEntry,
  buildWarehouseAssignmentUpdate,
  transitionOrderStatus,
  type OrderStatus
} from "@/services/orders";
import { assertValidWarehouseCode } from "@/services/warehouses";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function listWarehouseUserIds(env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/user_roles?select=user_id&role_key=eq.warehouse&limit=50`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  const rows = (await response.json()) as Array<{ user_id?: string }>;
  return rows.map((row) => String(row.user_id ?? "")).filter(Boolean);
}

async function syncLinkedEnquiryStatus(
  orderId: string,
  status: "won" | "lost" | "converted" | "contacted",
  actorId: string,
  env: EnvSource
) {
  const enquiries = await fetchAdminRecordsByColumn("enquiries", "converted_order_id", orderId, env);
  for (const enquiry of enquiries) {
    const enquiryId = String(enquiry.id ?? "");
    if (!enquiryId) continue;
    await updateAdminRecord(
      "enquiries",
      "id",
      enquiryId,
      { status, updated_at: new Date().toISOString() },
      actorId,
      env
    );
  }
}

async function resolveAssignmentWarehouseCode(
  order: JsonRecord,
  explicitCode: string | undefined,
  env: EnvSource
) {
  const policy = await getAdminSettingsPolicy(env);
  if (explicitCode?.trim()) {
    return assertValidWarehouseCode(explicitCode.trim(), env);
  }
  const metadata = isPlainRecord(order.metadata) ? order.metadata : {};
  const fromMetadata = typeof metadata.assigned_warehouse_code === "string" ? metadata.assigned_warehouse_code : "";
  if (fromMetadata) return assertValidWarehouseCode(fromMetadata, env);
  return assertValidWarehouseCode(policy.defaultWarehouseCode, env);
}

async function notifyWarehouseAboutOrder(
  order: JsonRecord,
  actorId: string,
  env: EnvSource
) {
  const policy = await getAdminSettingsPolicy(env);
  if (!policy.warehouseAlertsEnabled) return;
  const orderId = String(order.id ?? "");
  const orderNumber = String(order.order_number ?? orderId);
  const warehouseUsers = await listWarehouseUserIds(env);
  const metadata = isPlainRecord(order.metadata) ? order.metadata : {};
  const phone = typeof metadata.customer_phone === "string" ? metadata.customer_phone : "";
  const warehouseCode = typeof metadata.assigned_warehouse_code === "string" ? metadata.assigned_warehouse_code : "";
  const body = [
    `Order ${orderNumber} is ready for fulfillment.`,
    warehouseCode ? `Warehouse: ${warehouseCode}` : null,
    `Customer: ${String(order.customer_email ?? "unknown")}`,
    phone ? `Phone: ${phone}` : null
  ].filter(Boolean).join(" ");

  for (const recipientId of warehouseUsers) {
    await createNotificationRecord(
      {
        recipient_id: recipientId,
        channel: "in_app",
        title: "New warehouse assignment",
        body,
        status: "unread",
        priority: "high",
        entity_table: "orders",
        entity_id: orderId,
        metadata: { order_number: orderNumber }
      },
      actorId,
      env
    );
  }
}

export async function notifyCustomerAboutOrder(
  order: JsonRecord,
  title: string,
  body: string,
  actorId: string,
  env: EnvSource
) {
  const metadata = isPlainRecord(order.metadata) ? order.metadata : {};
  const userId = typeof order.created_by_user_id === "string"
    ? order.created_by_user_id
    : typeof metadata.created_by_user_id === "string"
      ? metadata.created_by_user_id
      : null;
  const customerEmail = String(order.customer_email ?? "").trim();
  if (!userId && !customerEmail) return;

  await createNotificationRecord(
    {
      recipient_id: userId,
      channel: "customer",
      title,
      body,
      status: "unread",
      entity_table: "orders",
      entity_id: String(order.id ?? ""),
      metadata: { recipient_email: customerEmail || undefined }
    },
    actorId,
    env
  ).catch(() => undefined);
}

export async function confirmAdminOrderWorkflow(
  input: { orderId: string; actorId: string; expectedUpdatedAt?: string | null },
  env: EnvSource = process.env
) {
  const rows = await fetchAdminRecordsByColumn("orders", "id", input.orderId, env);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");

  const currentStatus = String(order.status ?? "pending_payment");
  let nextStatus: OrderStatus;
  let event: string;
  let note: string;

  if (currentStatus === "paid") {
    nextStatus = transitionOrderStatus(currentStatus, "admin_review");
    event = "admin_review";
    note = "Order moved to admin review after payment verification.";
  } else if (currentStatus === "admin_review") {
    nextStatus = transitionOrderStatus(currentStatus, "confirmed");
    event = "admin_confirm";
    note = "Order confirmed by admin.";
  } else {
    throw new Error(`Order cannot be confirmed from status ${currentStatus}.`);
  }

  const idempotencyKey = `${event}:${input.orderId}`;
  const timelineEntry = buildOrderTimelineEntry({
    status: nextStatus,
    event,
    note,
    actorId: input.actorId,
    metadata: { idempotency_key: idempotencyKey }
  });

  const updated = await transitionOrderWithTimelineViaRpc(
    input.orderId,
    timelineEntry,
    input.actorId,
    env,
    {
      status: nextStatus,
      expectedUpdatedAt: input.expectedUpdatedAt ?? (String(order.updated_at ?? "") || null),
      idempotencyKey
    }
  );

  if (nextStatus === "confirmed") {
    await syncLinkedEnquiryStatus(input.orderId, "won", input.actorId, env);
    await notifyCustomerAboutOrder(
      updated,
      "Order confirmed",
      "Your order has been approved. We will notify you when it ships.",
      input.actorId,
      env
    );
  }

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: event,
      entity_table: "orders",
      entity_id: input.orderId,
      severity: "info",
      metadata: { status: nextStatus }
    },
    input.actorId,
    env
  );

  return updated;
}

export async function rejectAdminOrderWorkflow(
  input: { orderId: string; actorId: string; reason?: string; expectedUpdatedAt?: string | null },
  env: EnvSource = process.env
) {
  const rows = await fetchAdminRecordsByColumn("orders", "id", input.orderId, env);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");

  const currentStatus = String(order.status ?? "");
  if (currentStatus !== "admin_review") {
    throw new Error(`Only orders in admin review can be rejected (current: ${currentStatus}).`);
  }

  const idempotencyKey = `admin_reject:${input.orderId}`;
  const timelineEntry = buildOrderTimelineEntry({
    status: "cancelled",
    event: "admin_reject",
    note: input.reason?.trim() || "Order rejected by admin.",
    actorId: input.actorId,
    metadata: { idempotency_key: idempotencyKey }
  });

  const updated = await transitionOrderWithTimelineViaRpc(
    input.orderId,
    timelineEntry,
    input.actorId,
    env,
    {
      status: "cancelled",
      fulfillmentStatus: "cancelled",
      expectedUpdatedAt: input.expectedUpdatedAt ?? (String(order.updated_at ?? "") || null),
      idempotencyKey
    }
  );

  await syncLinkedEnquiryStatus(input.orderId, "lost", input.actorId, env);
  await notifyCustomerAboutOrder(
    updated,
    "Order not approved",
    input.reason?.trim() || "Your enquiry/order request was not approved. Contact support for details.",
    input.actorId,
    env
  );

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: "admin_reject",
      entity_table: "orders",
      entity_id: input.orderId,
      severity: "warning",
      metadata: { reason: input.reason ?? null }
    },
    input.actorId,
    env
  );

  return updated;
}

export async function cancelAdminOrderWorkflow(
  input: { orderId: string; actorId: string; reason: string; expectedUpdatedAt?: string | null },
  env: EnvSource = process.env
) {
  const rows = await fetchAdminRecordsByColumn("orders", "id", input.orderId, env);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");

  const currentStatus = String(order.status ?? "");
  const fulfillmentStatus = String(order.fulfillment_status ?? "");
  const terminalStatuses = ["cancelled", "delivered", "returned"];
  if (terminalStatuses.includes(currentStatus) || terminalStatuses.includes(fulfillmentStatus)) {
    throw new Error(`Order cannot be cancelled in its current state (${currentStatus}).`);
  }

  const reason = input.reason.trim();
  if (!reason) throw new Error("A cancellation reason is required.");

  const idempotencyKey = `admin_cancel:${input.orderId}`;
  const timelineEntry = buildOrderTimelineEntry({
    status: "cancelled",
    event: "admin_cancel",
    note: reason,
    actorId: input.actorId,
    metadata: { idempotency_key: idempotencyKey }
  });

  const updated = await transitionOrderWithTimelineViaRpc(
    input.orderId,
    timelineEntry,
    input.actorId,
    env,
    {
      status: "cancelled",
      fulfillmentStatus: "cancelled",
      expectedUpdatedAt: input.expectedUpdatedAt ?? (String(order.updated_at ?? "") || null),
      idempotencyKey
    }
  );

  await syncLinkedEnquiryStatus(input.orderId, "lost", input.actorId, env);
  await notifyCustomerAboutOrder(
    updated,
    "Order cancelled",
    reason,
    input.actorId,
    env
  );

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: "admin_cancel",
      entity_table: "orders",
      entity_id: input.orderId,
      severity: "warning",
      metadata: { reason }
    },
    input.actorId,
    env
  );

  return updated;
}

export async function assignOrderToWarehouseWorkflow(
  input: { orderId: string; actorId: string; warehouseCode?: string; expectedUpdatedAt?: string | null },
  env: EnvSource = process.env
) {
  const rows = await fetchAdminRecordsByColumn("orders", "id", input.orderId, env);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");

  const warehouseCode = await resolveAssignmentWarehouseCode(order, input.warehouseCode, env);
  const currentStatus = String(order.status ?? "confirmed");
  const { nextStatus, nextFulfillment } = buildWarehouseAssignmentUpdate(
    currentStatus,
    String(order.fulfillment_status ?? "pending")
  );

  const idempotencyKey = `warehouse_assigned:${input.orderId}`;
  const timelineEntry = buildOrderTimelineEntry({
    status: nextStatus,
    event: "warehouse_assigned",
    note: `Order assigned to warehouse ${warehouseCode}.`,
    actorId: input.actorId,
    metadata: { idempotency_key: idempotencyKey, fulfillment_status: nextFulfillment, warehouse_code: warehouseCode }
  });

  const updated = await transitionOrderWithTimelineViaRpc(
    input.orderId,
    timelineEntry,
    input.actorId,
    env,
    {
      status: nextStatus,
      fulfillmentStatus: nextFulfillment,
      expectedUpdatedAt: input.expectedUpdatedAt ?? (String(order.updated_at ?? "") || null),
      idempotencyKey
    }
  );

  const existingMetadata = isPlainRecord(order.metadata) ? order.metadata : {};
  await updateAdminRecord(
    "orders",
    "id",
    input.orderId,
    {
      metadata: {
        ...existingMetadata,
        assigned_warehouse_code: warehouseCode
      },
      updated_at: new Date().toISOString()
    },
    input.actorId,
    env
  );

  await syncLinkedEnquiryStatus(input.orderId, "converted", input.actorId, env);
  await notifyWarehouseAboutOrder(
    {
      ...updated,
      metadata: {
        ...(isPlainRecord(updated.metadata) ? updated.metadata : existingMetadata),
        assigned_warehouse_code: warehouseCode
      }
    },
    input.actorId,
    env
  );

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: "warehouse_assigned",
      entity_table: "orders",
      entity_id: input.orderId,
      severity: "info",
      metadata: { fulfillment_status: nextFulfillment, warehouse_code: warehouseCode }
    },
    input.actorId,
    env
  );

  return updated;
}

/** Fallback when only timeline append is needed without status change. */
export async function appendOrderTimelineEntryWorkflow(
  input: { orderId: string; entry: JsonRecord; actorId: string; expectedUpdatedAt?: string | null },
  env: EnvSource = process.env
) {
  return appendOrderTimelineViaRpc(input.orderId, input.entry, input.actorId, env, {
    expectedUpdatedAt: input.expectedUpdatedAt
  });
}

const deletableOrderStatuses = new Set([
  "draft",
  "pending_payment",
  "admin_review",
  "cancelled"
]);

const activeFulfillmentStatuses = ["processing", "picked", "packed", "ready_to_dispatch", "shipped", "delivered", "assigned"];
const activeOrderStatuses = ["assigned", "processing", "packed", "dispatched", "delivered"];

function assertOrderCanBeRemoved(order: JsonRecord) {
  const status = String(order.status ?? "");
  const fulfillmentStatus = String(order.fulfillment_status ?? "");
  if (activeFulfillmentStatuses.includes(fulfillmentStatus) || activeOrderStatuses.includes(status)) {
    throw new Error("Orders in active fulfillment cannot be deleted. Cancel the order instead.");
  }
}

export async function archiveAdminOrderWorkflow(
  input: { orderId: string; actorId: string; reason?: string },
  env: EnvSource = process.env
) {
  const rows = await fetchAdminRecordsByColumn("orders", "id", input.orderId, env);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");
  if (order.deleted_at) throw new Error("Deleted orders must be restored before archiving.");

  const now = new Date().toISOString();
  const updated = await updateAdminRecord(
    "orders",
    "id",
    input.orderId,
    { archived_at: now, updated_at: now },
    input.actorId,
    env
  );

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: "admin_archive",
      entity_table: "orders",
      entity_id: input.orderId,
      severity: "info",
      metadata: { reason: input.reason?.trim() ?? null }
    },
    input.actorId,
    env
  );

  return updated;
}

export async function softDeleteAdminOrderWorkflow(
  input: { orderId: string; actorId: string; reason: string },
  env: EnvSource = process.env
) {
  const rows = await fetchAdminRecordsByColumn("orders", "id", input.orderId, env);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");

  const status = String(order.status ?? "");
  const channel = String(order.channel ?? "checkout");
  assertOrderCanBeRemoved(order);
  if (!deletableOrderStatuses.has(status) && channel !== "enquiry") {
    throw new Error(`Order cannot be moved to trash in its current state (${status}).`);
  }

  const reason = input.reason.trim();
  if (!reason) throw new Error("A deletion reason is required.");

  const hasReservations = await orderHasCheckoutReservations(input.orderId, env).catch(() => false);
  if (hasReservations) {
    await releaseCheckoutStock(input.orderId, env);
  }

  const now = new Date().toISOString();
  const updated = await updateAdminRecord(
    "orders",
    "id",
    input.orderId,
    {
      deleted_at: now,
      deleted_by: input.actorId,
      updated_at: now
    },
    input.actorId,
    env
  );

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: "admin_soft_delete",
      entity_table: "orders",
      entity_id: input.orderId,
      severity: "warning",
      metadata: {
        reason,
        order_number: String(order.order_number ?? ""),
        customer_email: String(order.customer_email ?? "")
      }
    },
    input.actorId,
    env
  );

  return { deleted: true, orderId: input.orderId, row: updated };
}

export async function restoreAdminOrderWorkflow(
  input: { orderId: string; actorId: string },
  env: EnvSource = process.env
) {
  const rows = await fetchAdminRecordsByColumn("orders", "id", input.orderId, env);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");

  const now = new Date().toISOString();
  const updated = await updateAdminRecord(
    "orders",
    "id",
    input.orderId,
    {
      deleted_at: null,
      deleted_by: null,
      archived_at: null,
      updated_at: now
    },
    input.actorId,
    env
  );

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: "admin_restore",
      entity_table: "orders",
      entity_id: input.orderId,
      severity: "info"
    },
    input.actorId,
    env
  );

  return updated;
}

export async function permanentDeleteAdminOrderWorkflow(
  input: { orderId: string; actorId: string; reason: string },
  env: EnvSource = process.env
) {
  const rows = await fetchAdminRecordsByColumn("orders", "id", input.orderId, env);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");
  if (!order.deleted_at) {
    throw new Error("Only orders in trash can be permanently deleted.");
  }

  const status = String(order.status ?? "");
  const channel = String(order.channel ?? "checkout");
  assertOrderCanBeRemoved(order);
  if (!deletableOrderStatuses.has(status) && channel !== "enquiry") {
    throw new Error(`Order cannot be permanently deleted in its current state (${status}).`);
  }

  const reason = input.reason.trim();
  if (!reason) throw new Error("A deletion reason is required.");

  const hasReservations = await orderHasCheckoutReservations(input.orderId, env).catch(() => false);
  if (hasReservations) {
    await releaseCheckoutStock(input.orderId, env);
  }

  const linkedEnquiries = await fetchAdminRecordsByColumn("enquiries", "converted_order_id", input.orderId, env);
  for (const enquiry of linkedEnquiries) {
    const enquiryId = String(enquiry.id ?? "");
    if (!enquiryId) continue;
    const payload = isPlainRecord(enquiry.payload) ? enquiry.payload : {};
    await updateAdminRecord(
      "enquiries",
      "id",
      enquiryId,
      {
        converted_order_id: null,
        payload: {
          ...payload,
          order_id: null,
          order_number: null
        },
        updated_at: new Date().toISOString()
      },
      input.actorId,
      env
    );
  }

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: "admin_delete",
      entity_table: "orders",
      entity_id: input.orderId,
      severity: "warning",
      metadata: {
        reason,
        order_number: String(order.order_number ?? ""),
        customer_email: String(order.customer_email ?? "")
      }
    },
    input.actorId,
    env
  );

  await deleteAdminRecord("orders", "id", input.orderId, input.actorId, env);
  return { deleted: true, orderId: input.orderId };
}

export async function deleteAdminOrderWorkflow(
  input: { orderId: string; actorId: string; reason: string },
  env: EnvSource = process.env
) {
  return softDeleteAdminOrderWorkflow(input, env);
}

export { AdminRecordConflictError };
