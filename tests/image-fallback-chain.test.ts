import { describe, expect, it } from "vitest";
import { buildImageFallbackChain, buildResponsiveImageModel } from "@/lib/media/responsive-image-model";

describe("image fallback chain", () => {
  it("keeps fallback candidates restricted to Supabase storage URLs", () => {
    const model = buildResponsiveImageModel({
      src: "https://example.supabase.co/storage/v1/object/public/mithron-products/catalog-cutouts/v1/demo.webp",
      responsive: {
        assetId: "demo",
        bucket: "mithron-products",
        assetRole: "product",
        category: "product",
        generatedPromptId: "demo",
        status: "generated",
        fallbackSrc: "https://static.wixstatic.com/media/demo.png",
        fallbackAlt: "Demo",
        width: 1200,
        height: 900,
        dominantColor: "#fff",
        variants: {
          webp: [
            {
              src: "https://example.supabase.co/storage/v1/object/public/mithron-products/demo-768w-v1.webp",
              width: 768,
              height: 576,
              format: "webp",
              storagePath: "catalog-cutouts/v1/demo-768w-v1.webp"
            }
          ]
        }
      },
      imageRole: "card"
    });

    expect(buildImageFallbackChain(model)).toEqual([
      model.primarySrc,
      model.requestedSrc
    ]);
  });
});
