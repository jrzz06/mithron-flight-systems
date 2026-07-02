import type { MediaAsset } from "@/config/types";

function isSupabaseStorageSrc(src: string) {
  return /^https?:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(src.trim());
}

/** Prefer the canonical Supabase object URL for catalog cards instead of generated variants that may 404. */
export function resolveCatalogCardImage(asset: Pick<MediaAsset, "src" | "alt" | "responsive">) {
  const fallback = asset.responsive?.fallbackSrc?.trim() ?? "";
  const src = asset.src?.trim() ?? "";

  if (fallback && isSupabaseStorageSrc(fallback)) {
    return { src: fallback, alt: asset.alt };
  }

  return { src, alt: asset.alt };
}
