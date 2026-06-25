"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/services/auth";
import {
  assignOrderToWarehouseWorkflow,
  cancelAdminOrderWorkflow,
  confirmAdminOrderWorkflow,
  rejectAdminOrderWorkflow
} from "@/services/order-workflow";

export async function confirmPaidOrderFormAction(formData: FormData) {
  const context = await requireAdminPermission("orders.write");
  const orderId = String(formData.get("order_id") ?? "").trim();
  if (!orderId) throw new Error("Order id is required.");

  const expectedUpdatedAt = String(formData.get("expected_updated_at") ?? "").trim() || null;
  await confirmAdminOrderWorkflow({
    orderId,
    actorId: context.userId!,
    expectedUpdatedAt
  });
  revalidatePath("/admin/orders");
  revalidatePath("/warehouse/orders");
}

export async function rejectAdminOrderFormAction(formData: FormData) {
  const context = await requireAdminPermission("orders.write");
  const orderId = String(formData.get("order_id") ?? "").trim();
  const reason = String(formData.get("reject_reason") ?? "").trim();
  if (!orderId) throw new Error("Order id is required.");

  const expectedUpdatedAt = String(formData.get("expected_updated_at") ?? "").trim() || null;
  await rejectAdminOrderWorkflow({
    orderId,
    actorId: context.userId!,
    reason: reason || undefined,
    expectedUpdatedAt
  });
  revalidatePath("/admin/orders");
  revalidatePath("/admin/enquiries");
}

export async function assignOrderToWarehouseFormAction(formData: FormData) {
  const context = await requireAdminPermission("orders.write");
  const orderId = String(formData.get("order_id") ?? "").trim();
  const warehouseCode = String(formData.get("warehouse_code") ?? "").trim() || undefined;
  if (!orderId) throw new Error("Order id is required.");

  const expectedUpdatedAt = String(formData.get("expected_updated_at") ?? "").trim() || null;
  await assignOrderToWarehouseWorkflow({
    orderId,
    actorId: context.userId!,
    warehouseCode,
    expectedUpdatedAt
  });
  revalidatePath("/admin/orders");
  revalidatePath("/warehouse/orders");
  revalidatePath("/warehouse/dashboard");
}

export async function cancelAdminOrderFormAction(formData: FormData) {
  const context = await requireAdminPermission("orders.write");
  const orderId = String(formData.get("order_id") ?? "").trim();
  const reason = String(formData.get("cancel_reason") ?? "").trim();
  if (!orderId) throw new Error("Order id is required.");
  if (!reason) throw new Error("A cancellation reason is required.");

  const expectedUpdatedAt = String(formData.get("expected_updated_at") ?? "").trim() || null;
  await cancelAdminOrderWorkflow({
    orderId,
    actorId: context.userId!,
    reason,
    expectedUpdatedAt
  });
  revalidatePath("/admin/orders");
  revalidatePath("/warehouse/orders");
  revalidatePath("/admin/enquiries");
}
