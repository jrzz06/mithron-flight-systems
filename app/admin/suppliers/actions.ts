"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { createClient as createSupabaseServiceClient } from "@supabase/supabase-js";
import {
  disableManagedUserAction,
  reactivateManagedUserAction
} from "@/app/admin/settings/actions";
import { requireAdminPermission } from "@/services/auth";

function feedbackUrl(status: "success" | "error", message: string) {
  return `/admin/suppliers?supplier_status=${status}&supplier_message=${encodeURIComponent(message)}`;
}

function actionError(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 240);
}

function serviceClient() {
  const config = assertSupabaseAdminConfig(process.env);
  return createSupabaseServiceClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function approveSupplierFormAction(formData: FormData) {
  await requireAdminPermission("settings.write");
  const supplierId = String(formData.get("supplier_id") ?? "").trim();
  const verificationStatus = String(formData.get("verification_status") ?? "").trim();

  try {
    if (!supplierId) throw new Error("Supplier id is required.");

    if (verificationStatus === "disabled") {
      const payload = new FormData();
      payload.set("user_id", supplierId);
      await reactivateManagedUserAction(payload);
    } else if (verificationStatus === "pending") {
      const supabase = serviceClient();
      const updated = await supabase.auth.admin.updateUserById(supplierId, { email_confirm: true });
      if (updated.error) {
        throw new Error(updated.error.message || "Failed to approve supplier account.");
      }
    }

    revalidatePath("/admin/suppliers");
    redirect(feedbackUrl("success", "Supplier approved."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}

export async function suspendSupplierFormAction(formData: FormData) {
  await requireAdminPermission("settings.write");
  const supplierId = String(formData.get("supplier_id") ?? "").trim();

  try {
    if (!supplierId) throw new Error("Supplier id is required.");

    const payload = new FormData();
    payload.set("user_id", supplierId);
    await disableManagedUserAction(payload);

    revalidatePath("/admin/suppliers");
    redirect(feedbackUrl("success", "Supplier suspended."));
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    redirect(feedbackUrl("error", actionError(error)));
  }
}
