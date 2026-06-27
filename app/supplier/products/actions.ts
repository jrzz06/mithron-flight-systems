"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isActionNavigationError } from "@/lib/server-action-errors";
import { readEditorDocumentFields } from "@/lib/editor/read-form-content";
import { readExpectedUpdatedAt } from "@/lib/admin/conflict-handling";
import { parseSupplierProductForm } from "@/lib/supplier/product-form";
import { logSupplierProductFormDebug } from "@/lib/supplier/product-form-debug";
import type { SupplierProductFormState } from "@/components/supplier/supplier-new-product-form";
import { createNotificationRecord, fetchAdminRecordsByColumn, upsertProductMediaAssetRecord } from "@/services/admin-actions";
import { resolveSupplierProductImageFields, readProductImageSrc } from "@/lib/supplier/product-image";
import { requirePermission } from "@/services/auth";
import {
  createSupplierProductDraft,
  deleteSupplierOwnedProduct,
  listAdminUserIds,
  submitSupplierProductForReview,
  supplierProductMutationOptions,
  updateSupplierOwnedProduct
} from "@/services/supplier-actions";

function actionMessage(error: unknown) {
  if (isActionNavigationError(error)) throw error;
  const message = error instanceof Error ? error.message : "Could not save product draft.";
  if (message.includes("NEXT_REDIRECT") || message.includes("NEXT_NOT_FOUND")) {
    throw error;
  }
  return message.slice(0, 240);
}

function supplierProductRedirect(path: string, status: "success" | "error", message: string): never {
  redirect(`${path}?product_status=${status}&product_message=${encodeURIComponent(message.slice(0, 240))}`);
}

function readSupplierProductDescriptionFields(formData: FormData) {
  const editor = readEditorDocumentFields(formData, "description_json", "description");
  if (!editor) return {};
  return {
    description: editor.html || null,
    description_json: editor.json
  };
}

async function notifyAdminsOfSubmission(productName: string, slug: string, actorId: string) {
  const adminIds = await listAdminUserIds();
  await Promise.all(
    adminIds.map((adminId) =>
      createNotificationRecord(
        {
          recipient_id: adminId,
          channel: "admin",
          title: "Product submitted for review",
          body: `Supplier submitted "${productName}" (${slug}) for approval.`,
          status: "unread",
          entity_table: "mithron_products",
          entity_id: slug
        },
        actorId
      ).catch((notificationError) => {
        console.warn("[mithron-supplier] Failed to notify admin of product submission.", notificationError);
        return undefined;
      })
    )
  );
}

async function saveSupplierProductDraft(formData: FormData) {
  const rawEntries = Object.fromEntries(formData.entries());
  logSupplierProductFormDebug("raw FormData", rawEntries);

  const context = await requirePermission("products.submit");
  if (!context.userId) throw new Error("Authentication required.");

  logSupplierProductFormDebug("auth context", {
    userId: context.userId,
    role: context.role
  });

  let parsed;
  try {
    parsed = parseSupplierProductForm(formData);
  } catch (validationError) {
    logSupplierProductFormDebug("validation error", {
      message: actionMessage(validationError),
      rawPrice: String(formData.get("price") ?? "")
    });
    throw validationError;
  }

  const { name, category, price, slug } = parsed;
  const submitForApproval = String(formData.get("submit_for_approval") ?? "0") === "1";

  logSupplierProductFormDebug("parsed values", {
    name,
    category,
    price,
    slug,
    submitForApproval,
    rawPrice: String(formData.get("price") ?? "")
  });

  const insertPayload = {
    slug,
    name,
    tagline: name,
    category,
    price,
    product_url: `/product/${slug}`,
    gallery: [],
    variants: [],
    bundles: [],
    story: [],
    specs: {},
    anchors: [],
    interests: [],
    ...readSupplierProductDescriptionFields(formData)
  };

  const { image, hero, gallery, uploadedImage } = await resolveSupplierProductImageFields(formData, {
    slug,
    name,
    actorId: context.userId,
    requireImage: true
  });

  logSupplierProductFormDebug("insert payload", {
    supplierId: context.userId,
    insertPayload: { ...insertPayload, image, hero, gallery }
  });

  await createSupplierProductDraft(
    context.userId,
    {
      ...insertPayload,
      image,
      hero,
      gallery
    },
    context.userId
  );

  if (uploadedImage) {
    await upsertProductMediaAssetRecord(
      {
        product_slug: slug,
        media_asset_id: uploadedImage.mediaAssetId,
        usage: "primary",
        sort_order: 0,
        is_primary: true,
        alt_text: name,
        caption: name,
        metadata: {
          bucket: uploadedImage.bucket,
          storage_path: uploadedImage.storagePath,
          optimized_storage_path: uploadedImage.optimizedStoragePath,
          original_storage_path: uploadedImage.storagePath,
          public_url: uploadedImage.publicUrl,
          source: "supplier-product-create"
        },
        updated_at: new Date().toISOString()
      },
      context.userId,
      undefined,
      supplierProductMutationOptions
    );
  }

  logSupplierProductFormDebug("insert success", { slug, workflow_status: "draft" });

  revalidatePath("/supplier/products");

  if (submitForApproval) {
    try {
      await submitSupplierProductForReview(context.userId, slug, context.userId);
      await notifyAdminsOfSubmission(name, slug, context.userId);
      revalidatePath("/admin/suppliers/products");
      logSupplierProductFormDebug("redirect", {
        target: "/supplier/products",
        status: "success",
        message: `"${name}" saved and sent for review.`
      });
      supplierProductRedirect(
        "/supplier/products",
        "success",
        `"${name}" saved and sent for review.`
      );
    } catch (submitError) {
      if (isActionNavigationError(submitError)) throw submitError;
      logSupplierProductFormDebug("submit-after-create error", { message: actionMessage(submitError), slug });
      supplierProductRedirect(
        `/supplier/products/${slug}/edit`,
        "error",
        `"${name}" saved as draft but could not be sent for review. Open My products and click Send for review. ${actionMessage(submitError)}`
      );
    }
  }

  logSupplierProductFormDebug("redirect", {
    target: `/supplier/products/${slug}/edit`,
    status: "success",
    message: `"${name}" saved as draft. Send for review when ready.`
  });

  supplierProductRedirect(
    `/supplier/products/${slug}/edit`,
    "success",
    `"${name}" saved as draft. Send for review when ready.`
  );
}

export async function createSupplierProductFormStateAction(
  _prev: SupplierProductFormState,
  formData: FormData
): Promise<SupplierProductFormState> {
  try {
    await saveSupplierProductDraft(formData);
  } catch (error) {
    if (isActionNavigationError(error)) throw error;
    const message = actionMessage(error);
    logSupplierProductFormDebug("action error", { message });
    return {
      status: "error",
      message,
      debug: process.env.SUPPLIER_PRODUCT_FORM_DEBUG === "1"
        ? [{ label: "Server action error", value: message }]
        : undefined
    };
  }

  return { status: "idle", message: "" };
}

export async function updateSupplierProductFormStateAction(
  _prev: SupplierProductFormState,
  formData: FormData
): Promise<SupplierProductFormState> {
  try {
    const context = await requirePermission("products.submit");
    if (!context.userId) throw new Error("Authentication required.");
    const slug = String(formData.get("slug") ?? "").trim();
    if (!slug) throw new Error("Product slug is required.");

    const { name, category, price } = parseSupplierProductForm(formData);
    const existingRows = await fetchAdminRecordsByColumn("mithron_products", "slug", slug);
    const existingImageSrc = readProductImageSrc(existingRows[0]?.image) || readProductImageSrc(existingRows[0]?.hero);

    const { image, hero, gallery, uploadedImage } = await resolveSupplierProductImageFields(formData, {
      slug,
      name,
      actorId: context.userId,
      existingImageSrc,
      requireImage: false
    });

    await updateSupplierOwnedProduct(
      context.userId,
      slug,
      {
        name,
        category,
        price,
        image,
        hero,
        gallery,
        ...readSupplierProductDescriptionFields(formData),
        updated_at: new Date().toISOString()
      },
      context.userId,
      process.env,
      { expectedUpdatedAt: readExpectedUpdatedAt(formData, String(existingRows[0]?.updated_at ?? "")) }
    );

    if (uploadedImage) {
      await upsertProductMediaAssetRecord(
        {
          product_slug: slug,
          media_asset_id: uploadedImage.mediaAssetId,
          usage: "primary",
          sort_order: 0,
          is_primary: true,
          alt_text: name,
          caption: name,
          metadata: {
            bucket: uploadedImage.bucket,
            storage_path: uploadedImage.storagePath,
            optimized_storage_path: uploadedImage.optimizedStoragePath,
            original_storage_path: uploadedImage.storagePath,
            public_url: uploadedImage.publicUrl,
            source: "supplier-product-update"
          },
          updated_at: new Date().toISOString()
        },
        context.userId,
        undefined,
        supplierProductMutationOptions
      );
    }
    revalidatePath(`/supplier/products/${slug}/edit`);
    revalidatePath("/supplier/products");
    return { status: "success", message: "Product changes saved." };
  } catch (error) {
    if (isActionNavigationError(error)) throw error;
    return { status: "error", message: actionMessage(error) };
  }
}

export async function submitSupplierProductFormAction(formData: FormData) {
  try {
    const context = await requirePermission("products.submit");
    if (!context.userId) throw new Error("Authentication required.");
    const slug = String(formData.get("slug") ?? "").trim();
    if (!slug) throw new Error("Product slug is required.");

    const rows = await fetchAdminRecordsByColumn("mithron_products", "slug", slug);
    const productName = String(rows[0]?.name ?? slug);

    await submitSupplierProductForReview(context.userId, slug, context.userId);
    await notifyAdminsOfSubmission(productName, slug, context.userId);

    revalidatePath("/supplier/products");
    revalidatePath("/admin/suppliers/products");
    supplierProductRedirect("/supplier/products", "success", `"${productName}" sent for review.`);
  } catch (error) {
    if (isActionNavigationError(error)) throw error;
    supplierProductRedirect("/supplier/products", "error", actionMessage(error));
  }
}

export async function deleteSupplierProductFormAction(formData: FormData) {
  try {
    const context = await requirePermission("products.submit");
    if (!context.userId) throw new Error("Authentication required.");
    const slug = String(formData.get("slug") ?? "").trim();
    if (!slug) throw new Error("Product slug is required.");

    const productName = await deleteSupplierOwnedProduct(context.userId, slug, context.userId);

    revalidatePath("/supplier/products");
    supplierProductRedirect("/supplier/products", "success", `"${productName}" draft deleted.`);
  } catch (error) {
    if (isActionNavigationError(error)) throw error;
    supplierProductRedirect("/supplier/products", "error", actionMessage(error));
  }
}
