import { describe, expect, it } from "vitest";
import {
  formatAvailability,
  isSpecLikeBlob,
  parseInlineSpecPairs,
  sortSpecEntries
} from "@/lib/product-spec-text";
import { getProductMarketingTagline } from "@/lib/product-marketing-copy";

const MULTISPECTRAL_SPEC_BLOB =
  "UAV Type: HexacopterUAV Category: SmallEndurance: 28 minRange (LoS): 1 kmMaximum All-Up-Weight: 8.56 kgWind Resistance: 9.7 m/s (18.8 knots)Maximum Speed: 10 m/s (36 kmph)Operating Altitude:";

describe("product spec text", () => {
  it("detects concatenated scrape spec blobs", () => {
    expect(isSpecLikeBlob(MULTISPECTRAL_SPEC_BLOB)).toBe(true);
    expect(isSpecLikeBlob("High-precision mapping workflow.")).toBe(false);
  });

  it("parses glued inline spec pairs from source descriptions", () => {
    const pairs = parseInlineSpecPairs(MULTISPECTRAL_SPEC_BLOB);

    expect(pairs["UAV Type"]).toBe("Hexacopter");
    expect(pairs["UAV Category"]).toBe("Small");
    expect(pairs["Endurance"]).toBe("28 min");
    expect(pairs["Range (LoS)"]).toBe("1 km");
    expect(pairs["Maximum All-Up-Weight"]).toBe("8.56 kg");
    expect(pairs["Wind Resistance"]).toBe("9.7 m/s (18.8 knots)");
    expect(pairs["Maximum Speed"]).toBe("10 m/s (36 kmph)");
  });

  it("formats availability labels for display", () => {
    expect(formatAvailability("InStock")).toBe("In stock");
    expect(formatAvailability("OutOfStock")).toBe("Out of stock");
  });

  it("sorts flight specs ahead of generic metadata", () => {
    const sorted = sortSpecEntries([
      ["Category", "Video Drones"],
      ["Endurance", "28 min"],
      ["UAV Type", "Hexacopter"]
    ]);

    expect(sorted.map(([key]) => key)).toEqual(["UAV Type", "Endurance", "Category"]);
  });
});

describe("product marketing copy", () => {
  it("returns category tagline instead of spec blobs", () => {
    expect(
      getProductMarketingTagline({
        name: "Multispectral Camera Survey Drone",
        category: "Video Drones",
        tagline: MULTISPECTRAL_SPEC_BLOB,
        sourceDescription: MULTISPECTRAL_SPEC_BLOB
      })
    ).toBe("High-precision mapping workflow.");
  });
});
