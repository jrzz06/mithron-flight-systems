import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { ProductHoverCard } from "@/components/cards/product-hover-card";
import { CatalogContinuedGrid } from "@/sections/catalog/catalog-continued-grid";
import { StorefrontRevealImage } from "@/components/media/storefront-reveal-image";
import { MithronCardImage } from "@/components/media/mithron-card-image";
import { MithronPageHeroImage } from "@/components/media/mithron-page-hero-image";
import type { Product } from "@/config/types";
import { getResponsiveAssetForSrc } from "@/config/generated-assets";
import { getCatalogShowcaseMedia } from "@/lib/catalog-showcase-media";
import { resolveNavbarInkFromShowcase } from "@/lib/navbar-ink-sampling";
import { clipProductPreviewText } from "@/lib/product-preview-text";
import { cn } from "@/lib/utils";
import { catalogCinematicBannerFrame } from "@/config/catalog-routes";
import { buildCatalogShelfLayout } from "@/lib/catalog-shelf-layout";
import { resolveCatalogCutoutAsset } from "@/lib/media/catalog-cutout";
import styles from "./catalog-page.module.css";

type CatalogShowcaseImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  navbarInk?: "light" | "dark";
  fit?: "cinematic" | "native";
  mobileAspectRatio?: string;
  mobileObjectPosition?: string;
};

export function CatalogPage({
  title,
  subtitle,
  products,
  heroImage,
  showcaseImage,
  presentation = "standard"
}: {
  title?: string;
  subtitle?: string;
  products: Product[];
  heroImage?: string;
  showcaseImage?: CatalogShowcaseImage;
  presentation?: "standard" | "showroom";
}) {
  const isShowroom = presentation === "showroom";
  const optimizedShowcase = showcaseImage ? getCatalogShowcaseMedia(showcaseImage.src) : null;
  const showcaseAsset = showcaseImage ? getResponsiveAssetForSrc(showcaseImage.src) : null;
  const catalogNavbarInk = showcaseImage
    ? resolveNavbarInkFromShowcase(showcaseImage, showcaseAsset?.dominantColor)
    : null;
  const heroProduct = products[0];
  const heroMetrics = products.slice(0, 3);
  const { featuredProduct, leadProducts, remainingProducts } = buildCatalogShelfLayout(products);
  const occupiedSlugs = new Set([
    ...leadProducts.map((product) => product.slug),
    ...(featuredProduct ? [featuredProduct.slug] : [])
  ]);
  const safeRemainingProducts = remainingProducts.filter((product) => !occupiedSlugs.has(product.slug));
  const catalogProductCount = leadProducts.length + safeRemainingProducts.length + (featuredProduct ? 1 : 0);
  const featuredImage = featuredProduct ? resolveCatalogCutoutAsset(featuredProduct) : null;
  const catalogTitle = title ?? heroProduct?.category ?? "Mithron catalog";
  const catalogSubtitle = subtitle ?? (heroProduct ? `Browse ${heroProduct.category.toLowerCase()} selected for field-ready deployment and mission planning.` : "Browse drones, accessories, and field-ready products from the Mithron catalog.");
  const shouldRenderFallbackHero = !showcaseImage && title && subtitle && heroImage;
  const cardPresentation = isShowroom ? "showroom" : "standard";
  const showcaseFit = showcaseImage?.fit ?? "cinematic";
  const showcaseFrame =
    showcaseFit === "cinematic"
      ? catalogCinematicBannerFrame
      : showcaseImage
        ? {
            width: showcaseImage.width,
            height: showcaseImage.height,
            mobileAspectRatio: showcaseImage.mobileAspectRatio ?? "1.55 / 1",
            mobileObjectPosition: showcaseImage.mobileObjectPosition ?? "center center"
          }
        : null;

  return (
    <div className={isShowroom ? styles.shell : "catalog-page-shell surface-page"}>
      {showcaseImage ? (
        <section
          className="catalog-hero-section catalog-hero-section--showcase"
          data-navbar-ink={catalogNavbarInk ?? "light"}
          data-navbar-tone={catalogNavbarInk === "dark" ? "light" : "dark"}
          data-hero-dominant-color={showcaseAsset?.dominantColor}
          data-navbar-ink-surface=""
          data-showcase-fit={showcaseFit}
          style={
            showcaseFrame
              ? ({
                  "--showcase-aspect-ratio": `${showcaseFrame.width} / ${showcaseFrame.height}`,
                  "--showcase-max-width": `${showcaseFrame.width}px`,
                  "--showcase-mobile-aspect-ratio": showcaseFrame.mobileAspectRatio,
                  "--showcase-mobile-object-position": showcaseFrame.mobileObjectPosition
                } as CSSProperties)
              : undefined
          }
          aria-label={showcaseImage.alt}
        >
          <div className="catalog-hero-immersive" data-testid="catalog-mobile-hero">
            <div className="catalog-hero-immersive__media">
              <picture className="catalog-hero-image-section__frame">
                {optimizedShowcase?.avifSrcSet ? <source type="image/avif" srcSet={optimizedShowcase.avifSrcSet} sizes="(min-width: 1440px) 1440px, 100vw" /> : null}
                {optimizedShowcase?.webpSrcSet ? <source type="image/webp" srcSet={optimizedShowcase.webpSrcSet} sizes="(min-width: 1440px) 1440px, 100vw" /> : null}
                <StorefrontRevealImage
                  src={optimizedShowcase?.src ?? showcaseImage.src}
                  alt={showcaseImage.alt}
                  width={optimizedShowcase?.width ?? showcaseImage.width}
                  height={optimizedShowcase?.height ?? showcaseImage.height}
                  loading="eager"
                  decoding="async"
                  crossOrigin="anonymous"
                  sizes="(min-width: 1440px) 1440px, 100vw"
                  className="catalog-hero-image-section__asset"
                />
              </picture>
            </div>
          </div>
        </section>
      ) : shouldRenderFallbackHero ? (
        <section className="catalog-hero-section ambient-section ambient-dark relative -mt-16 overflow-hidden bg-black px-6 pb-12 pt-32 text-white md:min-h-[560px] md:px-16 md:pb-16" data-navbar-ink="light">
          <MithronPageHeroImage src={heroImage} alt={title} fill className="catalog-hero__bg object-cover opacity-28 blur-[1px] saturate-[.86]" sizes="(min-width: 1440px) 1440px, 100vw" />
          <div className="catalog-hero__shade absolute inset-0" />
          <div className="catalog-hero__floor absolute inset-x-0 bottom-0 h-32" />
          <div className="catalog-hero__layout relative z-10 mx-auto grid max-w-[1440px] items-center gap-10 md:grid-cols-[minmax(0,.9fr)]">
            <div className="catalog-hero__copy">
              <p className="catalog-hero__eyebrow type-meta text-white/44">Autonomous drone ecosystem</p>
              <h1 className="catalog-hero__title type-page mt-5 max-w-3xl">{title}</h1>
              <p className="catalog-hero__subtitle type-subtitle mt-6 max-w-2xl text-white/68">{subtitle}</p>
              <div className="catalog-hero__actions mt-8 flex flex-wrap gap-3">
                {heroProduct ? (
                  <Button asChild variant="accent">
                    <Link href={`/product/${heroProduct.slug}`}>View product</Link>
                  </Button>
                ) : null}
                <Button asChild variant="glass">
                  <Link href="#catalog-grid">Browse catalog</Link>
                </Button>
              </div>
              {heroMetrics.length ? (
                <div className="catalog-hero__tags mt-8 flex flex-wrap gap-3">
                  {heroMetrics.map((product) => (
                    <Link key={product.slug} href={`/product/${product.slug}`} className="catalog-hero__tag type-button rounded-full border border-white/12 bg-[#080b0f]/28 px-4 py-2 text-xs text-white/72 transition-colors hover:bg-[#080b0f]/38 hover:text-white">
                      {product.category}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      <section
        id="catalog-grid"
        className={isShowroom ? styles.gridSection : "catalog-grid-section mx-auto max-w-[1440px] scroll-mt-28 px-6 md:px-16"}
        data-navbar-ink="dark"
      >
        <div className={isShowroom ? styles.intro : "catalog-intro"} data-testid="catalog-intro">
          <div>
            <p className={isShowroom ? styles.eyebrow : "catalog-intro__eyebrow type-meta"}>Catalog</p>
            <h1 className={isShowroom ? styles.title : "catalog-intro__title type-section"}>{catalogTitle}</h1>
          </div>
          <div className={isShowroom ? styles.introCopy : "catalog-intro__copy"}>
            <p className={isShowroom ? styles.subtitle : "catalog-intro__subtitle type-subtitle"}>{catalogSubtitle}</p>
            <div className={isShowroom ? styles.meta : "catalog-intro__meta type-technical"}>
              <span>{catalogProductCount} products</span>
            </div>
          </div>
        </div>

        <div className={isShowroom ? styles.productGrid : "catalog-product-grid min-w-0"}>
          {leadProducts.map((product, index) => (
            <ProductHoverCard
              key={product.slug}
              product={product}
              variant="catalog"
              showCategory
              cta="catalog"
              presentation={cardPresentation}
              priority={index < 8}
            />
          ))}
        </div>

        {featuredProduct && featuredImage && safeRemainingProducts.length > 0 ? (
          <Link
            href={`/product/${featuredProduct.slug}`}
            className={isShowroom ? styles.editorialBand : "catalog-editorial-band"}
            data-testid="catalog-editorial-band"
          >
            <div className={isShowroom ? styles.editorialCopy : "catalog-editorial-band__copy"}>
              <p className={isShowroom ? styles.editorialEyebrow : "catalog-editorial-band__eyebrow type-meta"}>Featured</p>
              <h2 className={isShowroom ? styles.editorialTitle : "catalog-editorial-band__title type-card-title"}>{featuredProduct.name}</h2>
              <p className={isShowroom ? styles.editorialDescription : "catalog-editorial-band__description type-body"}>
                {getCatalogPreview(featuredProduct.tagline, isShowroom ? 124 : 190)}
              </p>
              <span className={isShowroom ? styles.editorialCta : "catalog-editorial-band__cta type-button"}>
                View product
                <ArrowRight aria-hidden className="size-4" />
              </span>
            </div>
            <div className={isShowroom ? styles.editorialMedia : "catalog-editorial-band__media"} aria-hidden>
              <MithronCardImage
                src={featuredImage.src}
                alt={featuredImage.alt}
                fill
                responsive={featuredImage.responsive}
                className={cn(isShowroom ? styles.editorialImage : "catalog-editorial-band__image", !isShowroom && "object-contain")}
                sizes="(min-width: 1024px) 420px, 72vw"
              />
            </div>
          </Link>
        ) : null}

        {safeRemainingProducts.length > 0 ? (
          <>
            <div className={isShowroom ? styles.separator : "catalog-section-separator"}>
              <p className={isShowroom ? styles.separatorLabel : "type-meta"}>More products</p>
              <span className={isShowroom ? styles.separatorRule : "catalog-section-separator__rule"} aria-hidden />
            </div>
            <CatalogContinuedGrid
              products={safeRemainingProducts}
              className={isShowroom ? styles.productGridContinued : "catalog-product-grid--continued min-w-0"}
              presentation={cardPresentation}
            />
          </>
        ) : null}
      </section>
    </div>
  );
}

function getCatalogPreview(value: string, limit: number) {
  return clipProductPreviewText(value, limit);
}
