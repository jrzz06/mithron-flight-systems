"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/services/auth";
import {
  archiveContactRequest,
  linkContactRequestToOrder,
  markContactRequestContacted,
  rejectContactRequest,
  restoreContactRequest
} from "@/services/contact-requests";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function feedbackUrl(status: "success" | "error", message: string) {
  return `/admin/contact-requests?request_status=${status}&request_message=${encodeURIComponent(message)}`;
}

function actionError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 240);
}

export async function markContactRequestContactedFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const contactRequestId = readString(formData, "contact_request_id");
  const note = readString(formData, "note");

  try {
    if (!contactRequestId) throw new Error("Contact request id is required.");
    await markContactRequestContacted(contactRequestId, context.userId!, context.userId!, note || undefined);
    revalidatePath("/admin/contact-requests");
    redirect(feedbackUrl("success", "Contact request marked as contacted."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}

export async function archiveContactRequestFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const contactRequestId = readString(formData, "contact_request_id");
  const note = readString(formData, "note");

  try {
    if (!contactRequestId) throw new Error("Contact request id is required.");
    await archiveContactRequest(contactRequestId, context.userId!, note || undefined);
    revalidatePath("/admin/contact-requests");
    redirect(feedbackUrl("success", "Contact request archived."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}

export async function rejectContactRequestFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const contactRequestId = readString(formData, "contact_request_id");
  const note = readString(formData, "note");

  try {
    if (!contactRequestId) throw new Error("Contact request id is required.");
    await rejectContactRequest(contactRequestId, context.userId!, note || undefined);
    revalidatePath("/admin/contact-requests");
    redirect(feedbackUrl("success", "Contact request rejected."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}

export async function restoreContactRequestFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const contactRequestId = readString(formData, "contact_request_id");

  try {
    if (!contactRequestId) throw new Error("Contact request id is required.");
    await restoreContactRequest(contactRequestId, context.userId!);
    revalidatePath("/admin/contact-requests");
    redirect(feedbackUrl("success", "Contact request restored."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}

export async function linkContactRequestToOrderFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const contactRequestId = readString(formData, "contact_request_id");
  const orderId = readString(formData, "order_id");

  try {
    if (!contactRequestId) throw new Error("Contact request id is required.");
    if (!orderId) throw new Error("Order id is required.");
    await linkContactRequestToOrder(contactRequestId, orderId, context.userId!);
    revalidatePath("/admin/contact-requests");
    revalidatePath("/admin/orders");
    redirect(
      `/admin/orders?order=${encodeURIComponent(orderId)}&queue=pending_verification&request_status=success&request_message=${encodeURIComponent("Contact request linked to order.")}`
    );
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}
