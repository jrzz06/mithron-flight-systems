"use client";

import type { CSSProperties, ImgHTMLAttributes } from "react";
import { MithronResponsiveImage } from "@/components/media/mithron-responsive-image";
import type { ResponsiveMediaAsset } from "@/config/types";

type MithronPageHeroImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "loading"> & {
  src: string;
  alt: string;
  sizes?: string;
  fill?: boolean;
  priority?: boolean;
  responsive?: ResponsiveMediaAsset;
  className?: string;
  wrapperClassName?: string;
  style?: CSSProperties;
};

export function MithronPageHeroImage({
  src,
  alt,
  sizes = "100vw",
  fill = true,
  priority = false,
  responsive,
  className,
  wrapperClassName,
  style
}: MithronPageHeroImageProps) {
  return (
    <MithronResponsiveImage
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      imageRole="hero"
      priority={priority}
      responsive={responsive}
      loading={priority ? "eager" : "lazy"}
      className={className}
      wrapperClassName={wrapperClassName}
      style={style}
    />
  );
}
