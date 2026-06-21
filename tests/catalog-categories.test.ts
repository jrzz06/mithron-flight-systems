import { describe, expect, it } from "vitest";
import {
  CATALOG_CATEGORY_SLUGS,
  filterProductsForCategorySlug,
  getCatalogCategoryDefinition,
  interestSlugToCategorySlug,
  resolveCategoryHrefForInterest
} from "@/lib/catalog-categories";
import { getProducts, getProductsForCategorySlug } from "@/services/catalog";

const hasLiveCatalog =
  process.env.RUN_LIVE_CATALOG_TESTS === "1" &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());

describe("catalog categories", () => {
  it("defines the seven storefront category slugs and routes", () => {
    expect(CATALOG_CATEGORY_SLUGS).toEqual([
      "agri-drones",
      "video-drones",
      "creative-drones",
      "survey-drones",
      "surveillance-drones",
      "accessories",
      "global-products"
    ]);

    expect(getCatalogCategoryDefinition("global-products").href).toBe("/category/global-products");
    expect(getCatalogCategoryDefinition("agri-drones").href).toBe("/category/agri-drones");
  });

  it("maps legacy interest slugs to canonical category pages", () => {
    expect(resolveCategoryHrefForInterest("agriculture")).toBe("/category/agri-drones");
    expect(resolveCategoryHrefForInterest("mapping")).toBe("/category/survey-drones");
    expect(resolveCategoryHrefForInterest("industrial-inspection")).toBe("/category/global-products");
    expect(resolveCategoryHrefForInterest("unknown-interest")).toBe("/interest/unknown-interest");
    expect(interestSlugToCategorySlug.components).toBe("accessories");
  });

  it.skipIf(!hasLiveCatalog)("loads published products for each category slug from the live catalog", async () => {
    const products = await getProducts();

    for (const slug of CATALOG_CATEGORY_SLUGS) {
      const categoryProducts = await getProductsForCategorySlug(slug);
      const filtered = filterProductsForCategorySlug(products, slug);
      expect(categoryProducts).toEqual(filtered);
      expect(categoryProducts.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(!hasLiveCatalog)("includes Global Products in the global-products category", async () => {
    const globalProducts = await getProductsForCategorySlug("global-products");
    expect(globalProducts.map((product) => product.slug)).toEqual(
      expect.arrayContaining(["zio", "pixy-mr", "pixy-lr"])
    );
  });
});
