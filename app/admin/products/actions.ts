"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { getProductManagerSnapshot } from "@/services/admin";
import {
  buildProductCategoryMetadataFromFormData,
  buildProductDraftFromFormData,
  buildProductDeleteFromFormData,
  buildProductMediaLinkFromFormData,
  buildProductPublishStateFromFormData,
  buildProductQuickEditFromFormData,
  buildProductSeoDraftFromFormData,
  buildProductVariantsWorkflowFromFormData
} from "@/services/product-admin-forms";
import {
  createActivityLogRecord,
  deleteAdminRecord,
  deleteProductRecordSafely,
  recordEntityRevisionSnapshot,
  upsertAdminRecord,
  upsertMediaAssetRecord,
  upsertInventoryRecord,
  AdminRecordConflictError,
  updateAdminRecord,
  updateProductPublicationRecord,
  upsertProductMediaAssetRecord,
  upsertWarehouseStockRecord,
  upsertProductRecord,
  setProductMediaPrimaryViaRpc
} from "@/services/admin-actions";
import { getCurrentAuthContext, requirePermission } from "@/services/auth";
import { buildInventoryLinkageRecords, buildProductInventoryWorkflowFromFormData } from "@/services/enterprise-admin-forms";
import {
  assertAllowedMediaMimeType,
  buildMediaAssetId,
  buildMediaAssetRecordFromFormData,
  buildStorageObjectPath
} from "@/services/media-manager";
import {
  buildOptimizedVariantStoragePath,
  buildResponsiveVariantsMetadata,
  buildSupabasePublicObjectUrl,
  createOptimizedImageVariants,
  findStoredOptimizedVariant,
  findLargestStoredAvifVariant,
  type StoredOptimizedImageVariant
} from "@/services/media-optimization";
import { markProductPublished } from "@/services/product-publish";
import { revalidateCatalogSurfaces } from "@/lib/catalog-cache";
import { fetchWarehouseStockBySku, recordInventoryMovementForStockChange } from "@/services/warehouse-movements";
import { autoCutoutIfNeeded } from "@/lib/catalog/auto-cutout";

async function currentActorContext() {
  const context = await getCurrentAuthContext();
  return {
    actorId: context.userId,
    actorRole: context.role
  };
}

async function recordProductAuditTrail(input: {
  action: string;
  entityTable: string;
  entityId: string;
  snapshot: Record<string, unknown>;
  actorId: string | null;
  actorRole: string | null;
  changeSummary?: string | null;
  severity?: "info" | "warning";
  metadata?: Record<string, unknown>;
}) {
  await recordEntityRevisionSnapshot(
    input.entityTable,
    input.entityId,
    {
      ...input.snapshot,
      audit_context: {
        action: input.action,
        actor_role: input.actorRole,
        ...(input.metadata ?? {})
      }
    },
    input.actorId,
    input.changeSummary ?? input.action
  );

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: input.action,
      entity_table: input.entityTable,
      entity_id: input.entityId,
      severity: input.severity ?? "info",
      metadata: {
        actor_role: input.actorRole,
        change_summary: input.changeSummary ?? null,
        ...(input.metadata ?? {})
      }
    },
    input.actorId
  );
}

function productActionErrorMessage(error: unknown) {
  if (error instanceof AdminRecordConflictError) {
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function encodeObjectPath(path: string) {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function readOptionalFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeCategoryName(value: string) {
  return value.trim().toLowerCase();
}

function slugifyProductName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Product name must contain letters or numbers before a local image can be uploaded.");
  }

  return slug;
}

async function readImageDimensions(buffer: Buffer, mimeType: string) {
  if (!mimeType.startsWith("image/")) return { width: null as number | null, height: null as number | null };

  try {
    const metadata = await sharp(buffer, { failOn: "none" }).metadata();
    return {
      width: typeof metadata.width === "number" ? metadata.width : null,
      height: typeof metadata.height === "number" ? metadata.height : null
    };
  } catch {
    return { width: null as number | null, height: null as number | null };
  }
}

async function uploadProductStorageObject(bucket: string, storagePath: string, contentType: string, buffer: Buffer) {
  const config = assertSupabaseAdminConfig();
  const uploadBody = new Uint8Array(buffer.byteLength);
  uploadBody.set(buffer);

  const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${encodeObjectPath(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "false"
    },
    body: uploadBody
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase Storage upload failed for ${bucket}/${storagePath}: ${response.status} ${response.statusText} ${text}`);
  }

  return buildSupabasePublicObjectUrl(config.url, bucket, storagePath);
}

async function uploadProductOptimizedVariants(bucket: string, storagePath: string, buffer: Buffer, mimeType: string) {
  const config = assertSupabaseAdminConfig();
  const variants = await createOptimizedImageVariants(buffer, mimeType);
  const storedVariants: StoredOptimizedImageVariant[] = [];

  for (const variant of variants) {
    const variantStoragePath = buildOptimizedVariantStoragePath(storagePath, variant);
    await uploadProductStorageObject(bucket, variantStoragePath, variant.mimeType, variant.buffer);
    storedVariants.push({
      ...variant,
      storagePath: variantStoragePath,
      publicUrl: buildSupabasePublicObjectUrl(config.url, bucket, variantStoragePath)
    });
  }

  return storedVariants;
}

async function uploadProductImageForDraft(formData: FormData, actorId: string | null) {
  const file = formData.get("image_file");
  if (!isUploadFile(file)) return null;

  const bucket = "mithron-products";
  const mimeType = assertAllowedMediaMimeType(file.type || "application/octet-stream", bucket);
  if (!mimeType.startsWith("image/")) {
    throw new Error("Product image upload must be an image file.");
  }
  const maxImageBytes = 12 * 1024 * 1024;
  if (file.size > maxImageBytes) {
    throw new Error("Product image upload must be 12 MB or smaller.");
  }

  const productName = readOptionalFormText(formData, "name");
  const productSlug = readOptionalFormText(formData, "slug") || slugifyProductName(productName);
  const uploadedAt = new Date().toISOString();
  const rawBuffer = Buffer.from(await file.arrayBuffer());
  const cutoutResult = await autoCutoutIfNeeded(rawBuffer, mimeType);
  const buffer = cutoutResult.buffer;
  const processedMimeType = cutoutResult.mimeType;
  const uploadFileName = cutoutResult.wasProcessed
    ? file.name.replace(/\.[^.]+$/, "") + ".cutout.webp"
    : file.name;
  const storagePath = buildStorageObjectPath({
    bucket,
    folder: `products/${productSlug}`,
    fileName: uploadFileName,
    at: uploadedAt
  });
  const sourceDimensions = await readImageDimensions(buffer, processedMimeType);
  const publicUrl = await uploadProductStorageObject(bucket, storagePath, processedMimeType, buffer);
  const optimizedVariants = await uploadProductOptimizedVariants(bucket, storagePath, buffer, processedMimeType);
  const storedPath = storagePath;
  const storedMimeType = processedMimeType;
  const storedSizeBytes = buffer.byteLength;
  const storedWidth = sourceDimensions.width;
  const storedHeight = sourceDimensions.height;
  const thumbnailVariant = findStoredOptimizedVariant(optimizedVariants, "thumbnail", "webp");
  const webpVariant = findStoredOptimizedVariant(optimizedVariants, "large", "webp");
  const avifVariant = findLargestStoredAvifVariant(optimizedVariants);
  const optimizedUploadedBytes = optimizedVariants.reduce((total, variant) => total + variant.sizeBytes, 0);
  const mediaAssetId = buildMediaAssetId(bucket, storedPath);
  const recordForm = new FormData();
  recordForm.set("id", mediaAssetId);
  recordForm.set("bucket", bucket);
  recordForm.set("folder", `products/${productSlug}`);
  recordForm.set("storage_path", storedPath);
  recordForm.set("public_url", publicUrl);
  recordForm.set("mime_type", storedMimeType);
  recordForm.set("file_size_bytes", String(storedSizeBytes));
  recordForm.set("visibility", "public");
  recordForm.set("usage_scope", "product-catalog");
  recordForm.set("tags", `product, ${productSlug}`);
  recordForm.set("alt_text", productName || productSlug);
  recordForm.set("caption", productName || productSlug);
  if (thumbnailVariant) recordForm.set("thumbnail_path", thumbnailVariant.storagePath);
  if (webpVariant) recordForm.set("webp_path", webpVariant.storagePath);
  if (avifVariant) recordForm.set("avif_path", avifVariant.storagePath);
  recordForm.set("responsive_variants", JSON.stringify(buildResponsiveVariantsMetadata(optimizedVariants, {
    width: sourceDimensions.width,
    height: sourceDimensions.height,
    sizeBytes: file.size,
    mimeType,
    storagePath,
    publicUrl,
    uploadedBytes: optimizedUploadedBytes
  })));
  recordForm.set("upload_metadata", JSON.stringify({
    original_file_name: file.name,
    original_mime_type: mimeType,
    original_size_bytes: file.size,
    original_storage_path: storagePath,
    original_public_url: publicUrl,
    optimized_uploaded_bytes: optimizedUploadedBytes,
    product_slug: productSlug,
    source: "admin-product-create",
    catalog_delivery: "original-primary-plus-responsive-variants",
    cutout: cutoutResult.wasProcessed
      ? {
        autoProcessed: true,
        metrics: cutoutResult.metrics ?? null
      }
      : cutoutResult.skipped
        ? {
          autoProcessed: false,
          skipped: true,
          skipReason: cutoutResult.skipReason ?? null,
          metrics: cutoutResult.metrics ?? null
        }
        : {
          autoProcessed: false,
          alreadyCutout: true,
          metrics: cutoutResult.metrics ?? null
        }
  }));
  if (storedWidth) recordForm.set("width", String(storedWidth));
  if (storedHeight) recordForm.set("height", String(storedHeight));

  await upsertMediaAssetRecord(
    buildMediaAssetRecordFromFormData(recordForm, { actorId, at: uploadedAt }),
    actorId
  );

  formData.set("image_src", publicUrl);
  formData.set("hero_src", publicUrl);

  return {
    bucket,
    storagePath,
    optimizedStoragePath: webpVariant?.storagePath ?? null,
    publicUrl,
    mediaAssetId
  };
}

async function runProductAction(
  successMessage: string,
  action: () => Promise<void>,
  redirectOptions: { tool?: string; anchor?: string } = {}
) {
  await requirePermission("products.write");
  let status: "success" | "error" = "success";
  let message = successMessage;

  try {
    await action();
  } catch (error) {
    status = "error";
    message = productActionErrorMessage(error);
  }

  const params = new URLSearchParams({
    product_status: status,
    product_message: message.slice(0, 240)
  });
  if (redirectOptions.tool) params.set("tool", redirectOptions.tool);

  redirect(`/admin/products?${params.toString()}${redirectOptions.anchor ? `#${redirectOptions.anchor}` : ""}`);
}

export async function saveProductDraftFormAction(formData: FormData) {
  await runProductAction("Product draft saved.", async () => {
    const { actorId, actorRole } = await currentActorContext();
    const uploadedProductImage = await uploadProductImageForDraft(formData, actorId);
    if (!uploadedProductImage && !readOptionalFormText(formData, "image_src") && !readOptionalFormText(formData, "image")) {
      throw new Error("Add an image by uploading a local file or pasting an image URL.");
    }
    const draftInput = buildProductDraftFromFormData(formData);
    const record = await upsertProductRecord(
      {
        slug: draftInput.identity.slug,
        workflow_status: "draft",
        is_visible: false,
        sort_order: draftInput.sortOrder ?? 0,
        ...draftInput.fields
      },
      actorId
    );
    if (uploadedProductImage) {
      await upsertProductMediaAssetRecord(
        {
          product_slug: draftInput.identity.slug,
          media_asset_id: uploadedProductImage.mediaAssetId,
          usage: "primary",
          sort_order: 0,
          is_primary: true,
          alt_text: String(draftInput.fields.name),
          caption: String(draftInput.fields.name),
          metadata: {
            bucket: uploadedProductImage.bucket,
            storage_path: uploadedProductImage.storagePath,
            optimized_storage_path: uploadedProductImage.optimizedStoragePath,
            original_storage_path: uploadedProductImage.storagePath,
            public_url: uploadedProductImage.publicUrl,
            source: "admin-product-create"
          },
          updated_at: new Date().toISOString()
        },
        actorId
      );
    }
    await recordProductAuditTrail(
      {
        action: "products.draft",
        entityTable: "mithron_products",
        entityId: draftInput.identity.slug,
        snapshot: record as Record<string, unknown>,
        actorId,
        actorRole,
        changeSummary: draftInput.changeSummary,
        metadata: {
          product_slug: draftInput.identity.slug,
          workflow_status: "draft",
          uploaded_media_asset_id: uploadedProductImage?.mediaAssetId ?? null
        }
      }
    );
    revalidatePath("/admin/products");
  });
}

export async function saveProductDuplicateFormAction(formData: FormData) {
  await runProductAction("Product duplicated as a draft.", async () => {
    const sourceSlug = String(formData.get("product_slug") ?? "").trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceSlug)) {
      throw new Error("Product duplicate product_slug must use lowercase letters, numbers, and hyphens only.");
    }

    const { actorId, actorRole } = await currentActorContext();
    const snapshot = await getProductManagerSnapshot();
    const sourceProduct = snapshot.data.products.find((product) => String(product.slug ?? "") === sourceSlug);
    if (!sourceProduct) {
      throw new Error(`Product ${sourceSlug} does not exist or cannot be duplicated.`);
    }

    const now = new Date().toISOString();
    const copySlug = `${sourceSlug}-copy-${Date.now().toString(36)}`;
    const record = await upsertProductRecord(
      {
        ...sourceProduct,
        slug: copySlug,
        name: `${String(sourceProduct.name ?? sourceSlug)} Copy`,
        workflow_status: "draft",
        is_visible: false,
        published_at: null,
        archived_at: null,
        sort_order: Number(sourceProduct.sort_order ?? 0) + 1,
        updated_at: now
      },
      actorId
    );

    await recordProductAuditTrail(
      {
        action: "products.duplicate",
        entityTable: "mithron_products",
        entityId: copySlug,
        snapshot: record as Record<string, unknown>,
        actorId,
        actorRole,
        changeSummary: `Duplicate product ${sourceSlug}`,
        metadata: {
          source_product_slug: sourceSlug,
          duplicate_product_slug: copySlug
        }
      }
    );

    revalidatePath("/admin/products");
  });
}

export async function saveProductCategoryFormAction(formData: FormData) {
  await runProductAction("Category added.", async () => {
    const categoryInput = buildProductCategoryMetadataFromFormData(formData);
    const snapshot = await getProductManagerSnapshot();
    const normalizedTitle = normalizeCategoryName(categoryInput.fields.title);
    const existingCategory = snapshot.data.categories.find((category) => {
      const routeKey = String(category.route_key ?? "").trim();
      const title = String(category.title ?? "").trim();
      return routeKey === categoryInput.identity.route_key || normalizeCategoryName(title) === normalizedTitle;
    });
    if (existingCategory) {
      throw new Error(`Category "${categoryInput.fields.title}" already exists.`);
    }

    const { actorId, actorRole } = await currentActorContext();
    const record = await upsertAdminRecord(
      "category_metadata",
      "route_key",
      {
        route_key: categoryInput.identity.route_key,
        sort_order: categoryInput.sortOrder ?? (snapshot.data.categories.length + 1) * 10,
        ...categoryInput.fields
      },
      actorId
    );

    await recordProductAuditTrail(
      {
        action: "products.category_create",
        entityTable: "category_metadata",
        entityId: categoryInput.identity.route_key,
        snapshot: record as Record<string, unknown>,
        actorId,
        actorRole,
        changeSummary: categoryInput.changeSummary,
        metadata: {
          route_key: categoryInput.identity.route_key,
          category_title: categoryInput.fields.title
        }
      }
    );

    revalidatePath("/admin/products");
    revalidatePath("/admin/cms");
    revalidatePath("/products");
  }, { tool: "category", anchor: "product-category" });
}

export async function deleteProductCategoryFormAction(formData: FormData) {
  await runProductAction("Category deleted.", async () => {
    const categoryTitle = readOptionalFormText(formData, "category");
    const requestedRouteKey = readOptionalFormText(formData, "category_route_key");
    if (!categoryTitle) {
      throw new Error("Choose a category before deleting it.");
    }

    const snapshot = await getProductManagerSnapshot();
    const normalizedCategory = normalizeCategoryName(categoryTitle);
    const productsUsingCategory = snapshot.data.products.filter((product) => normalizeCategoryName(String(product.category ?? "")) === normalizedCategory);
    if (productsUsingCategory.length > 0) {
      throw new Error(`Category "${categoryTitle}" is used by ${productsUsingCategory.length} product(s). Move or edit those products before deleting the category.`);
    }

    const categoryRecord = snapshot.data.categories.find((category) => {
      const routeKey = String(category.route_key ?? "");
      const title = String(category.title ?? "");
      return (requestedRouteKey && routeKey === requestedRouteKey) || normalizeCategoryName(title) === normalizedCategory;
    });
    if (!categoryRecord) {
      throw new Error(`Category "${categoryTitle}" has no category_metadata row to delete.`);
    }

    const routeKey = String(categoryRecord.route_key ?? "").trim();
    if (!routeKey) {
      throw new Error(`Category "${categoryTitle}" has no route key in category_metadata.`);
    }

    const { actorId, actorRole } = await currentActorContext();
    const record = await deleteAdminRecord("category_metadata", "route_key", routeKey, actorId);
    await recordProductAuditTrail(
      {
        action: "products.category_delete",
        entityTable: "category_metadata",
        entityId: routeKey,
        snapshot: {
          ...record,
          category_title: categoryTitle
        },
        actorId,
        actorRole,
        severity: "warning",
        changeSummary: `Delete unused category ${categoryTitle}`,
        metadata: {
          route_key: routeKey,
          category_title: categoryTitle,
          products_using_category: productsUsingCategory.length
        }
      }
    );

    revalidatePath("/admin/products");
    revalidatePath("/admin/cms");
  });
}

export async function saveProductQuickEditFormAction(formData: FormData) {
  await runProductAction("Product updated.", async () => {
    const quickInput = buildProductQuickEditFromFormData(formData);
    const expectedUpdatedAt = String(formData.get("expected_updated_at") ?? "").trim() || null;
    const { actorId, actorRole } = await currentActorContext();
    const record = await updateAdminRecord(
      "mithron_products",
      "slug",
      quickInput.identity.slug,
      {
        ...quickInput.fields,
        updated_at: new Date().toISOString()
      },
      actorId,
      process.env,
      { expectedUpdatedAt }
    );

    await recordProductAuditTrail(
      {
        action: "products.quick_edit",
        entityTable: "mithron_products",
        entityId: quickInput.identity.slug,
        snapshot: record as Record<string, unknown>,
        actorId,
        actorRole,
        changeSummary: quickInput.changeSummary,
        metadata: {
          product_slug: quickInput.identity.slug,
          fields: Object.keys(quickInput.fields)
        }
      }
    );

    revalidatePath("/admin/products");
    revalidatePath("/products");
    revalidatePath(`/product/${quickInput.identity.slug}`);
  });
}

export async function saveProductMediaLinkFormAction(formData: FormData) {
  await runProductAction("Product media link saved.", async () => {
    const draftInput = buildProductMediaLinkFromFormData(formData);
    const { actorId, actorRole } = await currentActorContext();
    const record = draftInput.fields.is_primary
      ? await setProductMediaPrimaryViaRpc(
        draftInput.identity.product_slug,
        draftInput.identity.media_asset_id,
        draftInput.identity.usage,
        actorId
      )
      : await upsertProductMediaAssetRecord(
        {
          product_slug: draftInput.identity.product_slug,
          media_asset_id: draftInput.identity.media_asset_id,
          usage: draftInput.identity.usage,
          ...draftInput.fields,
          updated_at: new Date().toISOString()
        },
        actorId
      );
    await recordProductAuditTrail(
      {
        action: "products.media_link",
        entityTable: "product_media_assets",
        entityId: draftInput.entityId,
        snapshot: record as Record<string, unknown>,
        actorId,
        actorRole,
        changeSummary: draftInput.changeSummary,
        metadata: {
          product_slug: draftInput.identity.product_slug,
          media_asset_id: draftInput.identity.media_asset_id,
          usage: draftInput.identity.usage
        }
      }
    );
    revalidatePath("/admin/products");
  });
}

export async function saveProductVariantsFormAction(formData: FormData) {
  await runProductAction("Product variants saved.", async () => {
    const draftInput = buildProductVariantsWorkflowFromFormData(formData);
    const { actorId, actorRole } = await currentActorContext();
    const record = await updateAdminRecord(
      "mithron_products",
      "slug",
      draftInput.identity.slug,
      {
        variants: draftInput.fields.variants,
        updated_at: new Date().toISOString()
      },
      actorId
    );
    await recordProductAuditTrail(
      {
        action: "products.variants",
        entityTable: "mithron_products",
        entityId: draftInput.identity.slug,
        snapshot: record as Record<string, unknown>,
        actorId,
        actorRole,
        changeSummary: draftInput.changeSummary,
        metadata: {
          product_slug: draftInput.identity.slug,
          variant_count: draftInput.fields.variants.length
        }
      }
    );
    revalidatePath("/admin/products");
  });
}

export async function saveProductSeoFormAction(formData: FormData) {
  await runProductAction("Product SEO saved.", async () => {
    const draftInput = buildProductSeoDraftFromFormData(formData);
    const { actorId, actorRole } = await currentActorContext();
    const record = await updateAdminRecord(
      "mithron_products",
      "slug",
      draftInput.identity.slug,
      {
        ...draftInput.fields,
        updated_at: new Date().toISOString()
      },
      actorId
    );
    await recordProductAuditTrail(
      {
        action: "products.seo",
        entityTable: "mithron_products",
        entityId: draftInput.identity.slug,
        snapshot: record as Record<string, unknown>,
        actorId,
        actorRole,
        changeSummary: draftInput.changeSummary,
        metadata: {
          product_slug: draftInput.identity.slug,
          seo_fields: Object.keys(draftInput.fields)
        }
      }
    );
    revalidatePath("/admin/products");
  });
}

export async function saveProductPublishStateFormAction(formData: FormData) {
  await runProductAction("Product publish state saved.", async () => {
    const draftInput = buildProductPublishStateFromFormData(formData);
    const { actorId, actorRole } = await currentActorContext();
    const now = new Date().toISOString();
    const isPublished = draftInput.fields.workflow_status === "published";
    const isArchived = draftInput.fields.workflow_status === "archived";
    const record = isPublished
      ? await markProductPublished(draftInput.identity.slug, actorId, {
          is_visible: draftInput.fields.is_visible
        })
      : await updateProductPublicationRecord(
          {
            slug: draftInput.identity.slug,
            workflow_status: draftInput.fields.workflow_status,
            is_visible: false,
            published_at: null,
            archived_at: isArchived ? now : null,
            updated_at: now
          },
          actorId
        );

    await recordProductAuditTrail(
      {
        action: "products.publish",
        entityTable: "mithron_products",
        entityId: draftInput.identity.slug,
        snapshot: record as Record<string, unknown>,
        actorId,
        actorRole,
        changeSummary: draftInput.changeSummary ?? `Set product ${draftInput.identity.slug} to ${draftInput.fields.workflow_status}`,
        severity: isArchived ? "warning" : "info",
        metadata: {
          product_slug: draftInput.identity.slug,
          workflow_status: draftInput.fields.workflow_status,
          is_visible: isPublished ? draftInput.fields.is_visible : false
        }
      }
    );

    revalidateCatalogSurfaces(draftInput.identity.slug);
    revalidatePath("/admin/products");
    revalidatePath("/admin/inventory");
    revalidatePath("/warehouse/inventory");
  });
}

export async function saveProductHardDeleteFormAction(formData: FormData) {
  await runProductAction("Product hard deleted.", async () => {
    const deleteInput = buildProductDeleteFromFormData(formData);
    const { actorId, actorRole } = await currentActorContext();
    const result = await deleteProductRecordSafely(deleteInput.identity.slug, actorId);

    await recordProductAuditTrail(
      {
        action: "products.hard_delete",
        entityTable: "mithron_products",
        entityId: deleteInput.identity.slug,
        snapshot: {
          product_slug: deleteInput.identity.slug,
          deleted_dependencies: result.deletedDependencies,
          before_data: result.beforeData
        },
        actorId,
        actorRole,
        changeSummary: deleteInput.changeSummary,
        severity: "warning",
        metadata: {
          product_slug: deleteInput.identity.slug,
          delete_mode: "hard_delete",
          deleted_dependencies: result.deletedDependencies
        }
      }
    );

    revalidatePath("/admin/products");
    revalidatePath("/admin");
    revalidatePath("/");
  });
}

export async function saveProductInventoryWorkflowFormAction(formData: FormData) {
  await runProductAction("Product inventory linkage saved.", async () => {
    const draftInput = buildProductInventoryWorkflowFromFormData(formData);
    const { actorId, actorRole } = await currentActorContext();
    const now = new Date().toISOString();
    const previousStock = await fetchWarehouseStockBySku(draftInput.productSlug, draftInput.sku, draftInput.warehouseCode);
    const quantityBefore = Number(previousStock?.available_quantity ?? 0);
    const records = buildInventoryLinkageRecords(draftInput, { actorId, at: now });

    const inventoryRecord = await upsertInventoryRecord(
      records.inventoryRecord,
      actorId
    );

    const stockRecord = await upsertWarehouseStockRecord(
      records.warehouseStockRecord,
      actorId
    );
    const warehouseStockId = String((stockRecord as Record<string, unknown>).id ?? previousStock?.id ?? "") || null;

    await recordInventoryMovementForStockChange(
      {
        productId: draftInput.productSlug,
        sku: draftInput.sku,
        variantId: draftInput.variantId,
        warehouseCode: draftInput.warehouseCode,
        warehouseStockId,
        movementType: "adjustment",
        quantityBefore,
        quantityAfter: draftInput.availableQuantity,
        reasonCode: "admin_inventory_edit",
        notes: draftInput.changeSummary,
        actorUserId: actorId,
        relatedOrderId: null,
        relatedShipmentId: null,
        at: now
      },
      actorId
    );

    await recordEntityRevisionSnapshot(
      "inventory",
      `${draftInput.productSlug}:${draftInput.sku}`,
      {
        inventory: inventoryRecord,
        warehouse_stock: stockRecord,
        variant_id: draftInput.variantId
      },
      actorId,
      draftInput.changeSummary
    );

    await createActivityLogRecord(
      {
        actor_id: actorId,
        action: "inventory.sync",
        entity_table: "inventory",
        entity_id: `${draftInput.productSlug}:${draftInput.sku}`,
        severity: records.lowStock ? "warning" : "info",
        metadata: {
          product_slug: draftInput.productSlug,
          sku: draftInput.sku,
          variant_id: draftInput.variantId,
          warehouse_code: draftInput.warehouseCode,
          stock_status: records.inventoryRecord.stock_status,
          quantity: draftInput.quantity,
          reserved_quantity: draftInput.reservedQuantity,
          reorder_threshold: draftInput.reorderThreshold,
          available_quantity: draftInput.availableQuantity,
          committed_quantity: draftInput.committedQuantity
        }
      },
      actorId
    );

    await recordProductAuditTrail(
      {
        action: "products.inventory_link",
        entityTable: "mithron_products",
        entityId: draftInput.productSlug,
        snapshot: {
          product_slug: draftInput.productSlug,
          sku: draftInput.sku,
          variant_id: draftInput.variantId,
          inventory: inventoryRecord,
          warehouse_stock: stockRecord
        },
        actorId,
        actorRole,
        changeSummary: draftInput.changeSummary,
        metadata: {
          product_slug: draftInput.productSlug,
          sku: draftInput.sku,
          variant_id: draftInput.variantId,
          warehouse_code: draftInput.warehouseCode
        }
      }
    );

    revalidatePath("/admin/products");
    revalidatePath("/warehouse");
    revalidatePath("/warehouse/inventory");
    revalidatePath("/warehouse/movements");
  });
}
