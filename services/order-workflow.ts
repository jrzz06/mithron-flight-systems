import { assertSupabaseAdminConfig } from "@/lib/env";
import {
  AdminRecordConflictError,
  appendOrderTimelineViaRpc,
  createActivityLogRecord,
  createNotificationRecord,
  fetchAdminRecordsByColumn,
  transitionOrderWithTimelineViaRpc,
  updateAdminRecord
} from "@/services/admin-actions";
import {
  buildOrderTimelineEntry,
  buildWarehouseAssignmentUpdate,
  transitionOrderStatus,
  type OrderStatus
} from "@/services/orders";

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

async function notifyWarehouseAboutOrder(
  order: JsonRecord,
  actorId: string,
  env: EnvSource
) {
  const orderId = String(order.id ?? "");
  const orderNumber = String(order.order_number ?? orderId);
  const warehouseUsers = await listWarehouseUserIds(env);
  const metadata = isPlainRecord(order.metadata) ? order.metadata : {};
  const phone = typeof metadata.customer_phone === "string" ? metadata.customer_phone : "";
  const body = [
    `Order ${orderNumber} is ready for fulfillment.`,
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

async function notifyCustomerAboutOrder(
  order: JsonRecord,
  title: string,
  body: string,
  actorId: string,
  env: EnvSource
) {
  const metadata = isPlainRecord(order.metadata) ? order.metadata : {};
  const userId = typeof metadata.created_by_user_id === "string" ? metadata.created_by_user_id : null;
  if (!userId) return;

  await createNotificationRecord(
    {
      recipient_id: userId,
      channel: "customer",
      title,
      body,
      status: "unread",
      entity_table: "orders",
      entity_id: String(order.id ?? ""),
      metadata: { recipient_email: String(order.customer_email ?? "") }
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
      expectedUpdatedAt: input.expectedUpdatedAt ?? String(order.updated_at ?? "") || null,
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
      expectedUpdatedAt: input.expectedUpdatedAt ?? String(order.updated_at ?? "") || null,
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

export async function assignOrderToWarehouseWorkflow(
  input: { orderId: string; actorId: string; expectedUpdatedAt?: string | null },
  env: EnvSource = process.env
) {
  const rows = await fetchAdminRecordsByColumn("orders", "id", input.orderId, env);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");

  const currentStatus = String(order.status ?? "confirmed");
  const { nextStatus, nextFulfillment } = buildWarehouseAssignmentUpdate(
    currentStatus,
    String(order.fulfillment_status ?? "pending")
  );

  const idempotencyKey = `warehouse_assigned:${input.orderId}`;
  const timelineEntry = buildOrderTimelineEntry({
    status: nextStatus,
    event: "warehouse_assigned",
    note: "Order assigned to warehouse with full customer and line-item context.",
    actorId: input.actorId,
    metadata: { idempotency_key: idempotencyKey, fulfillment_status: nextFulfillment }
  });

  const updated = await transitionOrderWithTimelineViaRpc(
    input.orderId,
    timelineEntry,
    input.actorId,
    env,
    {
      status: nextStatus,
      fulfillmentStatus: nextFulfillment,
      expectedUpdatedAt: input.expectedUpdatedAt ?? String(order.updated_at ?? "") || null,
      idempotencyKey
    }
  );

  await syncLinkedEnquiryStatus(input.orderId, "converted", input.actorId, env);
  await notifyWarehouseAboutOrder(updated, input.actorId, env);

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: "warehouse_assigned",
      entity_table: "orders",
      entity_id: input.orderId,
      severity: "info",
      metadata: { fulfillment_status: nextFulfillment }
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

export { AdminRecordConflictError };
