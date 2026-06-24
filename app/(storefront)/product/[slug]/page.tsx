import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Product } from "@/config/types";
import { getProductBySlug, getProductStaticSlugs, getRelatedProductShellItems, loadProductForPage } from "@/services/catalog";
import { CatalogDataErrorPanel } from "@/components/layout/catalog-integrity-notice";
import { ProductConfigurator, type ProductConfiguratorModel } from "@/sections/product/product-configurator";
import { ProductDetailHeader } from "@/sections/product/product-detail-header";
import { ProductDetailSectionNav } from "@/sections/product/product-detail-section-nav";
import { ProductMediaViewer, type ProductMediaViewerModel } from "@/sections/product/product-media-viewer";
import { ProductOverview } from "@/sections/product/product-overview";
import {
  ProductApplicationsSection,
  ProductDownloadsSection,
  ProductFeaturesSection,
  ProductIncludedSection,
  ProductMediaGallerySection,
  ProductSpecificationHighlightsSection,
  ProductTechnicalSection
} from "@/sections/product/product-detail-sections";
import { ProductRelatedLazySection, ProductReviewsLazySection } from "@/sections/product/product-below-fold";
import { ProductStory } from "@/sections/product/product-story";
import { SpecsFaqReviews } from "@/sections/product/specs-faq-reviews";
import { JsonLd } from "@/components/seo/json-ld";
import { getProductOverviewText } from "@/lib/product-detail-content";
import { getVisibleProductDetailSections } from "@/lib/product-detail-sections";
import { buildProductStructuredData } from "@/lib/structured-data";
import { getPublicCmsSnapshot } from "@/services/cms";
import type { ProductReviewSummary } from "@/lib/product-reviews/types";
import { getProductPageReviews } from "@/services/product-reviews";
import { buildProductMetadata } from "@/services/product-metadata";
import styles from "@/sections/product/product-detail.module.css";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = true;

function buildProductMediaViewerModel(product: Product): ProductMediaViewerModel {
  return {
    image: product.image,
    hero: product.hero,
    gallery: product.gallery,
    hotspots: product.hotspots
  };
}

function buildProductConfiguratorModel(
  product: Product,
  reviewSummary?: ProductReviewSummary
): ProductConfiguratorModel {
  return {
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    category: product.category,
    badge: product.badge,
    price: product.price,
    compareAt: product.compareAt,
    chargeTax: product.chargeTax,
    taxGroup: product.taxGroup,
    taxRate: product.taxRate,
    taxIncluded: product.taxIncluded,
    image: product.image,
    variants: product.variants,
    bundles: product.bundles,
    reviewSummary: reviewSummary && reviewSummary.totalReviews > 0 ? reviewSummary : undefined
  };
}

export async function generateStaticParams() {
  const slugs = await getProductStaticSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return buildProductMetadata(product ?? null);
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const pageLoad = await loadProductForPage(slug);
  if (pageLoad.status === "not_found") notFound();
  if (pageLoad.status === "error") {
    return <CatalogDataErrorPanel error={pageLoad.error} />;
  }

  const product = pageLoad.product;
  const [relatedProducts, cms] = await Promise.all([getRelatedProductShellItems(slug), getPublicCmsSnapshot()]);
  const overviewText = getProductOverviewText(product);
  const showOverview = overviewText.length > 80;
  const structuredData = buildProductStructuredData(product);
  const reviewPayload = getProductPageReviews({
    slug: product.slug,
    productName: product.name,
    sourceCatalogId: product.sourceCatalogId,
    cmsReviews: cms.productSupport.reviews
  });
  const visibleSections = getVisibleProductDetailSections(product, {
    hasReviews: reviewPayload.reviews.length > 0,
    hasRelated: relatedProducts.length > 0
  });
  const visibleSectionIds = visibleSections.map((section) => section.id);
  const showStoryFallback = !showOverview;

  return (
    <article className={`product-detail-page ${styles.page}`}>
      <JsonLd data={structuredData} />
      <ProductDetailHeader product={product} />
      <section className={styles.heroSection}>
        <div className={styles.heroGrid}>
          <div className={styles.heroMediaCol}>
            <ProductMediaViewer product={buildProductMediaViewerModel(product)} />
          </div>
          <div className={styles.heroBuyCol}>
            <ProductConfigurator product={buildProductConfiguratorModel(product, reviewPayload.summary)} />
          </div>
        </div>
      </section>
      <ProductDetailSectionNav visibleSectionIds={visibleSectionIds} />
      <div id="overview" className={styles.contentFlow}>
        {showOverview ? <ProductOverview product={product} /> : null}
        <ProductFeaturesSection product={product} />
        <ProductSpecificationHighlightsSection product={product} />
        <ProductTechnicalSection product={product} />
        <ProductApplicationsSection product={product} />
        <ProductIncludedSection product={product} />
        <ProductDownloadsSection product={product} />
        <ProductMediaGallerySection product={product} />
        <ProductStory product={product} includeFallback={showStoryFallback} />
      </div>
      <SpecsFaqReviews product={product} relatedProducts={[]} support={cms.productSupport} showSpecs={false} />
      {reviewPayload.reviews.length > 0 ? (
        <Suspense fallback={<div className="min-h-[320px] animate-pulse bg-[var(--ds-skeleton)]" aria-hidden="true" />}>
          <ProductReviewsLazySection
            productName={product.name}
            reviews={reviewPayload.reviews}
            summary={reviewPayload.summary}
          />
        </Suspense>
      ) : null}
      <Suspense fallback={<div className="min-h-[360px] animate-pulse bg-[var(--ds-skeleton)]" aria-hidden="true" />}>
        <ProductRelatedLazySection relatedProducts={relatedProducts} />
      </Suspense>
    </article>
  );
}
