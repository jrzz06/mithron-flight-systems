import sharp from "sharp";

export const MEDIA_VARIANT_WIDTHS = {
  thumbnail: 320,
  medium: 960,
  large: 1600,
  xlarge: 2560,
  ultra: 3840
} as const;

const WEBP_QUALITY = {
  thumbnail: 84,
  medium: 90,
  large: 94,
  xlarge: 96,
  ultra: 96
} as const;

type RasterVariantLabel = keyof typeof MEDIA_VARIANT_WIDTHS;

export type OptimizedImageVariant = {
  label: RasterVariantLabel;
  format: "webp";
  mimeType: "image/webp";
  width: number | null;
  height: number | null;
  sizeBytes: number;
  buffer: Buffer;
};

export type StoredOptimizedImageVariant = OptimizedImageVariant & {
  storagePath: string;
  publicUrl: string;
};

const optimizableImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif"
]);

export function isOptimizableImageMimeType(mimeType: string) {
  return optimizableImageMimeTypes.has(mimeType.trim().toLowerCase());
}

export function buildOptimizedVariantStoragePath(
  storagePath: string,
  variant: Pick<OptimizedImageVariant, "label" | "format">
) {
  const basePath = storagePath.replace(/\.[a-z0-9]+$/i, "");
  return `${basePath}.${variant.label}.${variant.format}`;
}

export function buildSupabasePublicObjectUrl(baseUrl: string, bucket: string, storagePath: string) {
  return `${baseUrl}/storage/v1/object/public/${bucket}/${storagePath}`;
}

async function createWebpVariant(
  input: Buffer,
  label: RasterVariantLabel
): Promise<OptimizedImageVariant> {
  const output = await sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: MEDIA_VARIANT_WIDTHS[label], withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY[label], effort: 6, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  return {
    label,
    format: "webp",
    mimeType: "image/webp",
    width: output.info.width ?? null,
    height: output.info.height ?? null,
    sizeBytes: output.data.byteLength,
    buffer: output.data
  };
}

export async function createOptimizedImageVariants(
  input: Buffer,
  mimeType: string
): Promise<OptimizedImageVariant[]> {
  if (!isOptimizableImageMimeType(mimeType)) return [];

  const variants = await Promise.all([
    createWebpVariant(input, "thumbnail"),
    createWebpVariant(input, "medium"),
    createWebpVariant(input, "large"),
    createWebpVariant(input, "xlarge"),
    createWebpVariant(input, "ultra")
  ]);

  return variants.filter((variant) => variant.sizeBytes > 0);
}

export function selectPrimaryOptimizedVariant(variants: StoredOptimizedImageVariant[]) {
  return variants.find((variant) => variant.label === "ultra" && variant.format === "webp")
    ?? variants.find((variant) => variant.label === "xlarge" && variant.format === "webp")
    ?? variants.find((variant) => variant.label === "large" && variant.format === "webp")
    ?? variants.find((variant) => variant.label === "medium" && variant.format === "webp")
    ?? variants[0]
    ?? null;
}

export function findStoredOptimizedVariant(
  variants: StoredOptimizedImageVariant[],
  label: StoredOptimizedImageVariant["label"],
  format?: StoredOptimizedImageVariant["format"]
) {
  return variants.find((variant) => variant.label === label && (!format || variant.format === format)) ?? null;
}

export function findLargestStoredAvifVariant(variants: StoredOptimizedImageVariant[]): StoredOptimizedImageVariant | null {
  void variants;
  return null;
}

export function buildResponsiveVariantsMetadata(
  variants: StoredOptimizedImageVariant[],
  source: {
    width: number | null;
    height: number | null;
    sizeBytes: number;
    mimeType: string;
    storagePath?: string;
    publicUrl?: string;
    uploadedBytes?: number;
  }
) {
  const variantRecord = Object.fromEntries(
    variants.map((variant) => [
      variant.label,
      {
        format: variant.format,
        mime_type: variant.mimeType,
        storage_path: variant.storagePath,
        public_url: variant.publicUrl,
        width: variant.width,
        height: variant.height,
        size_bytes: variant.sizeBytes
      }
    ])
  );

  return {
    source: {
      width: source.width,
      height: source.height,
      size_bytes: source.sizeBytes,
      mime_type: source.mimeType,
      storage_path: source.storagePath ?? null,
      public_url: source.publicUrl ?? null
    },
    generated: variantRecord,
    optimized_uploaded_bytes: source.uploadedBytes ?? variants.reduce((total, variant) => total + variant.sizeBytes, 0),
    strategy: "original-primary-plus-premium-responsive-webp-q96"
  };
}
