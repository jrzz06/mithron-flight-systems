"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { deleteAdminRecord, upsertMediaAssetRecord } from "@/services/admin-actions";
import { getCurrentAuthContext, requirePermission } from "@/services/auth";
import {
  assertAllowedMediaBucket,
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
  selectPrimaryOptimizedVariant,
  type StoredOptimizedImageVariant
} from "@/services/media-optimization";

function encodeObjectPath(path: string) {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function isUploadFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function readText(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function currentActorId() {
  const context = await getCurrentAuthContext();
  return context.userId;
}

function mediaActionErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function runMediaAction(successMessage: string, action: () => Promise<void>) {
  await requirePermission("media.write");
  let status: "success" | "error" = "success";
  let message = successMessage;

  try {
    await action();
  } catch (error) {
    status = "error";
    message = mediaActionErrorMessage(error);
  }

  redirect(`/admin/media?media_status=${status}&media_message=${encodeURIComponent(message.slice(0, 240))}`);
}

async function readImageMetadata(buffer: Buffer, mimeType: string) {
  if (!mimeType.startsWith("image/")) {
    return { width: null as number | null, height: null as number | null };
  }

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

async function uploadStorageObject(bucket: string, storagePath: string, contentType: string, buffer: Buffer) {
  const config = assertSupabaseAdminConfig();
  const uploadBody = new Uint8Array(buffer.byteLength);
  uploadBody.set(buffer);
  const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${encodeObjectPath(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": contentType || "application/octet-stream",
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

async function uploadOptimizedVariants(bucket: string, storagePath: string, buffer: Buffer, mimeType: string) {
  const config = assertSupabaseAdminConfig();
  const variants = await createOptimizedImageVariants(buffer, mimeType);
  const storedVariants: StoredOptimizedImageVariant[] = [];

  for (const variant of variants) {
    const variantStoragePath = buildOptimizedVariantStoragePath(storagePath, variant);
    await uploadStorageObject(bucket, variantStoragePath, variant.mimeType, variant.buffer);
    storedVariants.push({
      ...variant,
      storagePath: variantStoragePath,
      publicUrl: buildSupabasePublicObjectUrl(config.url, bucket, variantStoragePath)
    });
  }

  return storedVariants;
}

async function deleteStorageObject(bucket: string, storagePath: string) {
  const config = assertSupabaseAdminConfig();
  const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${encodeObjectPath(storagePath)}`, {
    method: "DELETE",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`
    }
  });

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`Supabase Storage delete failed for ${bucket}/${storagePath}: ${response.status} ${response.statusText} ${text}`);
  }
}

function buildRecordFormData(formData: FormData, overrides: Record<string, string>) {
  const recordForm = new FormData();
  for (const key of [
    "folder",
    "tags",
    "alt_text",
    "caption",
    "visibility",
    "usage_scope",
    "avif_path",
    "webp_path",
    "thumbnail_path",
    "responsive_variants",
    "upload_metadata",
    "content_hash"
  ]) {
    const value = formData.get(key);
    if (typeof value === "string") recordForm.set(key, value);
  }

  for (const [key, value] of Object.entries(overrides)) {
    recordForm.set(key, value);
  }

  return recordForm;
}

export async function saveMediaUploadFormAction(formData: FormData) {
  await runMediaAction("Media upload saved.", async () => {
    const actorId = await currentActorId();
    const bucket = assertAllowedMediaBucket(readText(formData, "bucket", "mithron-products"));
    const uploadedFiles = formData.getAll("files").filter(isUploadFile);
    const now = new Date().toISOString();

    if (!uploadedFiles.length) {
      const record = buildMediaAssetRecordFromFormData(formData, { actorId, at: now });
      await upsertMediaAssetRecord(record, actorId);
      revalidatePath("/admin/media");
      revalidatePath("/admin/products");
      return;
    }

    for (let index = 0; index < uploadedFiles.length; index += 1) {
      const file = uploadedFiles[index];
      const mimeType = assertAllowedMediaMimeType(file.type || "application/octet-stream", bucket);
      const maxUploadBytes = Number(process.env.MEDIA_MAX_UPLOAD_BYTES?.trim() || 0) || 50 * 1024 * 1024;
      if (file.size > maxUploadBytes) {
        throw new Error(`File "${file.name}" exceeds the maximum upload size of ${Math.round(maxUploadBytes / 1024 / 1024)} MB.`);
      }
      const uploadAt = new Date(Date.parse(now) + index).toISOString();
      const storagePath = buildStorageObjectPath({
        bucket,
        folder: readText(formData, "folder", "uploads"),
        fileName: file.name,
        at: uploadAt
      });
      const buffer = Buffer.from(await file.arrayBuffer());
      const sourceDimensions = await readImageMetadata(buffer, mimeType);
      const optimizedVariants = await uploadOptimizedVariants(bucket, storagePath, buffer, mimeType);
      const optimizedPrimary = selectPrimaryOptimizedVariant(optimizedVariants);
      const publicUrl = optimizedPrimary?.publicUrl ?? await uploadStorageObject(bucket, storagePath, mimeType, buffer);
      const storedPath = optimizedPrimary?.storagePath ?? storagePath;
      const storedMimeType = optimizedPrimary?.mimeType ?? mimeType;
      const storedSizeBytes = optimizedPrimary?.sizeBytes ?? buffer.byteLength;
      const storedWidth = optimizedPrimary?.width ?? sourceDimensions.width;
      const storedHeight = optimizedPrimary?.height ?? sourceDimensions.height;
      const thumbnailVariant = findStoredOptimizedVariant(optimizedVariants, "thumbnail", "webp");
      const webpVariant = findStoredOptimizedVariant(optimizedVariants, "large", "webp");
      const avifVariant = findLargestStoredAvifVariant(optimizedVariants);
      const optimizedUploadedBytes = optimizedVariants.reduce((total, variant) => total + variant.sizeBytes, 0) || buffer.byteLength;
      const recordId = buildMediaAssetId(bucket, storedPath);

      const recordForm = buildRecordFormData(formData, {
        id: recordId,
        bucket,
        storage_path: storedPath,
        public_url: publicUrl,
        mime_type: storedMimeType,
        file_size_bytes: String(storedSizeBytes),
        width: storedWidth ? String(storedWidth) : readText(formData, "width", ""),
        height: storedHeight ? String(storedHeight) : readText(formData, "height", ""),
        thumbnail_path: thumbnailVariant?.storagePath ?? "",
        webp_path: webpVariant?.storagePath ?? "",
        avif_path: avifVariant?.storagePath ?? "",
        responsive_variants: JSON.stringify(buildResponsiveVariantsMetadata(optimizedVariants, {
          width: sourceDimensions.width,
          height: sourceDimensions.height,
          sizeBytes: file.size,
          mimeType,
          uploadedBytes: optimizedUploadedBytes
        })),
        upload_metadata: JSON.stringify({
          original_file_name: file.name,
          original_mime_type: mimeType,
          original_size_bytes: file.size,
          optimized_uploaded_bytes: optimizedUploadedBytes,
          usage_scope: readText(formData, "usage_scope", "editorial"),
          source: "admin-media-manager"
        })
      });

      await upsertMediaAssetRecord(
        buildMediaAssetRecordFromFormData(recordForm, { actorId, at: uploadAt }),
        actorId
      );
    }

    revalidatePath("/admin/media");
    revalidatePath("/admin/products");
  });
}

export async function deleteMediaAssetFormAction(formData: FormData) {
  await runMediaAction("Media asset deleted.", async () => {
    const actorId = await currentActorId();
    const assetId = readText(formData, "asset_id");
    const confirmAssetId = readText(formData, "confirm_asset_id");
    const bucket = assertAllowedMediaBucket(readText(formData, "bucket"));
    const storagePath = readText(formData, "storage_path") || readText(formData, "object_path");

    if (!assetId) {
      throw new Error("Media asset id is required.");
    }
    if (confirmAssetId !== assetId) {
      throw new Error("Media delete confirmation must match the media asset id exactly.");
    }
    if (!storagePath) {
      throw new Error("Media storage path is required for deletion.");
    }

    await deleteStorageObject(bucket, storagePath);
    await deleteAdminRecord("media_assets", "id", assetId, actorId);
    revalidatePath("/admin/media");
    revalidatePath("/admin/products");
  });
}
