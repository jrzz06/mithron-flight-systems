import { describe, expect, it } from "vitest";
import { resolveCatalogCardImage } from "@/lib/media/catalog-card-image";

describe("resolveCatalogCardImage", () => {
  it("prefers responsive fallbackSrc for catalog cards", () => {
    const resolved = resolveCatalogCardImage({
      src: "https://example.supabase.co/storage/v1/object/public/mithron-products/ag10-lite-480w-v1.2427a172.webp",
      alt: "Agri Kisan Drone Small",
      responsive: {
        assetId: "demo",
        bucket: "mithron-products",
        assetRole: "product",
        category: "product",
        generatedPromptId: "demo",
        status: "generated",
        fallbackSrc: "https://example.supabase.co/storage/v1/object/public/mithron-products/catalog-cutouts/v1/agri-kisan.webp",
        fallbackAlt: "Agri Kisan Drone Small",
        width: 1200,
        height: 900,
        dominantColor: "#fff",
        variants: {
          webp: [
            {
              src: "https://example.supabase.co/storage/v1/object/public/mithron-products/ag10-lite-480w-v1.2427a172.webp",
              width: 480,
              height: 360,
              format: "webp"
            }
          ]
        }
      }
    });

    expect(resolved.src).toContain("catalog-cutouts/v1/agri-kisan.webp");
    expect(resolved.alt).toBe("Agri Kisan Drone Small");
  });

  it("keeps src when no supabase fallback exists", () => {
    const src = "https://example.supabase.co/storage/v1/object/public/mithron-products/demo.webp";
    const resolved = resolveCatalogCardImage({ src, alt: "Demo" });
    expect(resolved.src).toBe(src);
  });
});
