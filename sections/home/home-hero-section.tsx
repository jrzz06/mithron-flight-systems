import { HeroCarouselDynamic, HeroCarouselSkeleton } from "@/sections/home/hero-carousel-dynamic";
import { getPublicHeroBanners } from "@/services/cms";

export async function HomeHeroSection() {
  const heroBanners = await getPublicHeroBanners();

  return <HeroCarouselDynamic slides={heroBanners} cmsSectionKey="hero" />;
}

export { HeroCarouselSkeleton as HomeHeroFallback };
