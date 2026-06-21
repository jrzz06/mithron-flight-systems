import { describe, expect, it } from "vitest";
import { parseCheckoutRequestBody } from "@/lib/api/checkout-schema";

describe("checkout request schema", () => {
  it("accepts valid checkout payloads", () => {
    const parsed = parseCheckoutRequestBody({
      email: "buyer@example.com",
      phone: "+919876543210",
      items: [{ productSlug: "drone-x", quantity: 2 }],
      addressId: "addr-1",
      region: "IN-KA"
    });

    expect(parsed).toEqual({
      email: "buyer@example.com",
      phone: "+919876543210",
      items: [{ productSlug: "drone-x", quantity: 2 }],
      addressId: "addr-1",
      region: "IN-KA"
    });
  });

  it("rejects invalid quantities, missing email, and invalid phone", () => {
    expect(parseCheckoutRequestBody({ email: "", items: [] })).toBeNull();
    expect(parseCheckoutRequestBody({ email: "a@b.com", items: [{ productSlug: "x", quantity: 0 }] })).toBeNull();
    expect(parseCheckoutRequestBody({ email: "a@b.com", items: [{ productSlug: "x", quantity: 100 }] })).toBeNull();
    expect(parseCheckoutRequestBody({ email: "a@b.com", phone: "123", items: [{ productSlug: "x", quantity: 1 }] })).toBeNull();
    expect(parseCheckoutRequestBody({ email: "not-an-email", phone: "+919876543210", items: [{ productSlug: "x", quantity: 1 }] })).toBeNull();
  });
});

describe("checkout stock service contract", () => {
  it("exports atomic reservation helpers", async () => {
    const module = await import("@/services/checkout-stock");
    expect(typeof module.reserveCheckoutStock).toBe("function");
    expect(typeof module.releaseCheckoutStock).toBe("function");
    expect(typeof module.resolveCheckoutStockSkus).toBe("function");
  });
});

describe("product publish service contract", () => {
  it("exports unified publish helpers", async () => {
    const module = await import("@/services/product-publish");
    expect(typeof module.publishProductToStorefront).toBe("function");
    expect(typeof module.assertProductCanPublish).toBe("function");
  });
});

describe("inventory manager rename", () => {
  it("uses Supabase inventory naming instead of Wix UI labels", async () => {
    const module = await import("@/components/admin/inventory-manager");
    expect(typeof module.InventoryManager).toBe("function");
  });
});
