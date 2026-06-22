"use client";

import type { CSSProperties, ImgHTMLAttributes } from "react";
import { MithronResponsiveImage } from "@/components/media/mithron-responsive-image";
import type { ResponsiveMediaAsset } from "@/config/types";

type MithronThumbImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "loading"> & {
  src: string;
  alt: string;
  sizes?: string;
  fill?: boolean;
  responsive?: ResponsiveMediaAsset;
  className?: string;
  wrapperClassName?: string;
  style?: CSSProperties;
};

export function MithronThumbImage({
  src,
  alt,
  sizes = "80px",
  fill = true,
  responsive,
  className,
  wrapperClassName,
  style
}: MithronThumbImageProps) {
  return (
    <MithronResponsiveImage
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      imageRole="thumb"
      responsive={responsive}
      loading="lazy"
      decoding="async"
      className={className}
      wrapperClassName={wrapperClassName}
      style={style}
    />
  );
}
