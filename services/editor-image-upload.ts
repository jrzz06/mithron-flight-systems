import sharp from "sharp";
import { createClient } from "@/lib/server";
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
  findLargestStoredAvifVariant,
  findStoredOptimizedVariant,
  type StoredOptimizedImageVariant
} from "@/services/media-optimization";

async function uploadStorageObject(bucket: string, storagePath: string, contentType: string, buffer: Buffer) {
  const config = assertSupabaseAdminConfig();
  const uploadBody = new Uint8Array(buffer.byteLength);
  uploadBody.set(buffer);
  const encodedPath = storagePath.split("/").map((segment) => encodeURIComponent(segment)).join("/");

  const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${encodedPath}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable"
    },
    body: uploadBody
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Storage upload failed: ${response.status} ${text}`);
  }

  return buildSupabasePublicObjectUrl(config.url, bucket, storagePath);
}

async function uploadOptimizedVariants(bucket: string, storagePath: string, buffer: Buffer, mimeType: string) {
  const config = assertSupabaseAdminConfig();
  const variants = await createOptimizedImageVariants(buffer, mimeType);
  const stored: StoredOptimizedImageVariant[] = [];

  for (const variant of variants) {
    const variantPath = buildOptimizedVariantStoragePath(storagePath, variant);
    await uploadStorageObject(bucket, variantPath, variant.mimeType, variant.buffer);
    stored.push({
      ...variant,
      storagePath: variantPath,
      publicUrl: buildSupabasePublicObjectUrl(config.url, bucket, variantPath)
    });
  }

  return stored;
}

export async function uploadEditorInlineImage(input: {
  file: File;
  documentType: string;
  documentId: string;
  actorId: string | null;
}) {
  const bucket = "mithron-products";
  const mimeType = assertAllowedMediaMimeType(input.file.type || "application/octet-stream", bucket);
  if (!mimeType.startsWith("image/")) {
    throw new Error("Only image uploads are supported in the editor.");
  }
  if (input.file.size > 12 * 1024 * 1024) {
    throw new Error("Image must be 12 MB or smaller.");
  }

  const uploadedAt = new Date().toISOString();
  const folder = `editor/${input.documentType}/${input.documentId}`;
  const storagePath = buildStorageObjectPath({
    bucket,
    folder,
    fileName: input.file.name,
    at: uploadedAt
  });
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const metadata = await sharp(buffer, { failOn: "none" }).metadata().catch(() => null);
  const optimizedVariants = await uploadOptimizedVariants(bucket, storagePath, buffer, mimeType);
  const publicUrl = await uploadStorageObject(bucket, storagePath, mimeType, buffer);
  const mediaAssetId = buildMediaAssetId(bucket, storagePath);
  const webpVariant = findStoredOptimizedVariant(optimizedVariants, "large", "webp");
  const thumbnailVariant = findStoredOptimizedVariant(optimizedVariants, "thumbnail", "webp");
  const avifVariant = findLargestStoredAvifVariant(optimizedVariants);

  const recordForm = new FormData();
  recordForm.set("id", mediaAssetId);
  recordForm.set("bucket", bucket);
  recordForm.set("folder", folder);
  recordForm.set("storage_path", storagePath);
  recordForm.set("public_url", publicUrl);
  recordForm.set("mime_type", mimeType);
  recordForm.set("file_size_bytes", String(buffer.byteLength));
  recordForm.set("visibility", "public");
  recordForm.set("usage_scope", "editor-inline");
  recordForm.set("tags", `editor, ${input.documentType}`);
  recordForm.set("alt_text", input.file.name);
  recordForm.set("width", metadata?.width ? String(metadata.width) : "");
  recordForm.set("height", metadata?.height ? String(metadata.height) : "");
  recordForm.set("webp_path", webpVariant?.storagePath ?? "");
  recordForm.set("thumbnail_path", thumbnailVariant?.storagePath ?? "");
  recordForm.set("avif_path", avifVariant?.storagePath ?? "");
  recordForm.set(
    "responsive_variants",
    JSON.stringify(
      buildResponsiveVariantsMetadata(optimizedVariants, {
        width: metadata?.width ?? null,
        height: metadata?.height ?? null,
        sizeBytes: input.file.size,
        mimeType,
        uploadedBytes: optimizedVariants.reduce((total, variant) => total + variant.sizeBytes, 0) || buffer.byteLength
      })
    )
  );

  await upsertMediaAssetRecord(buildMediaAssetRecordFromFormData(recordForm, { actorId: input.actorId, at: uploadedAt }), input.actorId);

  return { publicUrl, mediaAssetId };
}

export async function requireEditorActor() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Authentication required.");
  }
  return data.user;
}
