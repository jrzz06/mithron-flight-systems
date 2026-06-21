import { describe, expect, it } from "vitest";
import { getResponsiveAssetForSrc } from "@/config/generated-assets";
import { canonicalStorefrontPath, resolveHeroSlideSrc } from "@/lib/media/resolve-storefront-src";

describe("storefront local image resolution", () => {
  it("canonicalizes legacy hero png cms paths to enhanced webp masters", () => {
    expect(canonicalStorefrontPath("/assets/hero/hero-slide-01.png")).toBe("/assets/hero/hero-slide-01.webp");
    expect(canonicalStorefrontPath("/media/mithron/hero/ag10-command.webp")).toBe("/assets/hero/hero-slide-01.webp");
  });

  it("resolves hero slide ids to canonical webp paths", () => {
    expect(resolveHeroSlideSrc("/assets/hero/hero-slide-01.png", "ag10-arrival")).toMatch(
      /hero-slide-01/
    );
  });

  it("resolves optimized responsive variants for png and webp local master keys", () => {
    const fromPng = getResponsiveAssetForSrc("/assets/hero/hero-slide-01.png");
    const fromWebp = getResponsiveAssetForSrc("/assets/hero/hero-slide-01.webp");

    if (fromPng?.status === "generated") {
      expect(fromPng?.variants.webp?.at(-1)?.src).toMatch(/^https:\/\//);
    }
    if (fromWebp?.status === "generated") {
      expect(fromWebp?.variants.webp?.at(-1)?.src).toMatch(/^https:\/\//);
    }
  });
});
