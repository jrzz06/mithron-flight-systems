import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("mobile responsive contract (phone <=767px)", () => {
  it("uses a horizontal snap carousel on phone shelves", () => {
    const css = source("sections/home/home-landing-composite.module.css");
    const globalsCss = source("app/globals.css");
    const phoneShelfBlock = css.match(/@media \(max-width: 767px\)[\s\S]*?\.productShelfGrid \{[\s\S]*?\}/);

    expect(phoneShelfBlock?.[0]).toContain("grid-auto-flow: column");
    expect(phoneShelfBlock?.[0]).toContain("overflow-x: auto");
    expect(phoneShelfBlock?.[0]).toContain("scroll-snap-type: x mandatory");
    expect(phoneShelfBlock?.[0]).toContain("var(--shelf-card-width)");
    expect(phoneShelfBlock?.[0]).not.toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(globalsCss).toMatch(/--shelf-cards-per-viewport:\s*2\.1/);
  });

  it("keeps tablet shelf horizontal scroll between 768px and 980px", () => {
    const css = source("sections/home/home-landing-composite.module.css");
    const tabletShelfBlock = css.match(/@media \(max-width: 980px\)[\s\S]*?\.productShelfGrid \{[\s\S]*?\}/);

    expect(tabletShelfBlock?.[0]).toContain("overflow-x: auto");
    expect(tabletShelfBlock?.[0]).toContain("touch-action: pan-x pan-y");
  });

  it("applies 44px touch targets to shelf Buy Now and catalog CTA at 767px", () => {
    const homeCss = source("sections/home/home-landing-composite.module.css");
    const globalsCss = source("app/globals.css");

    expect(homeCss).toMatch(/@media \(max-width: 767px\)[\s\S]*\.productBuyNow[\s\S]*min-height: var\(--mobile-touch-min/);
    expect(globalsCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.catalog-page-shell \.premium-product-card__cta-text[\s\S]*min-height: var\(--mobile-touch-min/
    );
  });

  it("keeps catalog continued grid at 2 columns below 768px and 3 below 1024px", () => {
    const gridSource = source("sections/catalog/catalog-continued-grid.tsx");
    const globalsCss = source("app/globals.css");

    expect(gridSource).toContain("if (width <= 767) return 2");
    expect(gridSource).toContain("if (width < 1024) return 3");
    expect(gridSource).toContain("Load more products");
    expect(gridSource).not.toContain("useWindowVirtualizer");
    expect(globalsCss).toContain(".catalog-continued-grid__rows");
  });

  it("defines shared mobile spacing tokens", () => {
    const globalsCss = source("app/globals.css");
    expect(globalsCss).toContain("--mobile-card-gap: 10px");
    expect(globalsCss).toContain("--mobile-grid-gap: 10px");
    expect(globalsCss).toContain("--shelf-card-width:");
    expect(globalsCss).toContain("--catalog-mobile-row-estimate: 280px");
  });

  it("clips catalog overflow and uses footer grid on phone", () => {
    const globalsCss = source("app/globals.css");
    const phoneBlock = globalsCss.match(/@media \(max-width: 767px\)[\s\S]*?(?=@media)/);

    expect(phoneBlock?.[0]).toContain("overflow-x: clip");
    expect(phoneBlock?.[0]).toContain(".catalog-page-shell .premium-product-card__footer");
    expect(phoneBlock?.[0]).toContain("grid-template-columns: auto minmax(0, 1fr)");
    expect(phoneBlock?.[0]).toContain("padding-inline: var(--mobile-page-inline, 12px) !important");
  });

  it("keeps mission support cards as overlay tiles on phone", () => {
    const css = source("sections/home/home-landing-composite.module.css");
    const phoneSupportBlock = css.match(
      /@media \(max-width: 767px\) \{\s*\.missionWorldSupportGrid \{[\s\S]*?\.testimonialsSection/
    );

    expect(phoneSupportBlock?.[0]).toContain("grid-template-columns: 1fr");
    expect(phoneSupportBlock?.[0]).not.toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(phoneSupportBlock?.[0]).toContain("aspect-ratio: 2 / 1");
    expect(phoneSupportBlock?.[0]).toContain("grid-auto-rows: auto");
    expect(phoneSupportBlock?.[0]).toMatch(
      /\.missionWorldSupportGrid > \.agriCard \.agriCardImage[\s\S]*object-fit: cover/
    );
    expect(phoneSupportBlock?.[0]).not.toContain("object-fit: contain");
  });

  it("uses narrower mobile shelf image sizes", () => {
    const component = source("sections/home/home-landing-composite.tsx");
    expect(component).toContain('sizes="(max-width: 767px) 48vw, (max-width: 1024px) 36vw, 270px"');
  });
});
