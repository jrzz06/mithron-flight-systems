import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Product } from "@/config/types";
import { getProductBySlug, getProductStaticSlugs, getRelatedProductShellItems } from "@/services/catalog";
import { ProductConfigurator, type ProductConfiguratorModel } from "@/sections/product/product-configurator";
import { ProductDetailHeader } from "@/sections/product/product-detail-header";
import { ProductDetailSectionNav } from "@/sections/product/product-detail-section-nav";
import { ProductHighlights } from "@/sections/product/product-highlights";
import { ProductMediaViewer, type ProductMediaViewerModel } from "@/sections/product/product-media-viewer";
import { ProductOverview } from "@/sections/product/product-overview";
import { ProductRelatedSection } from "@/sections/product/product-related-section";
import { ProductReviewsSection } from "@/sections/product/product-reviews-section";
import { ProductStory } from "@/sections/product/product-story";
import { SpecsFaqReviews } from "@/sections/product/specs-faq-reviews";
import { JsonLd } from "@/components/seo/json-ld";
import { getProductOverviewText } from "@/lib/product-detail-content";
import { buildProductStructuredData } from "@/lib/structured-data";
import { getPublicCmsSnapshot } from "@/services/cms";
import { getProductPageReviews } from "@/services/product-reviews";
import { buildProductMetadata } from "@/services/product-metadata";
import styles from "@/sections/product/product-detail.module.css";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

function buildProductMediaViewerModel(product: Product): ProductMediaViewerModel {
  return {
    image: product.image,
    hero: product.hero,
    gallery: product.gallery,
    hotspots: product.hotspots
  };
}

function buildProductConfiguratorModel(product: Product): ProductConfiguratorModel {
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
    bundles: product.bundles
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
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [relatedProducts, cms] = await Promise.all([getRelatedProductShellItems(slug), getPublicCmsSnapshot()]);
  const overviewText = getProductOverviewText(product);
  const showOverview = overviewText.length > 80;
  const structuredData = buildProductStructuredData(product);
  const reviewPayload = getProductPageReviews({
    slug: product.slug,
    productName: product.name,
    cmsReviews: cms.productSupport.reviews
  });
  const hasHighlights = Object.keys(product.specs ?? {}).length > 0;
  const visibleSectionIds = [
    "overview",
    "specs",
    ...(reviewPayload.reviews.length > 0 ? ["reviews"] : []),
    ...(relatedProducts.length > 0 ? ["accessories"] : [])
  ];

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
            <ProductConfigurator product={buildProductConfiguratorModel(product)} />
          </div>
        </div>
      </section>
      <ProductDetailSectionNav visibleSectionIds={visibleSectionIds} />
      <div id="overview">
        {hasHighlights ? <ProductHighlights product={product} /> : null}
        {showOverview ? <ProductOverview product={product} /> : null}
        <ProductStory product={product} includeFallback={!showOverview} />
      </div>
      <SpecsFaqReviews product={product} relatedProducts={[]} support={cms.productSupport} />
      {reviewPayload.reviews.length > 0 ? (
        <ProductReviewsSection
          productName={product.name}
          reviews={reviewPayload.reviews}
          summary={reviewPayload.summary}
        />
      ) : null}
      <ProductRelatedSection relatedProducts={relatedProducts} />
    </article>
  );
}
