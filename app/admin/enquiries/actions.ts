"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/services/auth";
import { assignEnquiry } from "@/services/enquiries";

export async function assignEnquiryFormAction(formData: FormData) {
  const context = await requirePermission("enquiries.write");
  const enquiryId = String(formData.get("enquiry_id") ?? "").trim();
  const assignedTo = String(formData.get("assigned_to") ?? context.userId ?? "").trim();
  if (!enquiryId || !assignedTo) throw new Error("Enquiry id and assignee are required.");
  await assignEnquiry(enquiryId, assignedTo, context.userId!);
  revalidatePath("/admin/enquiries");
}
