import { Suspense } from "react";
import { HomeBelowHero } from "@/sections/home/home-below-hero";
import { HomeHeroFallback, HomeHeroSection } from "@/sections/home/home-hero-section";

// ISR: 60-second fallback TTL. CMS publish actions call revalidatePath("/")
// + revalidateTag("cms","max") to bust both the page cache and Data Cache
// immediately, so live changes appear on the next request after publish.
export const revalidate = 60;

function HomeBelowHeroFallback() {
  return <div className="min-h-[40vh] animate-pulse bg-[#eef0f3]" aria-hidden="true" />;
}

export default function HomePage() {
  return (
    <>
      <Suspense fallback={<HomeHeroFallback />}>
        <HomeHeroSection />
      </Suspense>
      <Suspense fallback={<HomeBelowHeroFallback />}>
        <HomeBelowHero />
      </Suspense>
    </>
  );
}
