import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Product } from "@/config/types";
import { getProductBySlug, getProductStaticSlugs, getRelatedProductShellItems } from "@/services/catalog";
import { ProductConfigurator, type ProductConfiguratorModel } from "@/sections/product/product-configurator";
import { ProductDetailHeader } from "@/sections/product/product-detail-header";
import { ProductMediaViewer, type ProductMediaViewerModel } from "@/sections/product/product-media-viewer";
import { ProductStory } from "@/sections/product/product-story";
import { SpecsFaqReviews } from "@/sections/product/specs-faq-reviews";
import { getPublicCmsSnapshot } from "@/services/cms";
import { buildProductMetadata } from "@/services/product-metadata";

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

  return (
    <article className="product-detail-page bg-[var(--surface-page)]">
      <ProductDetailHeader product={product} />
      <section className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,480px)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,520px)]">
        <ProductMediaViewer product={buildProductMediaViewerModel(product)} />
        <ProductConfigurator product={buildProductConfiguratorModel(product)} />
      </section>
      <ProductStory product={product} />
      <SpecsFaqReviews product={product} relatedProducts={relatedProducts} support={cms.productSupport} />
    </article>
  );
}
