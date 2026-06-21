import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { ProductHoverCard } from "@/components/cards/product-hover-card";
import { MithronResponsiveImage } from "@/components/media/mithron-responsive-image";
import type { Product } from "@/config/types";
import { getCatalogShowcaseMedia } from "@/lib/catalog-showcase-media";
import { clipProductPreviewText } from "@/lib/product-preview-text";
import { cn } from "@/lib/utils";
import styles from "./catalog-page.module.css";

type CatalogShowcaseImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  navbarInk?: "light" | "dark";
  fit?: "cinematic" | "native";
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
  const heroProduct = products[0];
  const heroMetrics = products.slice(0, 3);
  const leadProducts = products.slice(0, 8);
  const remainingProducts = products.slice(8);
  const featuredProduct = products[1] ?? heroProduct;
  const catalogTitle = title ?? heroProduct?.category ?? "Mithron systems";
  const catalogSubtitle = subtitle ?? (heroProduct ? `Source-backed ${heroProduct.category.toLowerCase()} selected for mission planning and field deployment.` : "Source-backed systems selected for mission planning and field deployment.");
  const shouldRenderFallbackHero = !showcaseImage && title && subtitle && heroImage;
  const cardPresentation = isShowroom ? "showroom" : "standard";

  return (
    <div className={isShowroom ? styles.shell : "catalog-page-shell surface-page"}>
      {showcaseImage ? (
        <section
          className="catalog-hero-section catalog-hero-section--showcase"
          data-navbar-ink={showcaseImage.navbarInk}
          data-showcase-fit={showcaseImage.fit ?? "cinematic"}
          style={
            {
              "--showcase-aspect-ratio": `${showcaseImage.width} / ${showcaseImage.height}`,
              "--showcase-max-width": `${showcaseImage.width}px`
            } as CSSProperties
          }
          aria-label={showcaseImage.alt}
        >
          <picture className="catalog-hero-image-section__frame">
            {optimizedShowcase?.avifSrcSet ? <source type="image/avif" srcSet={optimizedShowcase.avifSrcSet} sizes="(min-width: 1440px) 1440px, 100vw" /> : null}
            {optimizedShowcase?.webpSrcSet ? <source type="image/webp" srcSet={optimizedShowcase.webpSrcSet} sizes="(min-width: 1440px) 1440px, 100vw" /> : null}
            <img
              src={optimizedShowcase?.src ?? showcaseImage.src}
              alt={showcaseImage.alt}
              width={optimizedShowcase?.width ?? showcaseImage.width}
              height={optimizedShowcase?.height ?? showcaseImage.height}
              loading="eager"
              decoding="async"
              sizes="(min-width: 1440px) 1440px, 100vw"
              className="catalog-hero-image-section__asset"
            />
          </picture>
        </section>
      ) : shouldRenderFallbackHero ? (
        <section className="catalog-hero-section ambient-section ambient-dark relative -mt-16 overflow-hidden bg-black px-6 pb-12 pt-32 text-white md:min-h-[560px] md:px-16 md:pb-16" data-navbar-ink="light">
          <MithronResponsiveImage src={heroImage} alt={title} fill className="catalog-hero__bg object-cover opacity-28 blur-[1px] saturate-[.86]" sizes="(min-width: 1440px) 1440px, 100vw" />
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
                    <Link href={`/product/${heroProduct.slug}`}>Plan field deployment</Link>
                  </Button>
                ) : null}
                <Button asChild variant="glass">
                  <Link href="#catalog-grid">Compare systems</Link>
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
        className={isShowroom ? styles.gridSection : "catalog-grid-section mx-auto max-w-[1440px] scroll-mt-28 px-6 py-12 md:px-16"}
        data-navbar-ink="dark"
      >
        <div className={isShowroom ? styles.intro : "catalog-intro"} data-testid="catalog-intro">
          <div>
            <p className={isShowroom ? styles.eyebrow : "catalog-intro__eyebrow type-meta"}>Mithron catalog</p>
            <h1 className={isShowroom ? styles.title : "catalog-intro__title type-section"}>{catalogTitle}</h1>
          </div>
          <div className={isShowroom ? styles.introCopy : "catalog-intro__copy"}>
            <p className={isShowroom ? styles.subtitle : "catalog-intro__subtitle type-subtitle"}>{catalogSubtitle}</p>
            <div className={isShowroom ? styles.meta : "catalog-intro__meta type-technical"}>
              <span>{products.length} systems</span>
              {heroProduct ? <span>{heroProduct.category}</span> : null}
            </div>
          </div>
        </div>

        <div className={isShowroom ? styles.productGrid : "catalog-product-grid grid min-w-0 md:grid-cols-3 xl:grid-cols-4"}>
          {leadProducts.map((product) => (
            <ProductHoverCard key={product.slug} product={product} variant="catalog" showCategory cta="catalog" presentation={cardPresentation} />
          ))}
        </div>

        {featuredProduct && remainingProducts.length > 0 ? (
          <Link
            href={`/product/${featuredProduct.slug}`}
            className={isShowroom ? styles.editorialBand : "catalog-editorial-band"}
            data-testid="catalog-editorial-band"
          >
            <div className={isShowroom ? styles.editorialCopy : "catalog-editorial-band__copy"}>
              <p className={isShowroom ? styles.editorialEyebrow : "catalog-editorial-band__eyebrow type-meta"}>Featured system</p>
              <h2 className={isShowroom ? styles.editorialTitle : "catalog-editorial-band__title type-card-title"}>{featuredProduct.name}</h2>
              <p className={isShowroom ? styles.editorialDescription : "catalog-editorial-band__description type-body"}>
                {getCatalogPreview(featuredProduct.tagline, isShowroom ? 124 : 190)}
              </p>
              <span className={isShowroom ? styles.editorialCta : "catalog-editorial-band__cta type-button"}>
                View system
                <ArrowRight aria-hidden className="size-4" />
              </span>
            </div>
            <div className={isShowroom ? styles.editorialMedia : "catalog-editorial-band__media"} aria-hidden>
              <MithronResponsiveImage
                src={featuredProduct.image.src}
                alt={featuredProduct.image.alt}
                fill
                className={cn(isShowroom ? styles.editorialImage : "catalog-editorial-band__image", !isShowroom && "object-contain")}
                sizes="(min-width: 1024px) 420px, 72vw"
              />
            </div>
          </Link>
        ) : null}

        {remainingProducts.length > 0 ? (
          <>
            <div className={isShowroom ? styles.separator : "catalog-section-separator"}>
              <p className={isShowroom ? styles.separatorLabel : "type-meta"}>Complete ecosystem</p>
              <span className={isShowroom ? styles.separatorRule : "catalog-section-separator__rule"} aria-hidden />
            </div>
            <div className={isShowroom ? cn(styles.productGrid, styles.productGridContinued) : "catalog-product-grid catalog-product-grid--continued grid md:grid-cols-3 xl:grid-cols-4"}>
              {remainingProducts.map((product) => (
                <ProductHoverCard key={product.slug} product={product} variant="catalog" showCategory cta="catalog" presentation={cardPresentation} />
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function getCatalogPreview(value: string, limit: number) {
  return clipProductPreviewText(value, limit);
}
