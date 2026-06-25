"use server";

import { revalidatePath } from "next/cache";
import { requireAdminPermission } from "@/services/auth";
import {
  assignOrderToWarehouseWorkflow,
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
  if (!orderId) throw new Error("Order id is required.");

  const expectedUpdatedAt = String(formData.get("expected_updated_at") ?? "").trim() || null;
  await assignOrderToWarehouseWorkflow({
    orderId,
    actorId: context.userId!,
    expectedUpdatedAt
  });
  revalidatePath("/admin/orders");
  revalidatePath("/warehouse/orders");
  revalidatePath("/warehouse/dashboard");
}
