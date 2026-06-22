import type { Product } from "@/config/types";
import { sanitizeProductPreviewText } from "@/lib/product-preview-text";
import { isSpecLikeBlob, sortSpecEntries } from "@/lib/product-spec-text";

const HIDDEN_SPEC_KEYS = new Set(["Product ID", "Source", "Currency", "Category", "Availability"]);

const HIGHLIGHT_SPEC_KEYS = [
  "Endurance",
  "Flight Time",
  "Range (LoS)",
  "Range",
  "Maximum All-Up-Weight",
  "Maximum Takeoff Weight",
  "Payload Capacity",
  "Payload",
  "Wind Resistance",
  "Maximum Speed",
  "Battery Capacity",
  "Operating Altitude",
  "Maximum Operating Altitude",
  "UAV Type",
  "UAV Category",
  "Dimensions",
  "Weight"
] as const;

function cleanCopy(value: string | null | undefined) {
  const clean = sanitizeProductPreviewText(value ?? "").trim();
  if (!clean || isSpecLikeBlob(clean)) return "";
  return clean;
}

export function getCustomerFacingSpecs(product: Product) {
  return sortSpecEntries(
    Object.entries(product.specs).filter(([key, value]) => {
      if (HIDDEN_SPEC_KEYS.has(key)) return false;
      return Boolean(value.trim());
    })
  );
}

export function getHighlightSpecs(product: Product, limit = 6) {
  const specs = getCustomerFacingSpecs(product);
  const ranked = specs.sort(([left], [right]) => {
    const leftRank = HIGHLIGHT_SPEC_KEYS.findIndex((key) => key.toLowerCase() === left.toLowerCase());
    const rightRank = HIGHLIGHT_SPEC_KEYS.findIndex((key) => key.toLowerCase() === right.toLowerCase());
    const safeLeft = leftRank >= 0 ? leftRank : HIGHLIGHT_SPEC_KEYS.length;
    const safeRight = rightRank >= 0 ? rightRank : HIGHLIGHT_SPEC_KEYS.length;
    return safeLeft - safeRight;
  });

  return ranked.slice(0, limit);
}

export function getProductOverviewText(product: Product) {
  const candidates = [
    product.seoDescription,
    product.ogDescription,
    ...product.story.map((chapter) => chapter.body),
    ...product.bundles.map((bundle) => bundle.description),
    product.tagline
  ]
    .map((value) => cleanCopy(value))
    .filter(Boolean);

  const unique = [...new Set(candidates)];
  return unique.sort((left, right) => right.length - left.length)[0] ?? "";
}

export function getStoryChapters(product: Product, options?: { includeFallback?: boolean }) {
  const chapters = product.story
    .map((chapter) => ({
      ...chapter,
      title: cleanCopy(chapter.title) || product.name,
      body: cleanCopy(chapter.body),
      kicker: cleanCopy(chapter.kicker) || product.category
    }))
    .filter((chapter) => chapter.title || chapter.body);

  if (chapters.length) return chapters;
  if (options?.includeFallback === false) return [];

  const overview = getProductOverviewText(product);
  if (!overview) return [];

  return [{
    id: "overview",
    kicker: product.category,
    title: product.name,
    body: overview,
    media: product.hero,
    align: "center" as const
  }];
}

export function hasRichProductDetail(product: Product) {
  return (
    getHighlightSpecs(product).length > 0
    || Boolean(getProductOverviewText(product))
    || getStoryChapters(product).length > 0
    || getCustomerFacingSpecs(product).length > 0
  );
}
