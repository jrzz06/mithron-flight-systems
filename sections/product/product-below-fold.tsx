import { Suspense, type ReactNode } from "react";
import { LazyHydrate } from "@/components/ui/lazy-hydrate";
import { ProductRelatedSection } from "@/sections/product/product-related-section";
import { ProductReviewsSection } from "@/sections/product/product-reviews-section";
import type { ProductPageReview, ProductReviewSummary } from "@/lib/product-reviews/types";
import type { ProductShellItem } from "@/services/catalog";

function ProductReviewsFallback() {
  return <div className="min-h-[320px] animate-pulse bg-[#f8fafc]" aria-hidden="true" />;
}

function ProductRelatedFallback() {
  return <div className="min-h-[360px] animate-pulse bg-[#f8fafc]" aria-hidden="true" />;
}

export function ProductReviewsLazySection({
  productName,
  reviews,
  summary
}: {
  productName: string;
  reviews: ProductPageReview[];
  summary: ProductReviewSummary;
}) {
  if (!reviews.length) return null;

  return (
    <LazyHydrate fallback={<ProductReviewsFallback />} minHeight={320}>
      <ProductReviewsSection productName={productName} reviews={reviews} summary={summary} />
    </LazyHydrate>
  );
}

export function ProductRelatedLazySection({
  relatedProducts,
  similarProducts,
  accessoryProducts
}: {
  relatedProducts?: ProductShellItem[];
  similarProducts?: ProductShellItem[];
  accessoryProducts?: ProductShellItem[];
}) {
  const similar = similarProducts ?? relatedProducts ?? [];
  const accessories = accessoryProducts ?? [];
  if (!similar.length && !accessories.length) return null;

  return (
    <LazyHydrate fallback={<ProductRelatedFallback />} minHeight={360}>
      <ProductRelatedSection
        relatedProducts={relatedProducts}
        similarProducts={similarProducts}
        accessoryProducts={accessoryProducts}
      />
    </LazyHydrate>
  );
}

export function ProductBelowFoldSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<ProductRelatedFallback />}>{children}</Suspense>;
}
