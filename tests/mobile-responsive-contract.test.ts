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

  it("keeps catalog continued grid on 2 or 4 columns", () => {
    const gridSource = source("sections/catalog/catalog-continued-grid.tsx");
    const globalsCss = source("app/globals.css");

    expect(gridSource).not.toContain("return 3");
    expect(gridSource).toContain("if (width < 1024) return 2");
    expect(gridSource).toContain("return 4");
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

  it("clips catalog overflow and uses stacked catalog footers on phone", () => {
    const globalsCss = source("app/globals.css");
    const phoneBlock = globalsCss.match(/@media \(max-width: 767px\)[\s\S]*?(?=@media)/);

    expect(phoneBlock?.[0]).toContain("overflow-x: clip");
    expect(phoneBlock?.[0]).toContain(".catalog-page-shell .premium-product-card__footer");
    expect(phoneBlock?.[0]).toContain("flex-direction: column");
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

  it("locks catalog grids to 2 columns below 1024px and 4 columns on desktop", () => {
    const globalsCss = source("app/globals.css");
    const showroomCss = source("sections/catalog/catalog-page.module.css");
    const catalogGridBlock = globalsCss.match(
      /\.catalog-product-grid \{[\s\S]*?\.catalog-product-grid--continued/
    )?.[0];

    expect(globalsCss).toMatch(
      /\.catalog-product-grid[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(globalsCss).toMatch(
      /@media \(min-width: 1024px\)[\s\S]*\.catalog-product-grid[\s\S]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(globalsCss).toMatch(
      /\.catalog-continued-grid__rows[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(globalsCss).toMatch(
      /@media \(min-width: 1024px\)[\s\S]*\.catalog-continued-grid__rows[\s\S]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(showroomCss).toMatch(
      /\.productGrid[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(showroomCss).toMatch(
      /@media \(min-width: 1024px\)[\s\S]*\.productGrid[\s\S]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(catalogGridBlock).not.toMatch(/repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(catalogGridBlock).not.toMatch(/auto-fill/);
  });

  it("keeps catalog prices on one horizontal line", () => {
    const globalsCss = source("app/globals.css");
    const cardCss = source("components/cards/product-hover-card.module.css");

    expect(globalsCss).toMatch(
      /\.catalog-page-shell \.premium-product-card__price \{[\s\S]*white-space:\s*nowrap/
    );
    expect(cardCss).toMatch(/\.price \{[\s\S]*white-space:\s*nowrap/);
    expect(cardCss).toMatch(/\.price \{[\s\S]*flex-shrink:\s*0/);
    expect(cardCss).toMatch(/\.cta \{[\s\S]*width:\s*100%/);
  });

  it("uses auto row sizing on desktop catalog grids", () => {
    const globalsCss = source("app/globals.css");
    const showroomCss = source("sections/catalog/catalog-page.module.css");
    const cardCss = source("components/cards/product-hover-card.module.css");

    expect(globalsCss).toMatch(/\.catalog-product-grid[\s\S]*?grid-auto-rows:\s*auto/);
    expect(globalsCss).toMatch(/\.catalog-continued-grid__rows[\s\S]*?grid-auto-rows:\s*auto/);
    expect(showroomCss).toMatch(/\.productGrid[\s\S]*?grid-auto-rows:\s*auto/);
    expect(globalsCss).toMatch(
      /\.catalog-page-shell \.premium-product-card__description \{[\s\S]*?flex:\s*0\s+1\s+auto/
    );
    expect(cardCss).toMatch(/\.description \{[\s\S]*?flex:\s*0\s+1\s+auto/);
  });

  it("disables catalog product image stage overlay", () => {
    const globalsCss = source("app/globals.css");
    const cardCss = source("components/cards/product-hover-card.module.css");
    const showroomCss = source("sections/catalog/catalog-page.module.css");

    expect(globalsCss).toMatch(
      /\.catalog-page-shell \.premium-product-card__media::after[\s\S]*display:\s*none/
    );
    expect(cardCss).toMatch(
      /:global\(\.catalog-page-shell\) \.media::after[\s\S]*display:\s*none/
    );
    expect(showroomCss).toMatch(
      /\.shell \[data-card-variant="catalog"\] a > div::after[\s\S]*display:\s*none/
    );
  });
});
