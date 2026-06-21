"use client";

import { useMemo, useState, type CSSProperties, type ImgHTMLAttributes, type SyntheticEvent } from "react";
import {
  createSrcSet,
  getBestVariant,
  getFormatVariants,
  getResponsiveAssetForSrc
} from "@/config/generated-assets";
import { reportImageRenderMetrics } from "@/lib/media/debug-image-metrics";
import { resolveStorefrontSrc } from "@/lib/media/resolve-storefront-src";
import { cn } from "@/lib/utils";

type MithronResponsiveImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "loading"> & {
  src: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  loading?: "eager" | "lazy";
  sizes?: string;
  preferredFormat?: "avif" | "webp" | "png";
  useSourceImage?: boolean;
  wrapperClassName?: string;
  imageClassName?: string;
};

function isRemoteSrc(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

function pickResponsiveWidth(width?: number | string, fill?: boolean) {
  if (fill) return undefined;
  const numeric = typeof width === "number" ? width : Number(width);
  if (Number.isFinite(numeric) && numeric > 0) return Math.min(numeric, 1280);
  return 768;
}

export function MithronResponsiveImage({
  src,
  alt,
  fill = false,
  priority = false,
  loading,
  sizes,
  preferredFormat: _preferredFormat,
  useSourceImage = false,
  className,
  wrapperClassName,
  imageClassName,
  style,
  width: widthProp,
  height: heightProp,
  ...props
}: MithronResponsiveImageProps) {
  const resolvedSrc = resolveStorefrontSrc(src);
  const responsive = useMemo(() => getResponsiveAssetForSrc(src), [src]);
  const bestVariant = useSourceImage ? undefined : getBestVariant(responsive, "webp");
  const webpSrcSet = useSourceImage ? "" : createSrcSet(getFormatVariants(responsive, "webp"));
  const pngSrcSet = useSourceImage ? "" : createSrcSet(getFormatVariants(responsive, "png"));
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasResponsiveVariants = !useSourceImage && Boolean(webpSrcSet || pngSrcSet);
  const useNativeRemoteImage = isRemoteSrc(resolvedSrc) && !hasResponsiveVariants;
  const optimizedSrc = useSourceImage ? resolvedSrc : (bestVariant?.src ?? resolvedSrc);
  const imageSrc = useSourceImage
    ? resolvedSrc
    : useNativeRemoteImage
      ? (failedSrc ?? resolvedSrc)
      : failedSrc
        ? (responsive?.fallbackSrc ?? resolvedSrc)
        : optimizedSrc;
  const resolvedLoading = priority ? "eager" : loading ?? "lazy";
  const width = widthProp ?? responsive?.width;
  const height = heightProp ?? responsive?.height;
  const backgroundStyle = {
    "--mithron-image-placeholder": responsive?.dominantColor ?? "transparent",
    "--mithron-image-blur": responsive?.blurDataUrl ? `url(${responsive.blurDataUrl})` : "none"
  } as CSSProperties;
  const resolvedSizes = sizes ?? (fill ? "100vw" : undefined);
  const maxVariantWidth = Math.max(
    0,
    ...getFormatVariants(responsive, "webp").map((variant) => variant.width)
  );

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    reportImageRenderMetrics(img, {
      component: "MithronResponsiveImage",
      hypothesisId: "A-B-E",
      requestedSrc: src,
      deliveredSrc: imageSrc,
      sizes: resolvedSizes,
      srcSet: webpSrcSet || pngSrcSet,
      assetStatus: responsive?.status,
      assetId: responsive?.assetId,
      maxVariantWidth: maxVariantWidth || undefined
    });
  };

  const handleImageError = () => {
    if (useNativeRemoteImage) {
      if (!failedSrc && responsive?.fallbackSrc && responsive.fallbackSrc !== resolvedSrc) {
        setFailedSrc(responsive.fallbackSrc);
      }
      return;
    }

    if (!failedSrc && resolvedSrc !== optimizedSrc) {
      setFailedSrc(resolvedSrc);
      return;
    }

    if (!failedSrc || failedSrc === resolvedSrc) {
      setFailedSrc(responsive?.fallbackSrc ?? resolvedSrc);
    }
  };

  if (useSourceImage || useNativeRemoteImage) {
    return (
      <picture
        data-mithron-asset-id={useSourceImage ? "source" : (responsive?.assetId ?? "remote")}
        data-mithron-asset-status={useSourceImage ? "source" : (responsive?.status ?? "missing")}
        data-mithron-asset-bucket={useSourceImage ? "local" : (responsive?.bucket ?? "unmapped")}
        className={cn("mithron-responsive-image-frame", fill ? "absolute inset-0 block" : "block", wrapperClassName)}
        style={backgroundStyle}
      >
        <img
          {...props}
          src={imageSrc}
          alt={alt}
          width={fill ? undefined : pickResponsiveWidth(width, fill)}
          height={fill ? undefined : (typeof height === "number" ? Math.min(height, 1280) : 512)}
          loading={resolvedLoading}
          fetchPriority={priority ? "high" : "auto"}
          decoding={priority ? "sync" : "async"}
          sizes={resolvedSizes}
          className={cn("mithron-responsive-image object-cover", fill && "absolute inset-0 h-full w-full", className, imageClassName)}
          style={style}
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      </picture>
    );
  }

  return (
    <picture
      data-mithron-asset-id={responsive?.assetId ?? "unmapped"}
      data-mithron-asset-status={responsive?.status ?? "missing"}
      data-mithron-asset-bucket={responsive?.bucket ?? "unmapped"}
      data-blur-placeholder={responsive?.blurDataUrl ? "true" : "false"}
      className={cn("mithron-responsive-image-frame", fill ? "absolute inset-0 block" : "block", wrapperClassName)}
      style={backgroundStyle}
    >
      {webpSrcSet ? <source type="image/webp" srcSet={webpSrcSet} sizes={resolvedSizes} /> : null}
      {pngSrcSet ? <source type="image/png" srcSet={pngSrcSet} sizes={resolvedSizes} /> : null}
      <img
        {...props}
        src={imageSrc}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        loading={resolvedLoading}
        fetchPriority={priority ? "high" : "auto"}
        decoding={priority ? "sync" : "async"}
        sizes={resolvedSizes}
        className={cn("mithron-responsive-image", fill && "absolute inset-0 h-full w-full object-cover", className, imageClassName)}
        style={style}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />
    </picture>
  );
}
