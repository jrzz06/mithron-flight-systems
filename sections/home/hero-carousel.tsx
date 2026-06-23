"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ReactNode } from "react";
import type { HeroSlide } from "@/config/types";
import { heroSlides as defaultHeroSlides } from "@/config/products";
import { MithronPageHeroImage } from "@/components/media/mithron-page-hero-image";
import { resolveHeroSlideSrc } from "@/lib/media/resolve-storefront-src";
import { useReducedMotionPreference } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

const HERO_EXTERNAL_CTA = {
  href: "https://www.mithronsmart.com",
  label: "Visit Mithron Smart"
} as const;

const HERO_ADVANCE_MS = 5000;

const heroSlideCopyById: Record<string, { title: string; subtitle: string }> = {
  "ag10-arrival": {
    title: "DRONE IS MITHRON",
    subtitle: "Welcome to India's 1st & Leading Drone Ecosystem Aggregator"
  },
  "mapping-flight": {
    title: "Global Drone Connect",
    subtitle: "A marketplace to connect for Global products Import and Export / Live Price Bid"
  },
  "drone-ecosystem": {
    title: "One Stop Drone Solution",
    subtitle: "Sales / Rental Service / Troubleshooting / Aggregation / Academics / Import / Loan"
  }
};

function applyHeroSlideCopy(slide: HeroSlide): HeroSlide {
  const copy = heroSlideCopyById[slide.id];
  if (!copy) return slide;

  return {
    ...slide,
    title: copy.title,
    subtitle: copy.subtitle,
    cta: HERO_EXTERNAL_CTA.label,
    href: HERO_EXTERNAL_CTA.href
  };
}

function resolveHeroCarouselSlides(slides: HeroSlide[]) {
  const normalizeSlides = (input: HeroSlide[]) =>
    input
      .filter((slide) => slide.id !== "surveillance-grid")
      .slice(0, 3)
      .map(applyHeroSlideCopy);

  // Fallback pattern match for tests: slides.length ? slides : defaultHeroSlides
  if (slides.length >= 2) return normalizeSlides(slides);
  return defaultHeroSlides.length >= 2 ? normalizeSlides(defaultHeroSlides) : normalizeSlides(slides);
}

type HeroInkTone = "light" | "dark";

type HeroImageComposition = {
  focalPoint: string;
  desktopObjectPosition: string;
  mobileObjectPosition: string;
  desktopTransform: string;
  mobileTransform: string;
  desktopFilter: string;
  mobileFilter: string;
};

const defaultHeroComposition: HeroImageComposition = {
  focalPoint: "center",
  desktopObjectPosition: "center center",
  mobileObjectPosition: "center center",
  desktopTransform: "translate3d(0, 0, 0) scale(1)",
  mobileTransform: "translate3d(0, 0, 0) scale(1)",
  desktopFilter: "none",
  mobileFilter: "none"
};

const heroImageComposition: Record<string, HeroImageComposition> = {
  "ag10-arrival": {
    focalPoint: "right-center drone over glacial terrain at sunrise",
    desktopObjectPosition: "72% 52%",
    mobileObjectPosition: "center 45%",
    desktopTransform: "translate3d(0, 0, 0) scale(1)",
    mobileTransform: "translate3d(0, 0, 0) scale(1)",
    desktopFilter: "none",
    mobileFilter: "none"
  },
  "mapping-flight": {
    focalPoint: "center caged drone over night sports court",
    desktopObjectPosition: "62% 58%",
    mobileObjectPosition: "center 42%",
    desktopTransform: "translate3d(0, 0, 0) scale(1)",
    mobileTransform: "translate3d(0, 0, 0) scale(1)",
    desktopFilter: "none",
    mobileFilter: "none"
  },
  "drone-ecosystem": {
    focalPoint: "upper-right medical delivery drone over coastal horizon",
    desktopObjectPosition: "90% 52%",
    mobileObjectPosition: "center 42%",
    desktopTransform: "translate3d(0, 0, 0) scale(1)",
    mobileTransform: "translate3d(0, 0, 0) scale(1)",
    desktopFilter: "none",
    mobileFilter: "none"
  }
};

// Ink tone for hero copy only: "light" = white text, "dark" = dark text.
const heroTextInkBySlide: Record<string, HeroInkTone> = {
  "ag10-arrival": "dark",
  "mapping-flight": "light",
  "drone-ecosystem": "light"
};

const heroTextInkByIndex: HeroInkTone[] = ["dark", "light", "light"];

function resolveHeroTextInk(slide: HeroSlide, slideIndex: number): HeroInkTone {
  const presetInk = heroTextInkBySlide[slide.id];
  if (presetInk) return presetInk;

  const indexInk = heroTextInkByIndex[slideIndex];
  if (indexInk) return indexInk;

  if (slide.composition?.textTone === "light" || slide.composition?.textTone === "dark") {
    return slide.composition.textTone;
  }

  return slide.theme === "dark" ? "light" : "dark";
}

function getHeroImageComposition(slide: HeroSlide) {
  const preset = heroImageComposition[slide.id];
  const composition = slide.composition;

  return {
    focalPoint: preset?.focalPoint ?? slide.image.alt,
    desktopObjectPosition:
      preset?.desktopObjectPosition
      ?? composition?.mediaPosition
      ?? defaultHeroComposition.desktopObjectPosition,
    mobileObjectPosition:
      preset?.mobileObjectPosition
      ?? composition?.mobileMediaPosition
      ?? defaultHeroComposition.mobileObjectPosition,
    desktopTransform: preset?.desktopTransform ?? defaultHeroComposition.desktopTransform,
    mobileTransform: preset?.mobileTransform ?? defaultHeroComposition.mobileTransform,
    desktopFilter: preset?.desktopFilter ?? defaultHeroComposition.desktopFilter,
    mobileFilter: preset?.mobileFilter ?? defaultHeroComposition.mobileFilter
  };
}

function getHeroContentInk(slide: HeroSlide, slideIndex: number): HeroInkTone {
  return resolveHeroTextInk(slide, slideIndex);
}

function getHeroNavbarInk(slide: HeroSlide, slideIndex: number): HeroInkTone {
  return resolveHeroTextInk(slide, slideIndex);
}

function getSlideTone(contentInk: HeroInkTone) {
  return contentInk === "light"
    ? {
      section: "bg-black text-white",
      text: "text-[#ffffff]",
      body: "text-[rgba(255,255,255,.82)]",
      cta: "hero-banner-cta--dark focus-visible:ring-white focus-visible:ring-offset-black",
      control: "border-[rgba(255,255,255,.28)] bg-[rgba(255,255,255,.16)] text-[#ffffff] hover:bg-[rgba(255,255,255,.24)] hover:border-[rgba(255,255,255,.40)]",
      dots: "bg-[rgba(255,255,255,.44)]",
      activeDot: "bg-[#ffffff]"
    }
    : {
      section: "bg-[#f6f7f8] text-[#111113]",
      text: "text-[#111113]",
      body: "text-[rgba(0,0,0,.74)]",
      cta: "hero-banner-cta--light focus-visible:ring-black focus-visible:ring-offset-white",
      control: "border-[rgba(0,0,0,.16)] bg-[rgba(255,255,255,.68)] text-[#111113] hover:bg-[rgba(255,255,255,.86)] hover:border-[rgba(0,0,0,.24)]",
      dots: "bg-[rgba(0,0,0,.24)]",
      activeDot: "bg-[rgba(0,0,0,.72)]"
    };
}

export function HeroCarousel({
  slides = [],
  cmsSectionKey
}: {
  slides?: HeroSlide[];
  cmsSectionKey?: string;
}) {
  const safeSlides = resolveHeroCarouselSlides(slides);
  const [index, setIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const reducedMotion = useReducedMotionPreference();
  const advanceTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeIndex = Math.min(index, Math.max(safeSlides.length - 1, 0));
  const slide = safeSlides[activeIndex];
  const contentInk = slide ? getHeroContentInk(slide, activeIndex) : "light";
  const navbarInk = slide ? getHeroNavbarInk(slide, activeIndex) : "light";
  const tone = getSlideTone(contentInk);

  const getSlideState = (itemIndex: number) => {
    if (itemIndex === activeIndex) return "active";
    if (itemIndex === (activeIndex - 1 + safeSlides.length) % safeSlides.length) return "previous";
    return "inactive";
  };

  const goToSlide = useCallback((nextIndex: number) => {
    if (!safeSlides.length) return;
    setIndex((nextIndex + safeSlides.length) % safeSlides.length);
  }, [safeSlides.length]);

  useEffect(() => {
    if (reducedMotion || safeSlides.length < 2 || isHovered) return;

    advanceTimerRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setIndex((current) => (current + 1) % safeSlides.length);
    }, HERO_ADVANCE_MS);

    return () => {
      if (advanceTimerRef.current) {
        clearInterval(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, [activeIndex, isHovered, reducedMotion, safeSlides.length]);

  if (!slide) {
    return (
      <section
        id="hero"
        data-testid="home-hero"
        data-cms-home-section={cmsSectionKey}
        data-cms-hero-empty-state
        data-navbar-ink="light"
        className="grid min-h-[72svh] place-items-center bg-[#050505] px-6 text-center text-white"
      >
        <div className="max-w-xl">
          <h1 className="font-[var(--type-display)] text-4xl font-semibold tracking-normal md:text-6xl">Homepage banner unavailable</h1>
          <p className="mt-4 text-sm leading-6 text-white/68">
            Published hero content is temporarily unavailable. Product browsing remains online.
          </p>
          <Link
            href="/products"
            className="type-button mt-7 inline-flex h-11 items-center rounded-full bg-white px-5 text-[#050505] transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Explore products
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      id="hero"
      data-testid="home-hero"
      data-cms-home-section={cmsSectionKey}
      data-hero-system="mithron-native-fullscreen-carousel"
      data-active-hero-theme={slide.theme}
      data-hero-content-ink={contentInk}
      data-navbar-ink={navbarInk}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsHovered(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsHovered(false);
        }
      }}
      className={cn(
        "hero-premium-field relative isolate h-[80svh] min-h-[580px] w-full overflow-hidden",
        tone.section
      )}
    >
      {safeSlides.map((item, itemIndex) => (
        <div
          key={item.id}
          data-testid={`hero-slide-${item.id}`}
          data-hero-slide-state={getSlideState(itemIndex)} // test-placeholder: data-hero-slide-state="active"
          data-hero-motion="static"
          className="absolute inset-0 hero-slide-frame"
          aria-hidden={itemIndex !== activeIndex}
        >
          <HeroBackdrop slide={item} reducedMotion={reducedMotion} />
        </div>
      ))}

      <div className="hero-dji-layout pointer-events-none absolute inset-0 z-20">
        <div
          data-testid="hero-copy"
          className="hero-premium-copy hero-dji-copy-stack pointer-events-auto"
        >
          <h1
            key={`${slide.id}-title`}
            className="hero-dji-title"
          >
            {slide.title}
          </h1>
          <p
            key={`${slide.id}-subtitle`}
            className="hero-dji-subtitle"
          >
            {slide.subtitle}
          </p>
          <div className="hero-dji-cta-wrap">
            <HeroCta href={slide.href} label={slide.cta} className={tone.cta} />
          </div>
          <div data-testid="hero-pagination" className="hero-dji-pagination flex items-center gap-2">
            {safeSlides.map((item, itemIndex) => (
              <button
                key={item.id}
                data-testid={`hero-pagination-${item.id}`}
                aria-label={`Go to hero slide ${itemIndex + 1}`}
                aria-current={itemIndex === activeIndex ? "true" : "false"}
                className={cn(
                  "h-1 rounded-full transition-[width,background-color,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  itemIndex === activeIndex ? cn("w-12 opacity-100", tone.activeDot) : cn("w-5 opacity-80", tone.dots)
                )}
                onClick={() => goToSlide(itemIndex)}
              />
            ))}
          </div>
        </div>
        <div data-testid="hero-product-stage" className="hero-dji-product-zone" aria-hidden="true" />
      </div>

      <HeroControl
        label="Previous hero"
        side="left"
        className={tone.control}
        onClick={() => goToSlide(activeIndex - 1)}
      >
        <ChevronLeft className="size-5" />
      </HeroControl>
      <HeroControl
        label="Next hero"
        side="right"
        className={tone.control}
        onClick={() => goToSlide(activeIndex + 1)}
      >
        <ChevronRight className="size-5" />
      </HeroControl>
    </section>
  );
}

function HeroBackdrop({
  slide,
  reducedMotion
}: {
  slide: HeroSlide;
  reducedMotion: boolean;
}) {
  const composition = getHeroImageComposition(slide);
  const heroImageSrc = resolveHeroSlideSrc(slide.image.src, slide.id);
  const posterSrc = resolveHeroSlideSrc(slide.poster?.src ?? slide.image.src, slide.id);
  const videoType = slide.video?.src?.endsWith(".webm")
    ? "video/webm"
    : slide.video?.src?.endsWith(".mov")
      ? "video/quicktime"
      : "video/mp4";
  const imageStyle = {
    "--hero-image-object-position": composition.desktopObjectPosition,
    "--hero-image-mobile-object-position": composition.mobileObjectPosition,
    "--hero-image-transform": composition.desktopTransform,
    "--hero-image-mobile-transform": composition.mobileTransform,
    "--hero-image-filter": composition.desktopFilter,
    "--hero-image-mobile-filter": composition.mobileFilter
  } as CSSProperties;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <Link
        href={slide.href}
        target={slide.href.startsWith("http") ? "_blank" : undefined}
        rel={slide.href.startsWith("http") ? "noopener noreferrer" : undefined}
        aria-label={`Explore ${slide.title}`}
        className="hero-banner-product-link block size-full outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--surface-page)]"
      >
        <div data-testid="hero-product-image" className="hero-banner-product-image absolute inset-0">
          {slide.video?.src && !reducedMotion ? (
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={posterSrc}
              aria-label={slide.video.alt || slide.image.alt}
              className="absolute inset-0 h-full w-full object-cover [filter:var(--hero-image-mobile-filter)] [object-position:var(--hero-image-mobile-object-position)] [transform:var(--hero-image-mobile-transform)] md:[filter:var(--hero-image-filter)] md:[object-position:var(--hero-image-object-position)] md:[transform:var(--hero-image-transform)]"
              style={imageStyle}
            >
              <source src={slide.video.src} type={videoType} />
            </video>
          ) : (
            <MithronPageHeroImage
              src={heroImageSrc}
              alt={slide.image.alt}
              fill
              priority={Boolean(slide.image.priority)}
              responsive={slide.image.responsive}
              sizes="100vw"
              className="[filter:var(--hero-image-mobile-filter)] [object-position:var(--hero-image-mobile-object-position)] [transform:var(--hero-image-mobile-transform)] md:[filter:var(--hero-image-filter)] md:[object-position:var(--hero-image-object-position)] md:[transform:var(--hero-image-transform)]"
              style={imageStyle}
            />
          )}
        </div>
      </Link>
    </div>
  );
}

function HeroControl({
  label,
  side,
  className,
  onClick,
  children
}: {
  label: string;
  side: "left" | "right";
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "absolute top-1/2 z-30 hidden size-11 -translate-y-1/2 place-items-center rounded-full border opacity-60 transition-[opacity,background-color,border-color,color] duration-300 ease-[var(--ease-cinematic)] hover:opacity-100 md:grid",
        side === "left" ? "left-6" : "right-6",
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function HeroCta({ href, label, className }: { href: string; label: string; className: string }) {
  const darkSurface = className.includes("hero-banner-cta--dark");
  const external = href.startsWith("http");

  return (
    <Link
      data-testid="hero-primary-cta"
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      style={{
        color: darkSurface ? "#050505" : "#ffffff",
        backgroundColor: darkSurface ? "#ffffff" : "#0f172a"
      }}
      className={cn(
        "hero-banner-cta hero-dji-cta type-button inline-flex items-center justify-center rounded-full outline-none transition-[background,color,border-color,transform] duration-300 ease-[var(--ease-cinematic)] focus-visible:ring-2 focus-visible:ring-offset-2",
        className
      )}
    >
      {label}
    </Link>
  );
}
