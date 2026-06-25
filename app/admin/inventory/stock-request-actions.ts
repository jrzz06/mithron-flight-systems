"use server";

import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/services/auth";
import { approveAndApplyStockRequest, rejectStockRequest } from "@/services/supplier-stock-requests";

function feedbackPath(status: "success" | "error", message: string) {
  return `/admin/inventory?stock_status=${status}&stock_message=${encodeURIComponent(message.slice(0, 200))}`;
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
