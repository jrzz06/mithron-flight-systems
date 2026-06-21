"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/services/auth";
import { fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";
import { appendOrderTimeline, buildOrderTimelineEntry, buildWarehouseAssignmentUpdate, transitionOrderStatus, type OrderStatus } from "@/services/orders";

export async function confirmPaidOrderFormAction(formData: FormData) {
  const context = await requirePermission("orders.write");
  const orderId = String(formData.get("order_id") ?? "").trim();
  if (!orderId) throw new Error("Order id is required.");

  const rows = await fetchAdminRecordsByColumn("orders", "id", orderId);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");

  const currentStatus = String(order.status ?? "pending_payment");
  let nextStatus: OrderStatus;
  if (currentStatus === "paid") {
    nextStatus = transitionOrderStatus(currentStatus, "admin_review");
  } else if (currentStatus === "admin_review") {
    nextStatus = transitionOrderStatus(currentStatus, "confirmed");
  } else {
    throw new Error(`Order cannot be confirmed from status ${currentStatus}.`);
  }
  const timeline = appendOrderTimeline(
    order.timeline,
    buildOrderTimelineEntry({
      status: nextStatus,
      event: "admin_confirm",
      note: "Order confirmed by admin.",
      actorId: context.userId
    })
  );

  await updateAdminRecord(
    "orders",
    "id",
    orderId,
    {
      status: nextStatus,
      timeline,
      updated_at: new Date().toISOString()
    },
    context.userId!
  );
  revalidatePath("/admin/orders");
}

export async function assignOrderToWarehouseFormAction(formData: FormData) {
  const context = await requirePermission("orders.write");
  const orderId = String(formData.get("order_id") ?? "").trim();
  if (!orderId) throw new Error("Order id is required.");

  const rows = await fetchAdminRecordsByColumn("orders", "id", orderId);
  const order = rows[0];
  if (!order) throw new Error("Order not found.");

  const currentStatus = String(order.status ?? "confirmed");
  const { nextStatus, nextFulfillment } = buildWarehouseAssignmentUpdate(
    currentStatus,
    String(order.fulfillment_status ?? "pending")
  );
  const timeline = appendOrderTimeline(
    order.timeline,
    buildOrderTimelineEntry({
      status: nextStatus,
      event: "warehouse_assigned",
      note: nextFulfillment === "processing"
        ? "Order assigned to warehouse."
        : `Order marked assigned while preserving fulfillment status ${nextFulfillment}.`,
      actorId: context.userId
    })
  );

  await updateAdminRecord(
    "orders",
    "id",
    orderId,
    {
      status: nextStatus,
      fulfillment_status: nextFulfillment,
      timeline,
      updated_at: new Date().toISOString()
    },
    context.userId!
  );
  revalidatePath("/admin/orders");
}
