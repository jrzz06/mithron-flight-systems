import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { MithronCardImage } from "@/components/media/mithron-card-image";
import type { Product } from "@/config/types";
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
  catalog: "(min-width:1280px) 25vw, (min-width:768px) 33vw, 100vw",
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
                src={product.image.src}
                alt={product.image.alt}
                fill
                priority={priority}
                responsive={product.image.responsive}
                className={styles.image}
                sizes={imageSizes.catalog}
              />
            </div>
            {product.badge ? <span className={cn(styles.badge, getBadgeToneClass(product.badge))}>{product.badge}</span> : null}
          </div>

          <div className={styles.body}>
            {showCategory ? <p className={styles.category}>{product.category}</p> : null}
            <h3 className={styles.title}>{product.name}</h3>
            <p data-testid={`premium-product-description-${product.slug}`} className={styles.description}>
              {description}
            </p>
            <div className={styles.footer}>
              <span className={styles.cta}>
                View System
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
              src={product.image.src}
              alt={product.image.alt}
              fill
              priority={priority}
              responsive={product.image.responsive}
              className="premium-product-card__image-asset object-contain"
              sizes={imageSizes[variant]}
            />
          </div>
          {product.badge ? <Badge className="absolute left-5 top-5 normal-case tracking-normal">{product.badge}</Badge> : null}
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
                View system
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
  const source = `${product.name} ${product.category} ${product.tagline}`.toLowerCase();

  if (/battery|power|mah|charger|charging/.test(source)) return "High-efficiency mission power.";
  if (/propeller|propellers|landing gear|toolkit|tool kit|case|cable|connector|pump|nozzle|festo|motor|frame/.test(source)) return "Mission-ready component hardware.";
  if (/thermal|inspection|surveillance|security|zoom|camera|seeker/.test(source)) return "Professional inspection platform.";
  if (/mapping|survey|rtk|gnss|pix4d|mapper|multispectral/.test(source)) return "High-precision mapping workflow.";
  if (/delivery|flybox|payload/.test(source)) return "Autonomous payload deployment.";
  if (/agri|agriculture|spray|spraying|seed|spreader|farming|farm|liter|litre|l\b/.test(source)) return "Precision agriculture field system.";
  if (/video|cinema|creative|4k|aerial/.test(source)) return "Cinematic aerial storytelling.";

  const clean = sanitizeProductPreviewText(product.tagline);

  if (!clean) return "Curated hardware for professional field operations.";
  if (clean.length <= 72) return clean;

  const clipped = clean.slice(0, 72).replace(/\s+\S*$/, "").replace(/[.,;:]+$/, "");
  return `${clipped}.`;
}

function getCatalogPreview(value: string) {
  return clipProductPreviewText(value, 132);
}

function getBadgeToneClass(value: string) {
  const tone = value.trim().toLowerCase();

  if (tone === "featured") return styles.badgeFeatured;
  if (tone === "pro") return styles.badgePro;
  if (tone === "enterprise") return styles.badgeEnterprise;
  if (tone === "new") return styles.badgeNew;

  return undefined;
}
