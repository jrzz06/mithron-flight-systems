import { describe, expect, it } from "vitest";
import {
  getFeaturedFromCatalogIndex,
  searchCatalogIndex,
  type CatalogSearchIndexEntry
} from "@/lib/catalog-search-index";

function entry(partial: Partial<CatalogSearchIndexEntry> & Pick<CatalogSearchIndexEntry, "slug" | "name">): CatalogSearchIndexEntry {
  return {
    slug: partial.slug,
    name: partial.name,
    tagline: partial.tagline ?? "",
    price: partial.price ?? 1000,
    category: partial.category ?? "Agri Drones",
    image: partial.image ?? { src: "/media/example.png", alt: partial.name },
    searchText: partial.searchText ?? `${partial.name} ${partial.slug}`.toLowerCase(),
    sortOrder: partial.sortOrder ?? 10,
    badge: partial.badge
  };
}

describe("catalog search index", () => {
  const index: CatalogSearchIndexEntry[] = [
    entry({ slug: "pixy-lr", name: "Pixy LR", tagline: "Long range mapping drone", searchText: "pixy lr long range mapping drone" }),
    entry({ slug: "source-a10e-agri-drone-10-liters-base", name: "A10E Agri Drone 10 Liters Base", category: "Agri Drones", searchText: "a10e agri drone 10 liters base agriculture" }),
    entry({ slug: "source-drone-battery", name: "Drone Battery Pack", category: "Accessories", searchText: "drone battery pack accessories" })
  ];

  it("returns empty results for blank query", () => {
    expect(searchCatalogIndex(index, "", 24)).toEqual([]);
  });

  it("matches exact and partial product names", () => {
    const results = searchCatalogIndex(index, "pixy", 24);
    expect(results.map((product) => product.slug)).toEqual(["pixy-lr"]);
  });

  it("matches multi-token queries across search text", () => {
    const results = searchCatalogIndex(index, "agri drone", 24);
    expect(results[0]?.slug).toBe("source-a10e-agri-drone-10-liters-base");
  });

  it("limits result count", () => {
    const results = searchCatalogIndex(index, "drone", 1);
    expect(results).toHaveLength(1);
  });

  it("returns no results for single-character queries", () => {
    expect(searchCatalogIndex(index, "d", 24)).toEqual([]);
    expect(searchCatalogIndex(index, "p", 24)).toEqual([]);
  });

  it("returns no results when query tokens do not all match", () => {
    expect(searchCatalogIndex(index, "pixy agriculture", 24)).toEqual([]);
    expect(searchCatalogIndex(index, "random nonsense", 24)).toEqual([]);
  });

  it("does not match unrelated description-only keywords", () => {
    const looseIndex = [
      entry({
        slug: "unrelated-product",
        name: "Industrial Gimbal",
        tagline: "Precision stabilization",
        category: "Accessories",
        searchText: "industrial gimbal precision stabilization accessories"
      })
    ];
    expect(searchCatalogIndex(looseIndex, "surveillance", 24)).toEqual([]);
  });

  it("returns featured badge products first", () => {
    const featuredIndex = [
      entry({ slug: "plain", name: "Plain Drone", sortOrder: 1 }),
      entry({ slug: "featured", name: "Featured Drone", badge: "New Stock", sortOrder: 99 })
    ];
    const featured = getFeaturedFromCatalogIndex(featuredIndex, 4);
    expect(featured[0]?.slug).toBe("featured");
  });
});
