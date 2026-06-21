import { describe, expect, it } from "vitest";
import { createCartSlice } from "@/store/cart";

describe("cart store core", () => {
  it("adds bundles, merges repeated items, and computes mission stack totals", () => {
    const cart = createCartSlice();

    cart.addItem({
      productSlug: "source-agri-kisan-drone-small-8-liter",
      productName: "Agri Kisan Drone Small - 8 Liter",
      bundleId: "standard",
      bundleName: "Agri Kisan Drone Small - 8 Liter",
      unitPrice: 545000,
      image: "https://ictnoydmxlywwxwnugal.supabase.co/storage/v1/object/public/mithron-products/catalog-cutouts/v1/source-agri-kisan-drone-small-8-liter.webp"
    });
    cart.addItem({
      productSlug: "source-agri-kisan-drone-small-8-liter",
      productName: "Agri Kisan Drone Small - 8 Liter",
      bundleId: "standard",
      bundleName: "Agri Kisan Drone Small - 8 Liter",
      unitPrice: 545000,
      image: "https://ictnoydmxlywwxwnugal.supabase.co/storage/v1/object/public/mithron-products/catalog-cutouts/v1/source-agri-kisan-drone-small-8-liter.webp"
    });

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(2);
    expect(cart.subtotal()).toBe(1090000);
    expect(cart.itemCount()).toBe(2);
  });

  it("tracks deployment configuration progress", () => {
    const cart = createCartSlice();

    cart.setCheckoutStep("payment");
    cart.setPromoCode("MITHRON-FIELD");

    expect(cart.checkout.step).toBe("payment");
    expect(cart.checkout.promoCode).toBe("MITHRON-FIELD");
  });
});
