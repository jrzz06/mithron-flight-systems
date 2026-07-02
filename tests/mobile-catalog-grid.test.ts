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

  it("keeps 2-column catalog grids and stacked footers on phone", () => {
    const globalsCss = source("app/globals.css");
    const showroomCss = source("sections/catalog/catalog-page.module.css");

    expect(globalsCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.catalog-product-grid[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(globalsCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.catalog-page-shell \.premium-product-card__footer[\s\S]*flex-direction:\s*column/
    );
    expect(showroomCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.productGrid[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
    );
    expect(showroomCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.footer[\s\S]*flex-direction:\s*column/
    );
    expect(showroomCss).toMatch(
      /@media \(max-width: 767px\)[\s\S]*\.price[\s\S]*white-space:\s*nowrap/
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
