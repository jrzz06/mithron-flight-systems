"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminPermission } from "@/services/auth";
import {
  addEnquiryNote,
  closeEnquiry,
  markCheckoutOrderEnquiryContacted,
  markEnquiryContacted,
  promoteCheckoutOrderEnquiry,
  promoteEnquiryToOrder,
  qualifyEnquiry,
  updateEnquiryMeta
} from "@/services/enquiries";

function readString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function feedbackUrl(status: "success" | "error", message: string) {
  return `/admin/enquiries?enquiry_status=${status}&enquiry_message=${encodeURIComponent(message)}`;
}

function actionError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 240);
}

export async function markEnquiryContactedFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const enquiryId = readString(formData, "enquiry_id");
  const orderId = readString(formData, "order_id");
  const queueKind = readString(formData, "queue_kind");
  const note = readString(formData, "note");

  try {
    if (queueKind === "checkout_order") {
      if (!orderId) throw new Error("Order id is required for checkout enquiries.");
      await markCheckoutOrderEnquiryContacted(orderId, context.userId!, note || undefined);
    } else {
      if (!enquiryId) throw new Error("Enquiry id is required.");
      await markEnquiryContacted(enquiryId, context.userId!, context.userId!, note || undefined);
    }
    revalidatePath("/admin/enquiries");
    redirect(feedbackUrl("success", "Enquiry marked as contacted."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}

export async function addEnquiryNoteFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const enquiryId = readString(formData, "enquiry_id");
  const note = readString(formData, "note");

  try {
    if (!enquiryId) throw new Error("Enquiry id is required.");
    if (!note) throw new Error("A note is required.");
    await addEnquiryNote(enquiryId, context.userId!, note);
    revalidatePath("/admin/enquiries");
    redirect(feedbackUrl("success", "Note saved."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}

export async function qualifyEnquiryFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const enquiryId = readString(formData, "enquiry_id");
  const note = readString(formData, "note");

  try {
    if (!enquiryId) throw new Error("Enquiry id is required.");
    await qualifyEnquiry(enquiryId, context.userId!, note || undefined);
    revalidatePath("/admin/enquiries");
    redirect(feedbackUrl("success", "Enquiry marked as qualified."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}

/** @deprecated Use markEnquiryContactedFormAction */
export async function assignEnquiryFormAction(formData: FormData) {
  return markEnquiryContactedFormAction(formData);
}

export async function convertEnquiryToOrderFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const enquiryId = readString(formData, "enquiry_id");
  const orderId = readString(formData, "order_id");
  const queueKind = readString(formData, "queue_kind");

  try {
    if (queueKind === "checkout_order") {
      if (!orderId) throw new Error("Order id is required for checkout enquiries.");
      await promoteCheckoutOrderEnquiry(orderId, context.userId!);
    } else {
      if (!enquiryId) throw new Error("Enquiry id is required.");
      await promoteEnquiryToOrder(enquiryId, context.userId!);
    }
    revalidatePath("/admin/enquiries");
    revalidatePath("/admin/orders");
    redirect(feedbackUrl("success", "Enquiry converted to order."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}

export async function closeEnquiryFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const enquiryId = readString(formData, "enquiry_id");
  const note = readString(formData, "note");

  try {
    if (!enquiryId) throw new Error("Enquiry id is required.");
    await closeEnquiry(enquiryId, context.userId!, note || undefined);
    revalidatePath("/admin/enquiries");
    redirect(feedbackUrl("success", "Enquiry closed."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}

export async function updateEnquiryMetaFormAction(formData: FormData) {
  const context = await requireAdminPermission("enquiries.write");
  const enquiryId = readString(formData, "enquiry_id");

  try {
    if (!enquiryId) throw new Error("Enquiry id is required.");
    await updateEnquiryMeta(
      enquiryId,
      context.userId!,
      {
        priority: readString(formData, "priority"),
        assignedTo: readString(formData, "assigned_to"),
        followUpDate: readString(formData, "follow_up_date")
      }
    );
    revalidatePath("/admin/enquiries");
    redirect(feedbackUrl("success", "Enquiry details updated."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}
