"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { operationalFeedbackFromActionError, readExpectedUpdatedAt } from "@/lib/admin/conflict-handling";
import { requirePermission } from "@/services/auth";
import { revalidateCatalogSurfaces } from "@/lib/catalog-cache";
import {
  createNotificationRecord,
  fetchAdminRecordsByColumn,
  updateAdminRecord
} from "@/services/admin-actions";
import { ensureProductCatalogInventoryRecord } from "@/services/product-inventory-sync";
import { assertProductCanPublish } from "@/services/product-publish";

async function runSupplierApprovalAction(successMessage: string, action: () => Promise<void>) {
  let status: "success" | "error" | "conflict" = "success";
  let message = successMessage;

  try {
    await action();
  } catch (error) {
    const feedback = operationalFeedbackFromActionError(error);
    status = feedback.status === "warning" ? "conflict" : "error";
    message = feedback.message;
  }

  const params = new URLSearchParams({
    approval_status: status,
    approval_message: message.slice(0, 240)
  });
  redirect(`/admin/suppliers/products?${params.toString()}`);
}

export async function approveProductSubmissionFormAction(formData: FormData) {
  await runSupplierApprovalAction("Product approved and published.", async () => {
    const context = await requirePermission("products.write");
    const slug = String(formData.get("slug") ?? "").trim();
    if (!slug) throw new Error("Product slug is required.");
    const rows = await fetchAdminRecordsByColumn("mithron_products", "slug", slug);
    const product = rows[0];
    if (!product) throw new Error("Product not found.");
    if (String(product.workflow_status) !== "pending_review") {
      throw new Error("Only pending_review products can be approved.");
    }
    if (!String(product.supplier_id ?? "").trim()) {
      throw new Error(
        `Product "${slug}" is missing a supplier owner. Reject it or assign supplier_id before approval.`
      );
    }

    await assertProductCanPublish(slug, { requireSupplier: true });
    const expectedUpdatedAt = readExpectedUpdatedAt(formData, String(product.updated_at ?? ""));
    await ensureProductCatalogInventoryRecord(slug, context.userId);
    await updateAdminRecord(
      "mithron_products",
      "slug",
      slug,
      {
        workflow_status: "published",
        is_visible: true,
        approved_at: new Date().toISOString(),
        approved_by: context.userId,
        rejection_reason: null,
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      context.userId,
      process.env,
      { expectedUpdatedAt }
    );

    const supplierId = String(product.supplier_id ?? "");
    if (supplierId) {
      await createNotificationRecord(
        {
          recipient_id: supplierId,
          channel: "supplier",
          title: "Product approved",
          body: `${String(product.name)} is now published on the storefront and seeded into inventory.`,
          status: "unread",
          entity_table: "mithron_products",
          entity_id: slug
        },
        context.userId
      );
    }

    revalidateCatalogSurfaces(slug);
    revalidatePath("/admin/suppliers/products");
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");
    revalidatePath("/warehouse/inventory");
    revalidatePath("/supplier/submissions");
    revalidatePath("/supplier/products");
  });
}

export async function rejectProductSubmissionFormAction(formData: FormData) {
  await runSupplierApprovalAction("Product rejected.", async () => {
    const context = await requirePermission("products.write");
    const slug = String(formData.get("slug") ?? "").trim();
    const reason = String(formData.get("rejection_reason") ?? "").trim();
    if (!slug || !reason) throw new Error("Product slug and rejection reason are required.");
    const rows = await fetchAdminRecordsByColumn("mithron_products", "slug", slug);
    const product = rows[0];
    if (!product) throw new Error("Product not found.");
    if (String(product.workflow_status) !== "pending_review") {
      throw new Error("Only pending_review products can be rejected.");
    }

    const expectedUpdatedAt = readExpectedUpdatedAt(formData, String(product.updated_at ?? ""));
    await updateAdminRecord(
      "mithron_products",
      "slug",
      slug,
      {
        workflow_status: "rejected",
        is_visible: false,
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      },
      context.userId,
      process.env,
      { expectedUpdatedAt }
    );

    const supplierId = String(product.supplier_id ?? "");
    if (supplierId) {
      await createNotificationRecord(
        {
          recipient_id: supplierId,
          channel: "supplier",
          title: "Product rejected",
          body: `${String(product.name)} was rejected: ${reason}`,
          status: "unread",
          entity_table: "mithron_products",
          entity_id: slug
        },
        context.userId
      );
    }

    revalidatePath("/admin/suppliers/products");
    revalidatePath("/supplier/submissions");
    revalidatePath("/supplier/products");
  });
}
