import type { CSSProperties, SyntheticEvent } from "react";
import {
  createSrcSet,
  getBestVariant,
  getFormatVariants,
  getResponsiveAssetForSrc
} from "@/config/generated-assets";
import { reportImageRenderMetrics } from "@/lib/media/debug-image-metrics";
import { resolveStorefrontSrc } from "@/lib/media/resolve-storefront-src";
import { cn } from "@/lib/utils";

type MithronShelfHeroImageProps = {
  src: string;
  alt: string;
  fill?: boolean;
  sizes?: string;
  className?: string;
  priority?: boolean;
};

export function MithronShelfHeroImage({
  src,
  alt,
  fill = false,
  sizes = "(max-width: 640px) 100vw, (max-width: 1536px) 100vw, 1536px",
  className,
  priority = false
}: MithronShelfHeroImageProps) {
  const resolvedSrc = resolveStorefrontSrc(src);
  const responsive = getResponsiveAssetForSrc(src);
  const bestVariant = getBestVariant(responsive, "webp");
  const webpSrcSet = createSrcSet(getFormatVariants(responsive, "webp"));
  const imageSrc = bestVariant?.src ?? resolvedSrc;
  const backgroundStyle = responsive?.dominantColor
    ? ({ backgroundColor: responsive.dominantColor } as CSSProperties)
    : undefined;
  const maxVariantWidth = Math.max(0, ...getFormatVariants(responsive, "webp").map((variant) => variant.width));

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    reportImageRenderMetrics(event.currentTarget, {
      component: "MithronShelfHeroImage",
      hypothesisId: "B-C",
      requestedSrc: src,
      deliveredSrc: imageSrc,
      sizes,
      srcSet: webpSrcSet,
      assetStatus: responsive?.status,
      assetId: responsive?.assetId,
      maxVariantWidth: maxVariantWidth || undefined
    });
  };

  return (
    <picture
      data-mithron-asset-id={responsive?.assetId ?? "unmapped"}
      data-mithron-asset-status={responsive?.status ?? "missing"}
      data-mithron-asset-bucket={responsive?.bucket ?? "unmapped"}
      className={cn(fill && "absolute inset-0 block")}
      style={backgroundStyle}
    >
      {webpSrcSet ? <source type="image/webp" srcSet={webpSrcSet} sizes={sizes} /> : null}
      <img
        src={imageSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        sizes={sizes}
        width={responsive?.width}
        height={responsive?.height}
        className={cn(
          "mithron-shelf-hero-image",
          fill && "absolute inset-0 h-full w-full object-cover",
          className
        )}
        onLoad={handleImageLoad}
      />
    </picture>
  );
}
