import sharp from "sharp";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { upsertMediaAssetRecord } from "@/services/admin-actions";
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

export type UploadedProductImage = {
  bucket: string;
  storagePath: string;
  optimizedStoragePath: string | null;
  publicUrl: string;
  mediaAssetId: string;
};

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

export function slugifyProductNameForImage(value: string) {
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

export async function uploadProductImageForDraft(
  formData: FormData,
  actorId: string | null,
  source: "admin-product-create" | "supplier-product-create" = "admin-product-create"
): Promise<UploadedProductImage | null> {
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
  const productSlug = readOptionalFormText(formData, "slug") || slugifyProductNameForImage(productName);
  const uploadedAt = new Date().toISOString();
  const storagePath = buildStorageObjectPath({
    bucket,
    folder: `products/${productSlug}`,
    fileName: file.name,
    at: uploadedAt
  });
  const buffer = Buffer.from(await file.arrayBuffer());
  const sourceDimensions = await readImageDimensions(buffer, mimeType);
  const publicUrl = await uploadProductStorageObject(bucket, storagePath, mimeType, buffer);
  const optimizedVariants = await uploadProductOptimizedVariants(bucket, storagePath, buffer, mimeType);
  const webpVariant = findStoredOptimizedVariant(optimizedVariants, "large", "webp");
  const thumbnailVariant = findStoredOptimizedVariant(optimizedVariants, "thumbnail", "webp");
  const avifVariant = findLargestStoredAvifVariant(optimizedVariants);
  const optimizedUploadedBytes = optimizedVariants.reduce((total, variant) => total + variant.sizeBytes, 0);
  const mediaAssetId = buildMediaAssetId(bucket, storagePath);
  const recordForm = new FormData();
  recordForm.set("id", mediaAssetId);
  recordForm.set("bucket", bucket);
  recordForm.set("folder", `products/${productSlug}`);
  recordForm.set("storage_path", storagePath);
  recordForm.set("public_url", publicUrl);
  recordForm.set("mime_type", mimeType);
  recordForm.set("file_size_bytes", String(buffer.byteLength));
  recordForm.set("visibility", "public");
  recordForm.set("usage_scope", "product-catalog");
  recordForm.set("tags", `product, ${productSlug}`);
  recordForm.set("alt_text", productName || productSlug);
  recordForm.set("caption", productName || productSlug);
  if (thumbnailVariant) recordForm.set("thumbnail_path", thumbnailVariant.storagePath);
  if (webpVariant) recordForm.set("webp_path", webpVariant.storagePath);
  if (avifVariant) recordForm.set("avif_path", avifVariant.storagePath);
  recordForm.set(
    "responsive_variants",
    JSON.stringify(
      buildResponsiveVariantsMetadata(optimizedVariants, {
        width: sourceDimensions.width,
        height: sourceDimensions.height,
        sizeBytes: file.size,
        mimeType,
        storagePath,
        publicUrl,
        uploadedBytes: optimizedUploadedBytes
      })
    )
  );
  recordForm.set(
    "upload_metadata",
    JSON.stringify({
      original_file_name: file.name,
      original_mime_type: mimeType,
      original_size_bytes: file.size,
      original_storage_path: storagePath,
      original_public_url: publicUrl,
      optimized_uploaded_bytes: optimizedUploadedBytes,
      product_slug: productSlug,
      source,
      catalog_delivery: "original-primary-plus-responsive-variants"
    })
  );
  if (sourceDimensions.width) recordForm.set("width", String(sourceDimensions.width));
  if (sourceDimensions.height) recordForm.set("height", String(sourceDimensions.height));

  await upsertMediaAssetRecord(buildMediaAssetRecordFromFormData(recordForm, { actorId, at: uploadedAt }), actorId);

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
