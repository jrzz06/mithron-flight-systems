import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BATCH_SIZE,
  getVisibleProducts,
  INITIAL_BATCH,
  resolveColumnCount
} from "@/sections/catalog/catalog-continued-grid";
import type { Product } from "@/config/types";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function product(slug: string): Product {
  return {
    slug,
    productUrl: `/product/${slug}`,
    name: slug,
    tagline: "test",
    category: "Agri Drones",
    price: 100,
    image: { src: "/test.webp", alt: slug, width: 100, height: 100 },
    hero: { src: "/test.webp", alt: slug, width: 100, height: 100 },
    gallery: [],
    interests: [],
    specs: {},
    variants: [],
    bundles: [],
    hotspots: [],
    story: [],
    anchors: [],
    workflowStatus: "published",
    isVisible: true
  };
}

describe("catalog continued grid", () => {
  it("reveals products in batches", () => {
    const items = Array.from({ length: 20 }, (_, index) => product(`item-${index}`));

    expect(getVisibleProducts(items, INITIAL_BATCH)).toHaveLength(8);
    expect(getVisibleProducts(items, INITIAL_BATCH + BATCH_SIZE)).toHaveLength(16);
    expect(getVisibleProducts(items, 100)).toHaveLength(20);
  });

  it("uses responsive column breakpoints", () => {
    expect(resolveColumnCount(375)).toBe(2);
    expect(resolveColumnCount(767)).toBe(2);
    expect(resolveColumnCount(900)).toBe(3);
    expect(resolveColumnCount(1280)).toBe(4);
  });

  it("renders a load-more grid without window virtualization", () => {
    const gridSource = source("sections/catalog/catalog-continued-grid.tsx");
    const pageSource = source("sections/catalog/catalog-page.tsx");

    expect(gridSource).toContain("INITIAL_BATCH = 8");
    expect(gridSource).toContain("BATCH_SIZE = 8");
    expect(gridSource).toContain("Load more products");
    expect(gridSource).toContain('data-testid="catalog-load-more"');
    expect(gridSource).toContain("catalog-continued-grid__rows");
    expect(gridSource).not.toContain("useWindowVirtualizer");
    expect(pageSource).toContain("CatalogContinuedGrid");
    expect(pageSource).not.toContain("CatalogVirtualizedGrid");
  });
});
