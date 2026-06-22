import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("card elevation system", () => {
  it("defines shared elevation tokens and utility classes in globals.css", () => {
    const globals = source("app/globals.css");

    expect(globals).toContain("--elevation-card-rest:");
    expect(globals).toContain("--elevation-card-hover:");
    expect(globals).toContain("--elevation-card-lift:");
    expect(globals).toContain("--elevation-product-rest:");
    expect(globals).toContain("--elevation-product-hover:");
    expect(globals).toContain(".mithron-elevated-card {");
    expect(globals).toContain(".mithron-elevated-card--interactive:is(:hover, :focus-within, :focus-visible)");
    expect(globals).toContain("box-shadow: var(--elevation-card-rest)");
    expect(globals).toContain("box-shadow: var(--elevation-card-hover)");
    expect(globals).toContain("--platform-shadow-sm: var(--elevation-card-rest)");
    expect(globals).toContain("--platform-shadow-hover: var(--elevation-card-hover)");
  });

  it("wires catalog and home shelf cards to elevation tokens", () => {
    const globals = source("app/globals.css");

    expect(globals).toMatch(/\.catalog-page-shell \.premium-product-card-shell\s*{[\s\S]*box-shadow: var\(--elevation-product-rest\)/);
    expect(globals).toMatch(
      /\.catalog-page-shell \.premium-product-card-shell:is\(:hover, :focus-within, :focus-visible\)\s*{[\s\S]*box-shadow: var\(--elevation-product-hover\)/
    );
    expect(globals).toMatch(/\.home-shelf-card-link\s*{[\s\S]*box-shadow: var\(--elevation-card-rest\)/);
    expect(globals).toMatch(/\.home-shelf-card-link:hover[\s\S]*box-shadow: var\(--elevation-card-hover\)/);
  });

  it("removes inline tailwind shadows from product cards and platform primitives", () => {
    const productCard = source("components/cards/product-hover-card.tsx");
    const productCardCss = source("components/cards/product-hover-card.module.css");
    const metricCard = source("components/platform/metric-card.tsx");
    const surface = source("components/platform/surface.tsx");
    const dataTable = source("components/platform/data-table.tsx");
    const modulePanel = source("components/admin/module-panel.tsx");

    expect(productCard).not.toMatch(/shadow-\[/);
    expect(productCard).toContain("premium-product-card-shell");
    expect(productCardCss).toContain("--elevation-product-rest");
    expect(productCardCss).toContain("--elevation-product-hover");
    expect(metricCard).not.toContain("boxShadow");
    expect(metricCard).toContain("mithron-elevated-card");
    expect(surface).not.toContain("boxShadow");
    expect(surface).toContain("mithron-elevated-card");
    expect(dataTable).not.toContain("boxShadow");
    expect(dataTable).toContain("mithron-elevated-card");
    expect(modulePanel).not.toContain("boxShadow");
    expect(modulePanel).toContain("mithron-elevated-card");
  });

  it("adds interactive elevation to admin quick links and warehouse fulfillment stages", () => {
    const adminPage = source("app/admin/page.tsx");
    const fulfillmentPage = source("app/warehouse/fulfillment/page.tsx");

    expect(adminPage).toContain("mithron-elevated-card--interactive");
    expect(fulfillmentPage).toContain("mithron-elevated-card--interactive");
  });

  it("migrates homepage agri cards to elevation tokens", () => {
    const compositeCss = source("sections/home/home-landing-composite.module.css");

    expect(compositeCss).toMatch(/\.agriSection \.agriCard\s*{[\s\S]*box-shadow: var\(--elevation-card-rest\)/);
    expect(compositeCss).toMatch(
      /\.agriSection \.agriCard:hover[\s\S]*box-shadow: var\(--elevation-card-hover\)/
    );
    expect(compositeCss).toContain("transform: translateY(var(--elevation-card-lift))");
  });
});
