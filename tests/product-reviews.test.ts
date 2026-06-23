import { describe, expect, it } from "vitest";
import { resolveWixProductSlug } from "@/lib/product-reviews/resolve-wix-slug";
import { getWixReviewsForSlug } from "@/lib/product-reviews/wix-reviews-index";
import { getProductPageReviews } from "@/services/product-reviews";

describe("product reviews", () => {
  it("resolves wix slugs from source catalog ids and source-prefixed slugs", () => {
    expect(
      resolveWixProductSlug({
        slug: "source-10l-agri-sprayer-drone-tc-certified",
        sourceCatalogId: "mithron-10l-agri-sprayer-drone-tc-certified"
      })
    ).toBe("10l-agri-sprayer-drone-tc-certified");
  });

  it("loads real Wix Studio reviews for mapped products", () => {
    const reviews = getWixReviewsForSlug("10l-agri-sprayer-drone-tc-certified");
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews[0]?.authorName).toBeTruthy();
    expect(reviews[0]?.body).toBeTruthy();
    expect(reviews[0]?.source).toBe("wix");
  });

  it("builds product review summaries from Wix reviews", () => {
    const payload = getProductPageReviews({
      slug: "source-10l-agri-sprayer-drone-tc-certified",
      productName: "16L Agri Drone Ver2",
      cmsReviews: []
    });

    expect(payload.reviews.length).toBeGreaterThan(0);
    expect(payload.summary.totalReviews).toBe(payload.reviews.length);
    expect(payload.summary.averageRating).toBeGreaterThan(0);
  });
});
