import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("mobile catalog grid layout", () => {
  it("uses load-more batching for continued catalog grids", () => {
    const gridSource = source("sections/catalog/catalog-continued-grid.tsx");
    const globalsCss = source("app/globals.css");

    expect(gridSource).toContain("INITIAL_BATCH = 8");
    expect(gridSource).toContain("BATCH_SIZE = 8");
    expect(gridSource).toContain("Load more products");
    expect(gridSource).not.toContain("useWindowVirtualizer");
    expect(globalsCss).toContain("[data-catalog-continued-grid]");
    expect(globalsCss).toContain(".catalog-continued-grid__rows");
    expect(globalsCss).toContain(".catalog-continued-grid__load-more");
  });

  it("keeps equal-height catalog grids on phone", () => {
    const globalsCss = source("app/globals.css");
    const showroomCss = source("sections/catalog/catalog-page.module.css");

    expect(globalsCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.catalog-product-grid[\s\S]*align-items:\s*stretch/
    );
    expect(globalsCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.catalog-page-shell \.premium-product-card-shell[\s\S]*height:\s*100%/
    );
    expect(showroomCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.productGrid[\s\S]*align-items:\s*stretch/
    );
    expect(showroomCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.footer[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/
    );
  });

  it("uses consistent mobile catalog padding", () => {
    const globalsCss = source("app/globals.css");
    expect(globalsCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.catalog-grid-section[\s\S]*padding-inline:\s*var\(--mobile-page-inline,\s*12px\) !important/
    );
  });

  it("keeps featured editorial CTA visible on phone", () => {
    const globalsCss = source("app/globals.css");
    expect(globalsCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.catalog-editorial-band[\s\S]*overflow:\s*visible/
    );
    expect(globalsCss).toMatch(
      /@media \(max-width: 640px\)[\s\S]*\.catalog-editorial-band__cta[\s\S]*flex-shrink:\s*0/
    );
  });
});
