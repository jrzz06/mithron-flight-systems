import type { ProductReviewContent } from "@/config/storefront-content";
import { resolveWixProductSlug } from "@/lib/product-reviews/resolve-wix-slug";
import type { ProductPageReview, ProductReviewSummary, ProductReviewsPayload } from "@/lib/product-reviews/types";
import { getWixReviewsForSlug } from "@/lib/product-reviews/wix-reviews-index";

function mapCmsReview(review: ProductReviewContent): ProductPageReview | null {
  const body = review.body?.trim();
  const authorName = review.name?.trim();
  if (!body || !authorName) return null;

  return {
    id: review.id ?? `cms-${authorName}-${body.slice(0, 24)}`,
    authorName,
    title: "",
    body,
    rating: Math.min(5, Math.max(1, Math.round(review.rating ?? 5))),
    source: "cms"
  };
}

function buildSummary(reviews: ProductPageReview[]): ProductReviewSummary {
  const distribution: ProductReviewSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;

  for (const review of reviews) {
    const bucket = Math.min(5, Math.max(1, review.rating)) as 1 | 2 | 3 | 4 | 5;
    distribution[bucket] += 1;
    totalRating += review.rating;
  }

  const totalReviews = reviews.length;
  const averageRating = totalReviews ? Math.round((totalRating / totalReviews) * 10) / 10 : 0;

  return { averageRating, totalReviews, distribution };
}

function dedupeReviews(reviews: ProductPageReview[]) {
  const seen = new Set<string>();
  return reviews.filter((review) => {
    const key = `${review.authorName}:${review.body.slice(0, 80)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getProductPageReviews(input: {
  slug: string;
  productName: string;
  sourceCatalogId?: string | null;
  cmsReviews?: ProductReviewContent[];
}): ProductReviewsPayload {
  const wixSlug = resolveWixProductSlug({
    slug: input.slug,
    sourceCatalogId: input.sourceCatalogId
  });

  const wixReviews = getWixReviewsForSlug(wixSlug).map((review) => ({
    ...review,
    productName: input.productName
  }));

  const scopedCms = (input.cmsReviews ?? [])
    .filter((review) => !review.productSlug || review.productSlug === input.slug)
    .map(mapCmsReview)
    .filter((review): review is ProductPageReview => Boolean(review));

  const globalCms = (input.cmsReviews ?? [])
    .filter((review) => !review.productSlug)
    .map(mapCmsReview)
    .filter((review): review is ProductPageReview => Boolean(review));

  const reviews = dedupeReviews(
    wixReviews.length > 0 ? wixReviews : scopedCms.length > 0 ? scopedCms : globalCms.slice(0, 6)
  );

  return {
    reviews,
    summary: buildSummary(reviews)
  };
}
