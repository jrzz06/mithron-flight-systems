"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentAuthContext } from "@/services/auth";
import { approveAndApplyStockRequest, rejectStockRequest } from "@/services/supplier-stock-requests";
import { repairMissingProductInventory } from "@/services/product-inventory-sync";

function feedbackPath(status: "success" | "error", message: string) {
  return `/admin/inventory?inventory_status=${status}&inventory_message=${encodeURIComponent(message.slice(0, 200))}`;
}

export async function approveStockRequestAction(formData: FormData) {
  const context = await getCurrentAuthContext();
  const actorId = context.userId;
  if (!actorId) redirect("/login?next=/admin/inventory");

  const requestId = String(formData.get("requestId") ?? "").trim();
  try {
    await approveAndApplyStockRequest({ requestId, actorId, apply: true });
  } catch (error) {
    redirect(feedbackPath("error", error instanceof Error ? error.message : "Approval failed."));
  }
  redirect(feedbackPath("success", "Stock request approved and inventory updated."));
}

export async function rejectStockRequestAction(formData: FormData) {
  const context = await getCurrentAuthContext();
  const actorId = context.userId;
  if (!actorId) redirect("/login?next=/admin/inventory");

  const requestId = String(formData.get("requestId") ?? "").trim();
  try {
    await rejectStockRequest({ requestId, actorId });
  } catch (error) {
    redirect(feedbackPath("error", error instanceof Error ? error.message : "Rejection failed."));
  }
  redirect(feedbackPath("success", "Stock request rejected."));
}

export async function syncMissingInventoryAction() {
  const context = await getCurrentAuthContext();
  const actorId = context.userId;
  if (!actorId) redirect("/login?next=/admin/inventory");

  try {
    const result = await repairMissingProductInventory(actorId);
    revalidatePath("/admin/inventory");
    if (result.failed) {
      redirect(feedbackPath("error", `Synced ${result.created} products. ${result.failed} failed.`));
    }
    redirect(
      feedbackPath(
        "success",
        result.created
          ? `Created inventory records for ${result.created} products.`
          : "All products already have inventory records."
      )
    );
  } catch (error) {
    redirect(feedbackPath("error", error instanceof Error ? error.message : "Inventory sync failed."));
  }
}
