import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("hero carousel premium composition", () => {
  it("keeps the home hero on the approved premium composition contract", () => {
    const hero = source("sections/home/hero-carousel.tsx");
    const globals = source("app/globals.css");

    expect(hero).toContain("const heroImageComposition");
    expect(hero).toContain("function getHeroImageComposition");
    expect(hero).toContain("function getHeroContentInk");
    expect(hero).toContain("heroTextInkBySlide");
    expect(hero).toContain("function getHeroNavbarInk");
    expect(hero).toContain('"mapping-flight": "light"');
    expect(hero).toContain('"drone-ecosystem": "light"');
    expect(hero).toContain('.filter((slide) => slide.id !== "surveillance-grid")');
    expect(hero).toContain(".slice(0, 3)");
    expect(hero).toContain("useReducedMotionPreference");
    expect(hero).toContain('data-hero-system="mithron-native-fullscreen-carousel"');
    expect(hero).toContain('sizes="100vw"');
    expect(hero).toContain("MithronPageHeroImage");
    expect(hero).not.toContain("will-change-transform");
    expect(hero).not.toContain("usePremiumPointerField");
    expect(hero).toContain("HeroControl");
    expect(hero).toContain("HeroCta");
    expect(hero).toContain("heroSlideCopyById");
    expect(hero).toContain('data-testid="hero-pagination"');

    expect(globals).toContain(".hero-dji-title");
    expect(globals).toContain(".hero-dji-subtitle");
    expect(globals).toContain("max-width: 520px");
    expect(globals).toContain("max-width: 580px");
    expect(globals).toContain("line-height: 1.62");
    expect(globals).toContain("letter-spacing: -0.025em");
    expect(globals).toContain("letter-spacing: -0.35px");
    expect(globals).toContain("margin-top: clamp(64px, 6vw, 72px)");
    expect(globals).toContain("animation: none");
    expect(globals).toContain(".hero-banner-product-image :is(img, video)");
    expect(globals).toContain("object-position: var(--hero-image-object-position, center center)");
  });

  it("uses a CSS opacity crossfade carousel contract", () => {
    const hero = source("sections/home/hero-carousel.tsx");
    const globals = source("app/globals.css");

    expect(hero).not.toContain("framer-motion");
    expect(hero).not.toContain("AnimatePresence");
    expect(hero).not.toContain("<motion.div");
    expect(hero).toContain("key={item.id}");
    expect(hero).toContain('className="absolute inset-0 hero-slide-frame"');
    expect(hero).toContain('data-hero-motion="static"');
    expect(hero).not.toContain("scheduleNextAdvance");
    expect(hero).not.toContain("autoplayMs");
    expect(hero).toContain("goToSlide");
    expect(hero).toContain("safeSlides.map");
    expect(hero).toContain('label="Previous hero"');
    expect(hero).toContain('label="Next hero"');
    expect(hero).toContain('"--hero-image-object-position": composition.desktopObjectPosition');
    expect(hero).not.toContain("previousIndex");
    expect(hero).not.toContain("stagger: 0.085");

    expect(globals).toContain("--font-display: var(--font-system)");
    expect(globals).toContain("--font-body: var(--font-system)");
    expect(globals).toContain(".hero-banner-product-image :is(img, video)");
    expect(globals).not.toContain("@keyframes heroSlideCrossfade");
    expect(globals).toContain("object-fit: cover");
    expect(globals).toContain("object-position: var(--hero-image-object-position, center center)");
  });

  it("uses DJI-like storefront hero sizing without full-viewport lock", () => {
    const hero = source("sections/home/hero-carousel.tsx");
    const globals = source("app/globals.css");
    const layout = source("app/layout.tsx");
    const nav = source("components/navigation/store-nav.tsx");

    expect(existsSync(join(process.cwd(), "app/storefront-showcase.css"))).toBe(false);
    expect(existsSync(join(process.cwd(), "app/ecosystem-showcase.css"))).toBe(false);

    expect(hero).toContain("hero-premium-field relative isolate h-[80svh] min-h-[580px] w-full overflow-hidden");
    expect(hero).toContain("hero-dji-layout");
    expect(hero).toContain("hero-dji-title");
    expect(hero).toContain("hero-dji-subtitle");
    expect(hero).toContain("hero-dji-pagination");

    expect(globals).toMatch(/\.hero-premium-field\s*{[^}]*height:\s*80vh[^}]*height:\s*80svh[^}]*min-height:\s*580px/s);
    expect(globals).not.toMatch(/\.hero-premium-field\s*{[^}]*height:\s*100svh/s);
    expect(globals).not.toMatch(/\.hero-premium-field\s*{[^}]*min-height:\s*100svh/s);
    expect(globals).toContain("margin-bottom: 0");
    expect(globals).toContain("object-fit: cover");
    expect(globals).toContain("width: clamp(520px, 34vw, 580px)");
    expect(globals).toContain("font-weight: 600");
    expect(globals).toContain("letter-spacing: var(--tracking-tighter)");
    expect(globals).toContain("white-space: nowrap");
    expect(globals).toContain("margin-top: clamp(64px, 6vw, 72px)");

    expect(layout).toContain("Inter");
    expect(layout).toContain("--font-inter");
    expect(layout).not.toContain("Manrope");
    expect(layout).not.toContain("Montserrat");

    expect(nav).toContain("adaptive-navbar absolute left-0 top-0 z-[999] w-full");
    expect(nav).toContain('position: "absolute"');
  });
});
