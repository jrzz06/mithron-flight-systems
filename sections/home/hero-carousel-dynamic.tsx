import dynamic from "next/dynamic";
import type { HeroSlide } from "@/config/types";

export function HeroCarouselSkeleton() {
  return (
    <section
      id="hero"
      data-testid="home-hero"
      data-hero-skeleton
      data-navbar-ink="light"
      className="hero-premium-field relative isolate h-[80svh] min-h-[580px] w-full overflow-hidden bg-[#050505]"
      aria-busy="true"
      aria-label="Loading hero carousel"
    />
  );
}

const HeroCarouselClient = dynamic(
  () => import("@/sections/home/hero-carousel").then((mod) => ({ default: mod.HeroCarousel })),
  { loading: () => <HeroCarouselSkeleton /> }
);

export function HeroCarouselDynamic({
  slides,
  cmsSectionKey
}: {
  slides?: HeroSlide[];
  cmsSectionKey?: string;
}) {
  return <HeroCarouselClient slides={slides} cmsSectionKey={cmsSectionKey} />;
}
