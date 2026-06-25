import { describe, expect, it } from "vitest";
import {
  PRODUCT_BADGE_TEXT_MAX,
  normalizeProductBadgeStyle,
  readProductBadgeFieldsFromFormData,
  resolveStorefrontProductBadge
} from "@/lib/product-badge";

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("product badge helpers", () => {
  it("hides storefront badges unless enabled with text", () => {
    expect(resolveStorefrontProductBadge({
      badge_enabled: false,
      badge_text: "New Stock",
      badge_style: "success"
    })).toBeUndefined();

    expect(resolveStorefrontProductBadge({
      badge_enabled: true,
      badge_text: "Best Seller",
      badge_style: "premium"
    })).toEqual({
      text: "Best Seller",
      style: "premium"
    });
  });

  it("normalizes invalid styles to default", () => {
    expect(normalizeProductBadgeStyle("PREMIUM")).toBe("premium");
    expect(normalizeProductBadgeStyle("invalid")).toBe("default");
  });

  it("validates admin badge form fields", () => {
    expect(readProductBadgeFieldsFromFormData(formData({
      badge_enabled: "true",
      badge_text: "Featured",
      badge_style: "success"
    }))).toEqual({
      badge_enabled: true,
      badge_text: "Featured",
      badge_style: "success",
      badge: "Featured"
    });

    expect(() => readProductBadgeFieldsFromFormData(formData({
      badge_enabled: "true",
      badge_text: "",
      badge_style: "default"
    }))).toThrow("Badge text is required when Show Badge is enabled.");

    expect(() => readProductBadgeFieldsFromFormData(formData({
      badge_enabled: "true",
      badge_text: "x".repeat(PRODUCT_BADGE_TEXT_MAX + 1),
      badge_style: "default"
    }))).toThrow(`Badge text must be ${PRODUCT_BADGE_TEXT_MAX} characters or fewer.`);
  });
});
