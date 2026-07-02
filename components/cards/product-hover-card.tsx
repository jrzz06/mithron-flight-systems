import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { MithronCardImage } from "@/components/media/mithron-card-image";
import type { Product } from "@/config/types";
import { resolveCatalogCardImage } from "@/lib/media/catalog-card-image";
import { productBadgeCssClass } from "@/lib/product-badge";
import { clipProductPreviewText, sanitizeProductPreviewText } from "@/lib/product-preview-text";
import { cn, formatINR } from "@/lib/utils";
import styles from "./product-hover-card.module.css";

type ProductHoverCardVariant = "rail" | "compact" | "catalog" | "related";
type ProductHoverCardCta = "pill" | "arrow" | "catalog";
type ProductHoverCardPresentation = "standard" | "showroom";

const imageHeights: Record<ProductHoverCardVariant, string> = {
  rail: "h-[280px] md:h-[390px]",
  compact: "h-[180px] md:h-[250px]",
  catalog: "h-[248px]",
  related: "h-44"
};

const imageSizes: Record<ProductHoverCardVariant, string> = {
  rail: "320px",
  compact: "260px",
  catalog: "(min-width:1280px) 25vw, (min-width:768px) 33vw, (min-width:360px) 50vw, 100vw",
  related: "240px"
};

export const ProductHoverCard = memo(function ProductHoverCard({
  product,
  variant = "rail",
  showCategory = false,
  cta = "pill",
  presentation = "standard",
  priority = false,
  className
}: {
  product: Product;
  variant?: ProductHoverCardVariant;
  showCategory?: boolean;
  cta?: ProductHoverCardCta;
  presentation?: ProductHoverCardPresentation;
  priority?: boolean;
  className?: string;
}) {
  const isShowroomCatalog = variant === "catalog" && presentation === "showroom";
  const catalogImage = variant === "catalog" ? resolveCatalogCardImage(product.image) : null;
  const description = isShowroomCatalog
    ? getShowroomPreview(product)
    : variant === "catalog"
      ? getCatalogPreview(product.tagline)
      : product.tagline;

  if (isShowroomCatalog) {
    return (
      <article
        data-testid={`premium-product-card-${product.slug}`}
        data-card-variant={variant}
        className={cn(styles.shell, className)}
      >
        <Link href={`/product/${product.slug}`} className={styles.card}>
          <div className={styles.media}>
            <div className={styles.mediaSurface} aria-hidden />
            <div className={styles.imageFrame}>
              <MithronCardImage
                src={catalogImage!.src}
                alt={catalogImage!.alt}
                fill
                priority={priority}
                useSourceImage
                className={styles.image}
                sizes={imageSizes.catalog}
              />
            </div>
            {product.badge ? (
              <span className={cn(styles.badge, productBadgeCssClass(product.badgeStyle ?? "default", "showroom"))}>
                {product.badge}
              </span>
            ) : null}
          </div>

          <div className={styles.body}>
            {showCategory ? <p className={styles.category}>{product.category}</p> : null}
            <h3 className={styles.title}>{product.name}</h3>
            <p data-testid={`premium-product-description-${product.slug}`} className={styles.description}>
              {description}
            </p>
            <div className={styles.footer}>
              <span className={styles.cta}>
                View product
                <ArrowRight aria-hidden className={styles.ctaIcon} />
              </span>
              <p className={styles.price}>From {formatINR(product.price)}</p>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article
      data-testid={`premium-product-card-${product.slug}`}
      data-card-variant={variant}
      className={cn("premium-product-card-shell flex h-full flex-col", className)}
    >
      <Link
        href={`/product/${product.slug}`}
        className="premium-product-card group flex h-full min-w-0 flex-1 flex-col overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#1f6b46]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ds-card)]"
      >
        <div
          className={cn("premium-product-card__media relative overflow-hidden", imageHeights[variant])}
        >
          <div
            className="premium-product-card__image absolute inset-0"
          >
            <MithronCardImage
              src={catalogImage!.src}
              alt={catalogImage!.alt}
              fill
              priority={priority}
              useSourceImage
              className="premium-product-card__image-asset object-contain"
              sizes={imageSizes[variant]}
            />
          </div>
          {product.badge ? (
            <Badge className={cn("absolute left-5 top-5 normal-case tracking-normal", productBadgeCssClass(product.badgeStyle ?? "default", "pill"))}>
              {product.badge}
            </Badge>
          ) : null}
        </div>

        <div
          className="premium-product-card__body flex min-w-0 flex-1 flex-col gap-2"
        >
          {showCategory ? <p className="premium-product-card__category type-meta">{product.category}</p> : null}
          <h3
            className={cn(
              "premium-product-card__title type-card-title",
              variant === "related" ? "text-base" : ""
            )}
          >
            {product.name}
          </h3>

          <p
            data-testid={`premium-product-description-${product.slug}`}
            className="premium-product-card__description type-body"
          >
            {description}
          </p>

          <div
            className="premium-product-card__footer mt-auto flex min-w-0 items-center justify-between gap-3"
          >
            {cta === "pill" ? (
              <span
                className="premium-product-card__cta premium-product-card__cta-pill type-button inline-flex items-center justify-center rounded-full text-xs"
              >
                Plan deployment
              </span>
            ) : cta === "arrow" ? (
              <span
                aria-hidden
                className="premium-product-card__cta premium-product-card__cta-pill grid size-[44px] place-items-center rounded-full"
              >
                <ArrowRight className="size-5" />
              </span>
            ) : (
              <span
                className="premium-product-card__cta premium-product-card__cta-text type-button inline-flex items-center justify-center gap-2 rounded-full"
              >
                View product
                <ArrowRight aria-hidden className="size-4" />
              </span>
            )}
            <span className="premium-product-card__price type-price min-w-0 shrink-0 font-bold text-right">From {formatINR(product.price)}</span>
          </div>
        </div>
      </Link>
    </article>
  );
});

function getShowroomPreview(product: Product) {
  const clean = sanitizeProductPreviewText(product.tagline).trim();
  if (clean) return clipProductPreviewText(clean, 120);
  return clipProductPreviewText(product.category, 48);
}

function getCatalogPreview(value: string) {
  return clipProductPreviewText(value, 132);
}
