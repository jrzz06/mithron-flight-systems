import { uploadProductImageForDraft, type UploadedProductImage } from "@/services/product-image-upload";

type JsonRecord = Record<string, unknown>;

export function readProductImageSrc(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const src = (value as JsonRecord).src;
  return typeof src === "string" && src.trim() ? src.trim() : "";
}

export function buildProductMediaFromSrc(src: string, alt: string) {
  const media = { src, alt, kind: "image", priority: true };
  return {
    image: media,
    hero: media,
    gallery: [media]
  };
}

export async function resolveSupplierProductImageFields(
  formData: FormData,
  input: { slug: string; name: string; actorId: string; existingImageSrc?: string; requireImage?: boolean }
): Promise<{ image: JsonRecord; hero: JsonRecord; gallery: JsonRecord[]; uploadedImage: UploadedProductImage | null }> {
  const uploadedImage = await uploadProductImageForDraft(formData, input.actorId, "supplier-product-create");
  const imageSrc = String(formData.get("image_src") ?? "").trim() || input.existingImageSrc?.trim() || "";

  if (!imageSrc && input.requireImage !== false) {
    throw new Error("Add a product image by uploading a file or pasting an image URL.");
  }

  if (!imageSrc) {
    const fallback = buildProductMediaFromSrc("/media/mithron/hero/ag10-command.webp", input.name);
    return { ...fallback, uploadedImage };
  }

  const alt = String(formData.get("image_alt") ?? "").trim() || input.name;
  const media = buildProductMediaFromSrc(imageSrc, alt);
  return { ...media, uploadedImage };
}
