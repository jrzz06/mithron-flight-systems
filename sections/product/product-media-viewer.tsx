"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MediaAsset, ProductHotspot } from "@/config/types";
import { MithronResponsiveImage } from "@/components/media/mithron-responsive-image";
import { glassPillClassName } from "@/lib/glass-ui";
import { cn } from "@/lib/utils";

export type ProductMediaViewerModel = {
  image: MediaAsset;
  hero: MediaAsset;
  gallery: MediaAsset[];
  hotspots?: ProductHotspot[];
};

function uniqueMediaAssets(items: MediaAsset[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.src)) return false;
    seen.add(item.src);
    return true;
  });
}

function mediaReliabilityScore(src: string) {
  if (src.includes("/storage/v1/object/public/")) return 3;
  if (src.startsWith("/")) return 2;
  return 1;
}

function sortMediaAssets(items: MediaAsset[]) {
  return [...items].sort((left, right) => mediaReliabilityScore(right.src) - mediaReliabilityScore(left.src));
}

export function ProductMediaViewer({ product }: { product: ProductMediaViewerModel }) {
  const slides = useMemo(
    () => sortMediaAssets(uniqueMediaAssets([product.hero, product.image, ...product.gallery])),
    [product.gallery, product.hero, product.image]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedSrcs, setFailedSrcs] = useState<Set<string>>(() => new Set());
  const [activeHotspot, setActiveHotspot] = useState<string | null>(product.hotspots?.[0]?.id ?? null);

  const visibleSlides = useMemo(
    () => slides.filter((slide) => !failedSrcs.has(slide.src)),
    [failedSrcs, slides]
  );
  const safeActiveIndex =
    visibleSlides.length === 0 ? 0 : Math.min(activeIndex, visibleSlides.length - 1);
  const activeMedia =
    visibleSlides[safeActiveIndex] ?? visibleSlides[0] ?? product.hero ?? product.image;
  const selectedHotspot = product.hotspots?.find((hotspot) => hotspot.id === activeHotspot);
  const hasMultipleSlides = visibleSlides.length > 1;

  const goTo = useCallback((index: number) => {
    if (!visibleSlides.length) return;
    setActiveIndex((index + visibleSlides.length) % visibleSlides.length);
  }, [visibleSlides.length]);

  const handleImageError = useCallback(() => {
    const failedSrc = activeMedia?.src;
    if (!failedSrc) return;

    setFailedSrcs((current) => {
      const next = new Set(current);
      next.add(failedSrc);
      return next;
    });
    setActiveIndex(0);
  }, [activeMedia.src]);

  useEffect(() => {
    if (!hasMultipleSlides) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") goTo(safeActiveIndex - 1);
      if (event.key === "ArrowRight") goTo(safeActiveIndex + 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [safeActiveIndex, goTo, hasMultipleSlides]);

  return (
    <div
      className="product-media-viewer bg-[var(--surface-muted)] md:sticky md:top-[104px] md:max-h-[calc(100dvh-104px)] md:min-h-[620px]"
      data-media-viewer="mithron-native-assets"
    >
      <div
        className={cn(
          "mx-auto flex max-w-[920px] flex-col gap-4 p-4 md:max-w-none md:p-8",
          hasMultipleSlides && "md:grid md:grid-cols-[88px_minmax(0,1fr)] md:gap-5 lg:grid-cols-[96px_minmax(0,1fr)]"
        )}
      >
        {hasMultipleSlides ? (
          <div
            className="order-2 flex gap-2 overflow-x-auto pb-1 md:order-1 md:flex-col md:overflow-visible md:pb-0"
            role="tablist"
            aria-label="Product images"
          >
            {visibleSlides.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                role="tab"
                aria-selected={safeActiveIndex === index}
                aria-label={`View image ${index + 1} of ${visibleSlides.length}`}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative size-[72px] shrink-0 overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow] duration-200 md:size-[88px]",
                  safeActiveIndex === index
                    ? "border-[#0f172a] shadow-[0_0_0_1px_#0f172a]"
                    : "border-slate-200 hover:border-slate-400"
                )}
              >
                <MithronResponsiveImage
                  src={slide.src}
                  alt=""
                  fill
                  className="object-contain p-1.5"
                  sizes="88px"
                />
              </button>
            ))}
          </div>
        ) : null}

        <div className={cn("relative min-h-0", hasMultipleSlides ? "order-1 md:order-2" : "")}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--surface-shadow-soft)]">
            <MithronResponsiveImage
              src={activeMedia.src}
              alt={activeMedia.alt}
              fill
              onError={handleImageError}
              className="object-contain p-6 md:p-10"
              sizes="(min-width: 1024px) 55vw, 100vw"
            />

            {product.hotspots?.map((hotspot) => (
              <button
                key={hotspot.id}
                type="button"
                data-testid={`product-hotspot-${hotspot.id}-desktop`}
                aria-label={hotspot.label}
                aria-pressed={activeHotspot === hotspot.id}
                onClick={() => setActiveHotspot(hotspot.id)}
                className={cn(
                  "type-button absolute z-30 hidden min-h-11 -translate-x-1/2 -translate-y-1/2 rounded-full border px-4 py-2 text-xs shadow-md transition-colors md:inline-flex",
                  activeHotspot === hotspot.id
                    ? glassPillClassName("border-white/40 shadow-lg")
                    : "border-white/70 bg-[#0f172a]/85 text-white"
                )}
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              >
                {hotspot.label}
              </button>
            ))}

            {selectedHotspot ? (
              <div className="absolute inset-x-4 bottom-4 z-20 max-w-xs rounded-xl border border-slate-200 bg-white p-4 shadow-lg md:bottom-6 md:left-6">
                <p className="type-card-title text-sm text-[#0f172a]">{selectedHotspot.label}</p>
                <p className="type-body mt-1 line-clamp-3 text-xs leading-relaxed text-slate-600">{selectedHotspot.detail}</p>
              </div>
            ) : null}

            {hasMultipleSlides ? (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() => goTo(safeActiveIndex - 1)}
                  className="absolute left-3 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 md:left-5"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() => goTo(safeActiveIndex + 1)}
                  className="absolute right-3 top-1/2 z-20 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 md:right-5"
                >
                  <ChevronRight className="size-5" />
                </button>
                <p className="type-meta absolute right-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs text-slate-600 shadow-sm">
                  {safeActiveIndex + 1} / {visibleSlides.length}
                </p>
              </>
            ) : null}
          </div>

          {product.hotspots?.length ? (
            <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto md:hidden">
              {product.hotspots.map((hotspot) => (
                <button
                  key={hotspot.id}
                  type="button"
                  data-testid={`product-hotspot-${hotspot.id}-mobile`}
                  aria-label={hotspot.label}
                  aria-pressed={activeHotspot === hotspot.id}
                  onClick={() => setActiveHotspot(hotspot.id)}
                  className={cn(
                    "type-button min-h-11 min-w-max rounded-full border px-4 py-2 text-xs transition-colors",
                    activeHotspot === hotspot.id
                      ? glassPillClassName("shadow-md")
                      : "border-slate-200 bg-white text-slate-700"
                  )}
                >
                  {hotspot.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
