import { describe, expect, it } from "vitest";
import { extractRichProductContent } from "@/lib/wix/catalog-rich";
import { buildSafeMigrationPatch, auditProductMigration } from "@/lib/product-migration/field-audit";

describe("wix rich catalog extraction", () => {
  it("parses info sections into specs, features, and downloads", () => {
    const rich = extractRichProductContent(
      {
        infoSections: [
          {
            id: "specs",
            uniqueName: "specs",
            title: "Technical Specifications",
            plainDescription: "<table><tr><td>Flight Time</td><td>45 min</td></tr><tr><td>Range</td><td>15 km</td></tr></table>"
          },
          {
            id: "features",
            uniqueName: "features",
            title: "Features",
            plainDescription: "<ul><li>RTK positioning</li><li>Foldable arms</li></ul>"
          },
          {
            id: "downloads",
            uniqueName: "downloads",
            title: "Downloads",
            plainDescription: '<a href="https://example.com/manual.pdf">Product Manual</a>'
          }
        ]
      },
      "Agri Drones",
      ["https://static.wixstatic.com/media/hero.png"]
    );

    expect(rich.specs["Flight Time"]).toBe("45 min");
    expect(rich.features).toEqual(["RTK positioning", "Foldable arms"]);
    expect(rich.document_urls[0]).toMatchObject({
      url: "https://example.com/manual.pdf",
      label: "Product Manual"
    });
  });
});

describe("safe migration patch", () => {
  it("fills only missing fields from Wix without overwriting valid Mithron data", () => {
    const wix = {
      wix_product_id: "p1",
      wix_slug: "test-drone",
      name: "Test Drone",
      price: 100000,
      compare_at: null,
      description_plain: "Long plain description from Wix with enough detail for procurement teams.",
      source_url: "https://www.mithron.co/product-page/test-drone",
      source_catalog_id: "mithron-test-drone",
      source_fingerprint: "testdrone",
      category: "Agri Drones",
      media_urls: ["https://static.wixstatic.com/media/a.png", "https://static.wixstatic.com/media/b.png"],
      visible: true,
      updated_at: "2026-06-24T00:00:00.000Z",
      rich: extractRichProductContent(
        {
          plainDescription: "Long plain description from Wix with enough detail for procurement teams.",
          infoSections: [{
            id: "specs",
            title: "Specifications",
            plainDescription: "<table><tr><td>Weight</td><td>2.1 kg</td></tr></table>"
          }]
        },
        "Agri Drones",
        ["https://static.wixstatic.com/media/a.png", "https://static.wixstatic.com/media/b.png"]
      )
    };

    const row = {
      slug: "test-drone",
      name: "Test Drone",
      description: "<p>Existing Mithron HTML description that should remain untouched.</p>",
      source_description: "Existing source description",
      specs: { "Flight Time": "30 min" },
      image: { src: "https://project.supabase.co/storage/v1/object/public/mithron-products/test.png" },
      gallery: [],
      story: [],
      bundles: [],
      variants: []
    };

    const patch = buildSafeMigrationPatch(row, wix);
    expect(patch.description).toBeUndefined();
    expect(patch.source_description).toBeUndefined();
    expect(patch.specs).toMatchObject({ "Flight Time": "30 min", Weight: "2.1 kg" });
    expect(patch.gallery).toHaveLength(1);

    const audit = auditProductMigration(row, wix);
    expect(audit.matched).toBe(true);
    expect(audit.completeness_score).toBeGreaterThan(40);
  });
});
