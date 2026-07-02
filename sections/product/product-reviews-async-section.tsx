import { getProductReviewsCmsSlice, emptySupabaseOnlySnapshot } from "@/services/cms";
import { getProductPageReviews } from "@/services/product-reviews";
import { ProductReviewsLazySection } from "@/sections/product/product-below-fold";

type ProductReviewsAsyncSectionProps = {
  slug: string;
  productName: string;
  sourceCatalogId?: string | null;
};

export async function ProductReviewsAsyncSection({
  slug,
  productName,
  sourceCatalogId
}: ProductReviewsAsyncSectionProps) {
  let cmsReviews = emptySupabaseOnlySnapshot.productSupport.reviews;
  try {
    cmsReviews = await getProductReviewsCmsSlice();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[product-page] CMS reviews load failed for ${slug}: ${message}`);
  }

  const reviewPayload = getProductPageReviews({
    slug,
    productName,
    sourceCatalogId,
    cmsReviews
  });

  if (!reviewPayload.reviews.length) return null;

  return (
    <ProductReviewsLazySection
      productName={productName}
      reviews={reviewPayload.reviews}
      summary={reviewPayload.summary}
    />
  );
}
