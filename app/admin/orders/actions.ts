"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/services/auth";
import { buildManualOrderInputFromFormData } from "@/services/enterprise-admin-forms";
import { createAdminManualOrderWorkflow } from "@/services/manual-order";
import {
  archiveAdminOrderWorkflow,
  assignOrderToWarehouseWorkflow,
  cancelAdminOrderWorkflow,
  confirmAdminOrderWorkflow,
  deleteAdminOrderWorkflow,
  permanentDeleteAdminOrderWorkflow,
  rejectAdminOrderWorkflow,
  restoreAdminOrderWorkflow
} from "@/services/order-workflow";

export async function createAdminManualOrderFormAction(formData: FormData) {
  const context = await requireAdminPermission("orders.write");
  const input = buildManualOrderInputFromFormData(formData);
  const result = await createAdminManualOrderWorkflow(input, context.userId!);

  revalidatePath("/admin/orders");
  revalidatePath("/warehouse/orders");

  const params = new URLSearchParams({
    order: result.orderNumber,
    queue: "confirmed",
    order_status: "success",
    order_message: `Order ${result.orderNumber} created.`
  });
  redirect(`/admin/orders?${params.toString()}`);
}

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

export async function deleteAdminOrderFormAction(formData: FormData) {
  const context = await requireAdminPermission("orders.write");
  const orderId = String(formData.get("order_id") ?? "").trim();
  const reason = String(formData.get("delete_reason") ?? "").trim();
  if (!orderId) throw new Error("Order id is required.");
  if (!reason) throw new Error("A deletion reason is required.");

  await deleteAdminOrderWorkflow({
    orderId,
    actorId: context.userId!,
    reason
  });
  revalidatePath("/admin/orders");
  revalidatePath("/warehouse/orders");
  revalidatePath("/admin/enquiries");
}

export async function archiveAdminOrderFormAction(formData: FormData) {
  const context = await requireAdminPermission("orders.write");
  const orderId = String(formData.get("order_id") ?? "").trim();
  const reason = String(formData.get("archive_reason") ?? "").trim();
  if (!orderId) throw new Error("Order id is required.");

  await archiveAdminOrderWorkflow({
    orderId,
    actorId: context.userId!,
    reason: reason || undefined
  });
  revalidatePath("/admin/orders");
}

export async function restoreAdminOrderFormAction(formData: FormData) {
  const context = await requireAdminPermission("orders.write");
  const orderId = String(formData.get("order_id") ?? "").trim();
  if (!orderId) throw new Error("Order id is required.");

  await restoreAdminOrderWorkflow({
    orderId,
    actorId: context.userId!
  });
  revalidatePath("/admin/orders");
  revalidatePath("/warehouse/orders");
}

export async function permanentDeleteAdminOrderFormAction(formData: FormData) {
  const context = await requireAdminPermission("orders.permanent_delete");
  const orderId = String(formData.get("order_id") ?? "").trim();
  const reason = String(formData.get("delete_reason") ?? "").trim();
  if (!orderId) throw new Error("Order id is required.");
  if (!reason) throw new Error("A deletion reason is required.");

  await permanentDeleteAdminOrderWorkflow({
    orderId,
    actorId: context.userId!,
    reason
  });
  revalidatePath("/admin/orders");
  revalidatePath("/warehouse/orders");
  revalidatePath("/admin/enquiries");
}
