import productIdMap from "@/data/wix-product-id-map.json";
import reviewsSnapshot from "@/data/wix-reviews.snapshot.json";

type WixProductMap = Record<string, { slug: string; name: string }>;

export type ProductReviewCatalogEntry = {
  wixSlug: string;
  mithronSlug: string;
  productName: string;
  reviewCount: number;
};

const wixProducts = (productIdMap as { products: WixProductMap }).products;

export function listProductsWithWixReviews() {
  const counts = new Map<string, number>();

  for (const review of (reviewsSnapshot as { reviews: Array<{ entityId: string }> }).reviews) {
    const product = wixProducts[review.entityId];
    if (!product?.slug) continue;
    counts.set(product.slug, (counts.get(product.slug) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([wixSlug, reviewCount]) => ({
      wixSlug,
      mithronSlug: `source-${wixSlug}`,
      productName: Object.values(wixProducts).find((entry) => entry.slug === wixSlug)?.name ?? wixSlug,
      reviewCount
    }))
    .sort((left, right) => right.reviewCount - left.reviewCount || left.productName.localeCompare(right.productName));
}
