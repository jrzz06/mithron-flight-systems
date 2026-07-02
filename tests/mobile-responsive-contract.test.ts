import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("mobile responsive contract (phone <=767px)", () => {
  it("uses a 2-column in-flow shelf grid on phone without horizontal scroll", () => {
    const css = source("sections/home/home-landing-composite.module.css");
    const phoneShelfBlock = css.match(/@media \(max-width: 767px\)[\s\S]*?\.productShelfGrid \{[\s\S]*?\}/);

    expect(phoneShelfBlock?.[0]).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(phoneShelfBlock?.[0]).toContain("overflow-x: visible");
    expect(phoneShelfBlock?.[0]).not.toContain("overflow-x: auto");
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

  it("keeps catalog virtualized grid at 2 columns below 1024px", () => {
    const gridSource = source("sections/catalog/catalog-virtualized-grid.tsx");
    expect(gridSource).toContain("if (width < 1024) return 2");
    expect(gridSource).not.toContain("width < 360");
  });

  it("defines shared mobile spacing tokens", () => {
    const globalsCss = source("app/globals.css");
    expect(globalsCss).toContain("--mobile-card-gap: 10px");
    expect(globalsCss).toContain("--mobile-grid-gap: 10px");
  });
});
