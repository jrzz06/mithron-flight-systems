"use server";

import { redirect } from "next/navigation";
import { getCurrentAuthContext } from "@/services/auth";
import { updateReturnRequestStatus } from "@/services/order-returns";

function feedbackPath(status: "success" | "error", message: string) {
  return `/warehouse/returns?operation_status=${status}&operation_message=${encodeURIComponent(message.slice(0, 220))}`;
}

export async function approveCustomerReturnRequestAction(formData: FormData) {
  const context = await getCurrentAuthContext();
  const actorId = context.userId;
  if (!actorId) redirect("/login?next=/warehouse/returns");

  const requestId = String(formData.get("requestId") ?? "").trim();
  const action = String(formData.get("action") ?? "approve").trim();
  const adminNote = String(formData.get("adminNote") ?? "").trim() || undefined;

  try {
    if (action === "reject") {
      await updateReturnRequestStatus({
        requestId,
        fromStatus: "requested",
        toStatus: "rejected",
        actorId,
        actorRole: "warehouse",
        adminNote
      });
    } else if (action === "receive") {
      await updateReturnRequestStatus({
        requestId,
        fromStatus: "approved",
        toStatus: "received",
        actorId,
        actorRole: "warehouse",
        adminNote
      });
    } else {
      await updateReturnRequestStatus({
        requestId,
        fromStatus: "requested",
        toStatus: "approved",
        actorId,
        actorRole: "warehouse",
        adminNote
      });
    }
  } catch (error) {
    redirect(feedbackPath("error", error instanceof Error ? error.message : "Return update failed."));
  }

  redirect(feedbackPath("success", "Customer return request updated."));
}
