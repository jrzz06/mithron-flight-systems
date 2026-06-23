import productIdMap from "@/data/wix-product-id-map.json";
import reviewsSnapshot from "@/data/wix-reviews.snapshot.json";
import type { ProductPageReview } from "@/lib/product-reviews/types";

type WixReviewRecord = {
  id: string;
  entityId: string;
  content?: {
    title?: string;
    body?: string;
    rating?: number;
  };
  author?: {
    authorName?: string;
  };
  reviewDate?: string;
  createdDate?: string;
  foundHelpful?: number;
};

type WixProductMap = Record<string, { slug: string; name: string }>;

const wixProducts = (productIdMap as { products: WixProductMap }).products;
const wixReviews = (reviewsSnapshot as { reviews: WixReviewRecord[] }).reviews;

const reviewsByWixSlug = new Map<string, ProductPageReview[]>();

for (const review of wixReviews) {
  const product = wixProducts[review.entityId];
  if (!product?.slug) continue;

  const mapped: ProductPageReview = {
    id: review.id,
    authorName: String(review.author?.authorName ?? "Verified buyer").trim() || "Verified buyer",
    title: String(review.content?.title ?? "").trim(),
    body: String(review.content?.body ?? "").trim(),
    rating: Math.min(5, Math.max(1, Math.round(review.content?.rating ?? 5))),
    createdAt: review.reviewDate ?? review.createdDate,
    productName: product.name,
    helpfulCount: review.foundHelpful ?? 0,
    source: "wix"
  };

  if (!mapped.body) continue;

  const bucket = reviewsByWixSlug.get(product.slug) ?? [];
  bucket.push(mapped);
  reviewsByWixSlug.set(product.slug, bucket);
}

for (const [slug, reviews] of reviewsByWixSlug.entries()) {
  reviews.sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return rightTime - leftTime;
  });
  reviewsByWixSlug.set(slug, reviews);
}

export function getWixReviewsForSlug(wixSlug: string): ProductPageReview[] {
  return reviewsByWixSlug.get(wixSlug) ?? [];
}

export function getAllWixReviewSlugs() {
  return [...reviewsByWixSlug.keys()];
}
