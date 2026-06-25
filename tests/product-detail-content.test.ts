import { describe, expect, it } from "vitest";
import type { Product } from "@/config/types";
import {
  getCustomerFacingSpecs,
  getHighlightSpecs,
  getProductOverviewHtml,
  getProductOverviewText,
  getStoryChapters
} from "@/lib/product-detail-content";

const baseProduct: Product = {
  slug: "demo-drone",
  productUrl: "/product/demo-drone",
  name: "Demo Drone",
  tagline: "Precision agriculture field system.",
  price: 1000,
  category: "Agri Drones",
  interests: ["agriculture"],
  image: { src: "/demo.png", alt: "Demo" },
  hero: { src: "/demo.png", alt: "Demo" },
  gallery: [],
  variants: [],
  bundles: [],
  story: [],
  specs: {
    Endurance: "28 min",
    Range: "1 km",
    Source: "hidden"
  },
  anchors: []
};

describe("product detail content", () => {
  it("surfaces customer-facing specs and highlight cards", () => {
    expect(getCustomerFacingSpecs(baseProduct).map(([key]) => key)).toEqual(["Endurance", "Range"]);
    expect(getHighlightSpecs(baseProduct)[0]).toEqual(["Endurance", "28 min"]);
  });

  it("prefers long seo copy for overview text", () => {
    const product = {
      ...baseProduct,
      seoDescription: "A long-form product overview with mission context and deployment guidance for operators."
    };
    expect(getProductOverviewText(product)).toContain("long-form product overview");
  });

  it("does not use sourceDescription as overview fallback", () => {
    const product = {
      ...baseProduct,
      sourceDescription: "Full Wix Studio product copy with deployment guidance for field operators."
    };
    expect(getProductOverviewText(product)).toBe("Precision agriculture field system.");
  });

  it("suppresses spec-only html descriptions in overview", () => {
    const product = {
      ...baseProduct,
      description:
        "<p>UAV Type: Hexacopter</p><p>UAV Category: Small</p><p>Endurance: 28 min</p><p>Range (LoS): 1 km</p>"
    };
    expect(getProductOverviewHtml(product)).toBeNull();
    expect(getProductOverviewText(product)).toBe("Precision agriculture field system.");
  });

  it("returns empty overview text for spec-only products without marketing copy", () => {
    const product = {
      ...baseProduct,
      tagline: "UAV Type: Hexacopter UAV Category: Small Endurance: 28 min Range (LoS): 1 km",
      description:
        "UAV Type: Hexacopter UAV Category: Small Endurance: 28 min Range (LoS): 1 km Maximum All-Up-Weight: 8.56 kg"
    };
    expect(getProductOverviewText(product)).toBe("");
  });

  it("can skip fallback story when overview is rendered separately", () => {
    expect(getStoryChapters(baseProduct, { includeFallback: false })).toEqual([]);
    expect(getStoryChapters(baseProduct, { includeFallback: true })).toHaveLength(1);
  });
});
