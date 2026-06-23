"use client";

import { useMemo, useState, type CSSProperties, type ImgHTMLAttributes, type SyntheticEvent } from "react";
import {
  createSrcSet,
  getBestVariant,
  getBestVariantUpToWidth,
  getFormatVariants,
  getResponsiveAssetForSrc,
  getVariantsUpToWidth
} from "@/config/generated-assets";
import { getMediaDeliveryProfile, type MediaDeliveryRole } from "@/config/media-delivery-profiles";
import type { ResponsiveMediaAsset } from "@/config/types";
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
  imageRole?: MediaDeliveryRole;
  preferredFormat?: "avif" | "webp" | "png";
  maxVariantWidth?: number;
  webpOnly?: boolean;
  responsive?: ResponsiveMediaAsset;
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

function resolveFormatVariants(
  responsive: ResponsiveMediaAsset | undefined,
  format: "avif" | "webp" | "png",
  maxVariantWidth: number | undefined,
  useSourceImage: boolean
) {
  if (useSourceImage || !responsive) return [];
  return maxVariantWidth
    ? getVariantsUpToWidth(responsive, format, maxVariantWidth)
    : getFormatVariants(responsive, format);
}

export function MithronResponsiveImage({
  src,
  alt,
  fill = false,
  priority = false,
  loading,
  sizes,
  imageRole,
  preferredFormat: preferredFormatProp,
  maxVariantWidth: maxVariantWidthProp,
  webpOnly: webpOnlyProp,
  responsive: responsiveOverride,
  useSourceImage = false,
  className,
  wrapperClassName,
  imageClassName,
  style,
  width: widthProp,
  height: heightProp,
  onError: onErrorProp,
  onLoad: onLoadProp,
  ...props
}: MithronResponsiveImageProps) {
  const profile = imageRole ? getMediaDeliveryProfile(imageRole) : undefined;
  const maxVariantWidth = maxVariantWidthProp ?? profile?.maxVariantWidth;
  const preferredFormat = preferredFormatProp ?? profile?.preferredFormat ?? "webp";
  const webpOnly = webpOnlyProp ?? profile?.webpOnly ?? false;

  const resolvedSrc = resolveStorefrontSrc(src);
  const responsive = useMemo(
    () => responsiveOverride ?? getResponsiveAssetForSrc(src),
    [responsiveOverride, src]
  );
  const avifVariants = useMemo(
    () => (webpOnly ? [] : resolveFormatVariants(responsive, "avif", maxVariantWidth, useSourceImage)),
    [useSourceImage, responsive, maxVariantWidth, webpOnly]
  );
  const webpVariants = useMemo(
    () => resolveFormatVariants(responsive, preferredFormat === "png" ? "png" : "webp", maxVariantWidth, useSourceImage),
    [useSourceImage, responsive, preferredFormat, maxVariantWidth]
  );
  const bestVariant = useSourceImage
    ? undefined
    : maxVariantWidth
      ? getBestVariantUpToWidth(responsive, maxVariantWidth, preferredFormat === "png" ? "png" : "webp")
      : getBestVariant(responsive, preferredFormat === "png" ? "png" : "webp");
  const avifSrcSet = useSourceImage || webpOnly ? "" : createSrcSet(avifVariants);
  const webpSrcSet = useSourceImage ? "" : createSrcSet(webpVariants);
  const pngSrcSet = useSourceImage || webpOnly ? "" : createSrcSet(getFormatVariants(responsive, "png"));
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasResponsiveVariants = !useSourceImage && Boolean(avifSrcSet || webpSrcSet || pngSrcSet);
  const useNativeRemoteImage = isRemoteSrc(resolvedSrc) && !hasResponsiveVariants && !responsiveOverride;
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
  const deliveredMaxVariantWidth = Math.max(0, ...webpVariants.map((variant) => variant.width), ...avifVariants.map((variant) => variant.width));

  const handleImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const notifyParent = () => onErrorProp?.(event);

    if (useNativeRemoteImage) {
      if (!failedSrc && responsive?.fallbackSrc && responsive.fallbackSrc !== resolvedSrc) {
        setFailedSrc(responsive.fallbackSrc);
        return;
      }
      notifyParent();
      return;
    }

    if (!failedSrc && resolvedSrc !== optimizedSrc) {
      setFailedSrc(resolvedSrc);
      return;
    }

    if (!failedSrc || failedSrc === resolvedSrc) {
      if (responsive?.fallbackSrc && responsive.fallbackSrc !== imageSrc) {
        setFailedSrc(responsive.fallbackSrc);
        return;
      }
    }

    notifyParent();
  };

  const handleImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    onLoadProp?.(event);
    const img = event.currentTarget;
    reportImageRenderMetrics(img, {
      component: "MithronResponsiveImage",
      hypothesisId: "A-B-E",
      requestedSrc: src,
      deliveredSrc: imageSrc,
      sizes: resolvedSizes,
      srcSet: avifSrcSet || webpSrcSet || pngSrcSet,
      assetStatus: responsive?.status,
      assetId: responsive?.assetId,
      maxVariantWidth: deliveredMaxVariantWidth || undefined
    });
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
      {avifSrcSet ? <source type="image/avif" srcSet={avifSrcSet} sizes={resolvedSizes} /> : null}
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
