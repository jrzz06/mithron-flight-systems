import type { Product } from "@/config/types";
import { sanitizeProductHtml } from "@/lib/sanitize-html";
import { sanitizeProductPreviewText } from "@/lib/product-preview-text";
import { isSpecLikeBlob, sortSpecEntries, expandSpecEntries, isHighlightSpecValue } from "@/lib/product-spec-text";

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
  "Battery",
  "Storage",
  "Warranty",
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
  const raw = Object.entries(product.specs).filter(([key, value]) => {
    if (HIDDEN_SPEC_KEYS.has(key)) return false;
    return Boolean(value.trim());
  });

  return sortSpecEntries(expandSpecEntries(raw));
}

export function getHighlightSpecs(product: Product, limit = 6) {
  const specs = getCustomerFacingSpecs(product).filter(([, value]) => isHighlightSpecValue(value));
  const ranked = specs.sort(([left], [right]) => {
    const leftRank = HIGHLIGHT_SPEC_KEYS.findIndex((key) => key.toLowerCase() === left.toLowerCase());
    const rightRank = HIGHLIGHT_SPEC_KEYS.findIndex((key) => key.toLowerCase() === right.toLowerCase());
    const safeLeft = leftRank >= 0 ? leftRank : HIGHLIGHT_SPEC_KEYS.length;
    const safeRight = rightRank >= 0 ? rightRank : HIGHLIGHT_SPEC_KEYS.length;
    return safeLeft - safeRight;
  });

  return ranked.slice(0, limit);
}

export function getProductOverviewHtml(product: Product) {
  const description = product.description?.trim();
  if (!description) return null;
  if (!/<[^>]+>/.test(description)) return null;
  const sanitized = sanitizeProductHtml(description);
  const plain = sanitized.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (isSpecLikeBlob(plain)) return null;
  return sanitized;
}

export function getProductOverviewText(product: Product) {
  const htmlOverview = getProductOverviewHtml(product);
  if (htmlOverview) {
    return cleanCopy(htmlOverview);
  }

  const plainDescription = product.description?.trim();
  const candidates = [
    plainDescription && !/<[^>]+>/.test(plainDescription) ? plainDescription : "",
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

export function getDedicatedProductStoryChapters(product: Product, options?: { includeFallback?: boolean }) {
  const dedicated = /^(features|warranty|disclaimers|downloads|applications)$/i;
  return getStoryChapters(product, options).filter((chapter) => {
    if (dedicated.test(chapter.kicker.trim())) return false;
    if (/^key features$/i.test(chapter.title.trim())) return false;
    if (/important notes/i.test(chapter.title.trim())) return false;
    return true;
  });
}

export function hasRichProductDetail(product: Product) {
  return (
    getHighlightSpecs(product).length > 0
    || Boolean(getProductOverviewText(product))
    || getStoryChapters(product).length > 0
    || getCustomerFacingSpecs(product).length > 0
  );
}
