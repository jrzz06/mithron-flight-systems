import productIdMap from "@/data/wix-product-id-map.json";
import { getWixReviewsForSlug } from "@/lib/product-reviews/wix-reviews-index";

const SOURCE_PREFIX = "source-";
const CATALOG_PREFIX = "mithron-";

type WixProductMap = Record<string, { slug: string; name: string }>;

const wixProducts = Object.values((productIdMap as { products: WixProductMap }).products);

function normalizeProductName(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[[\]]/g, "")
    .trim();
}

function resolveWixSlugByProductName(productName: string) {
  const normalized = normalizeProductName(productName);
  if (!normalized) return null;

  const match = wixProducts.find((product) => normalizeProductName(product.name) === normalized);
  return match?.slug ?? null;
}

function resolvePrimaryWixSlug(input: { slug: string; sourceCatalogId?: string | null }) {
  const catalogId = input.sourceCatalogId?.trim();
  if (catalogId?.startsWith(CATALOG_PREFIX)) {
    return catalogId.slice(CATALOG_PREFIX.length);
  }

  const slug = input.slug.trim();
  if (slug.startsWith(SOURCE_PREFIX)) {
    return slug.slice(SOURCE_PREFIX.length);
  }

  return slug;
}

export function resolveWixProductSlug(input: {
  slug: string;
  sourceCatalogId?: string | null;
  productName?: string | null;
}) {
  const resolved = resolvePrimaryWixSlug(input);

  if (getWixReviewsForSlug(resolved).length > 0) {
    return resolved;
  }

  const productName = input.productName?.trim();
  if (!productName) {
    return resolved;
  }

  const byName = resolveWixSlugByProductName(productName);
  if (byName && getWixReviewsForSlug(byName).length > 0) {
    return byName;
  }

  return resolved;
}
