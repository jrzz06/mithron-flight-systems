"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { MithronThumbImage } from "@/components/media/mithron-thumb-image";
import { useReducedMotionPreference } from "@/hooks/use-reduced-motion";
import type { HomeMiniCarouselItem } from "@/lib/home/mini-carousel";
import styles from "./home-landing-composite.module.css";

type MiniCarouselScrollState = {
  canPrev: boolean;
  canNext: boolean;
};

function readMiniCarouselScrollState(rail: HTMLDivElement): MiniCarouselScrollState {
  const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
  return {
    canPrev: rail.scrollLeft > 8,
    canNext: rail.scrollLeft < maxScrollLeft - 8
  };
}

export function HomeMiniCarousel({
  items
}: {
  items: HomeMiniCarouselItem[];
}) {
  const miniCarouselRailRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotionPreference();
  const [scrollState, setScrollState] = useState<MiniCarouselScrollState>({
    canPrev: false,
    canNext: true
  });

  const updateScrollState = useCallback(() => {
    const rail = miniCarouselRailRef.current;
    if (!rail) return;
    setScrollState(readMiniCarouselScrollState(rail));
  }, []);

  useEffect(() => {
    const rail = miniCarouselRailRef.current;
    if (!rail) return;

    updateScrollState();
    rail.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(rail);

    return () => {
      rail.removeEventListener("scroll", updateScrollState);
      resizeObserver.disconnect();
    };
  }, [items, updateScrollState]);

  const scrollMiniCarousel = useCallback((direction: "prev" | "next") => {
    const rail = miniCarouselRailRef.current;
    if (!rail) return;

    const distance = rail.clientWidth * 0.72;
    rail.scrollBy({
      left: direction === "next" ? distance : -distance,
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }, [reducedMotion]);

  return (
    <div
      className={styles.miniCarousel}
      data-testid="home-mini-carousel"
      data-carousel-kind="product"
      data-media-state={items.some((item) => item.sourceState === "VERIFIED") ? "VERIFIED" : "FALLBACK"}
    >
      <div className={styles.miniCarouselViewport}>
        <button
          type="button"
          className={`${styles.miniCarouselNav} ${styles.miniCarouselPrev}`}
          aria-label="Show previous Mithron categories"
          data-testid="home-mini-carousel-prev"
          disabled={!scrollState.canPrev}
          onClick={() => scrollMiniCarousel("prev")}
        >
          <ArrowLeft size={22} aria-hidden="true" />
        </button>

        <div
          ref={miniCarouselRailRef}
          className={styles.miniCarouselRail}
          data-testid="home-mini-carousel-rail"
          aria-label="Mithron product category carousel"
        >
          {items.map((item) => (
            <Link
              href={item.href}
              className={styles.miniCarouselItem}
              data-testid="home-mini-carousel-item"
              data-media-state={item.sourceState}
              key={item.itemKey}
              title={item.fullLabel}
            >
              <span className={styles.miniCarouselImageWell}>
                <MithronThumbImage
                  src={item.media.src}
                  alt=""
                  aria-hidden={true}
                  fill
                  responsive={item.media.responsive}
                  sizes="(max-width: 640px) 92px, 128px"
                  className={styles.miniCarouselImage}
                />
              </span>
              <span className={styles.miniCarouselLabel}>{item.label}</span>
            </Link>
          ))}
        </div>

        <button
          type="button"
          className={`${styles.miniCarouselNav} ${styles.miniCarouselNext}`}
          aria-label="Show more Mithron categories"
          data-testid="home-mini-carousel-next"
          disabled={!scrollState.canNext}
          onClick={() => scrollMiniCarousel("next")}
        >
          <ArrowRight size={22} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
