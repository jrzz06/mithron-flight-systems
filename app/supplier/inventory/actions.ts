"use server";

import { redirect } from "next/navigation";
import { requirePermission } from "@/services/auth";
import { createSupplierStockRequest } from "@/services/supplier-stock-requests";

function feedbackPath(status: "success" | "error", message: string) {
  return `/supplier/inventory?operation_status=${status}&operation_message=${encodeURIComponent(message.slice(0, 200))}`;
}

export async function submitSupplierStockRequestAction(formData: FormData) {
  const context = await requirePermission("products.submit");
  const userId = context.userId;
  if (!userId) redirect("/login?next=/supplier/inventory");

  const productSlug = String(formData.get("productSlug") ?? "").trim();
  const requestedQuantity = Number(formData.get("requestedQuantity"));
  const note = String(formData.get("note") ?? "").trim();

  try {
    await createSupplierStockRequest({
      supplierId: userId,
      productSlug,
      requestedQuantity,
      note: note || undefined,
      idempotencyKey: `stock:${userId}:${productSlug}:${requestedQuantity}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stock request failed.";
    redirect(feedbackPath("error", message));
  }

  redirect(feedbackPath("success", "Stock update request submitted for admin approval."));
}
