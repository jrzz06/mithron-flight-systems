import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Product } from "@/config/types";
import { getProductDescriptionHtml } from "@/lib/product-detail-content";
import { buildProductMediaPlan } from "@/lib/product-detail-experience";
import { getProductBySlug, getProductStaticSlugs, loadProductForPage } from "@/services/catalog";
import { CatalogDataErrorPanel } from "@/components/layout/catalog-integrity-notice";
import { ProductPurchaseExperience } from "@/sections/product/product-purchase-experience";
import type { ProductConfiguratorModel } from "@/sections/product/product-configurator";
import { ProductDetailHeader } from "@/sections/product/product-detail-header";
import { ProductReviewsLazySection } from "@/sections/product/product-below-fold";
import { ProductImmersiveGallery } from "@/sections/product/showcase/product-immersive-gallery";
import { ProductRichDescriptionSection } from "@/sections/product/showcase/product-rich-description";
import { ProductShowcaseHero } from "@/sections/product/showcase/product-showcase-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { buildProductStructuredData } from "@/lib/structured-data";
import { getPublicCmsSnapshot, emptySupabaseOnlySnapshot } from "@/services/cms";
import { getProductPageReviews } from "@/services/product-reviews";
import { buildProductMetadata } from "@/services/product-metadata";
import showcaseStyles from "@/sections/product/showcase/product-showcase.module.css";

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = true;

function buildProductConfiguratorModel(product: Product): ProductConfiguratorModel {
  return {
    slug: product.slug,
    name: product.name,
    tagline: product.tagline,
    category: product.category,
    badge: product.badge,
    badgeStyle: product.badgeStyle,
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
  const pageLoad = await loadProductForPage(slug);
  if (pageLoad.status === "not_found") notFound();
  if (pageLoad.status === "error") {
    return <CatalogDataErrorPanel error={pageLoad.error} />;
  }

  const product = pageLoad.product;
  const cmsResult = await Promise.allSettled([getPublicCmsSnapshot()]);
  if (cmsResult[0].status === "rejected") {
    const message = cmsResult[0].reason instanceof Error ? cmsResult[0].reason.message : String(cmsResult[0].reason);
    console.warn(`[product-page] CMS snapshot load failed for ${slug}: ${message}`);
  }

  const cms = cmsResult[0].status === "fulfilled" ? cmsResult[0].value : emptySupabaseOnlySnapshot;
  const structuredData = buildProductStructuredData(product);
  const mediaPlan = buildProductMediaPlan(product);
  const descriptionHtml = getProductDescriptionHtml(product);
  const reviewPayload = getProductPageReviews({
    slug: product.slug,
    productName: product.name,
    sourceCatalogId: product.sourceCatalogId,
    cmsReviews: cms.productSupport.reviews
  });

  return (
    <article className={`product-detail-page ${showcaseStyles.page}`}>
      <JsonLd data={structuredData} />
      <ProductDetailHeader product={product} />
      <ProductShowcaseHero
        gallery={<ProductImmersiveGallery mediaPlan={mediaPlan} />}
        purchase={(
          <ProductPurchaseExperience
            product={buildProductConfiguratorModel(product)}
            summary={{
              name: product.name,
              price: product.price,
              compareAt: product.compareAt
            }}
          />
        )}
      />
      <ProductRichDescriptionSection html={descriptionHtml} />
      {reviewPayload.reviews.length > 0 ? (
        <Suspense fallback={<div className="min-h-[320px] animate-pulse bg-[var(--ds-skeleton)]" aria-hidden="true" />}>
          <ProductReviewsLazySection
            productName={product.name}
            reviews={reviewPayload.reviews}
            summary={reviewPayload.summary}
          />
        </Suspense>
      ) : null}
    </article>
  );
}
