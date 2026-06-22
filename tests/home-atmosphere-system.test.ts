import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("home landing composite visual system", () => {
  it("uses the Mithron white/off-white storefront rhythm with scoped styles", () => {
    const component = source("sections/home/home-landing-composite.tsx");
    const css = source("sections/home/home-landing-composite.module.css");
    const globals = source("app/globals.css");

    expect(component).toContain('data-testid="home-mini-carousel"');
    expect(component).toContain('data-testid="home-mini-carousel-rail"');
    expect(component).toContain("pickMiniCarouselItems");
    expect(component).not.toContain("Mithron operating ecosystem");
    expect(component).not.toContain("one guided journey");
    expect(component).toContain("localMedia");
    expect(source("config/storefront-media-paths.ts")).toContain("night-surveillance.webp");
    expect(source("config/homepage-media-fallbacks.ts")).toContain("Supabase-backed surveillance mission media");
    expect(css).toContain("--home-page: var(--surface-page)");
    expect(css).toContain("--home-card: #ffffff");
    expect(css).toContain("linear-gradient(180deg, #ffffff 0%, var(--home-page)");
    expect(css).toContain("border: 1px solid var(--home-border)");
    expect(css).not.toMatch(/aurora|neon|text-shadow|filter:\s*drop-shadow|glow/i);
    expect(component).not.toContain("data-atmosphere-system");
    expect(component).not.toContain("--sf-atmo");
    expect(globals).not.toContain("@import \"./storefront-showcase.css\"");
  });

  it("keeps typography and product-card motion restrained", () => {
    const css = source("sections/home/home-landing-composite.module.css");

    expect(css).toContain("font-family: var(--type-display)");
    expect(css).toContain("font-family: var(--type-ui)");
    expect(css).toContain("letter-spacing: 0");
    expect(css).toContain(".productCard:hover .productImage");
    expect(css).toContain("scale(1.024)");
    expect(css).not.toContain("scale(1.08)");
    expect(css).not.toMatch(/rotateX|rotateY|translateY\(-12px\)|backdrop-filter:\s*blur\(20px\)/);
  });
});
