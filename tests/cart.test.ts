import { describe, expect, it } from "vitest";
import { createCartSlice } from "@/store/cart";

describe("cart store core", () => {
  it("adds bundles, merges repeated items, and tracks item counts without persisting prices", () => {
    const cart = createCartSlice();

    cart.addItem({
      productSlug: "source-agri-kisan-drone-small-8-liter",
      bundleId: "standard",
      productName: "Agri Kisan Drone Small - 8 Liter",
      image: "https://example.com/drone.webp"
    });
    cart.addItem({
      productSlug: "source-agri-kisan-drone-small-8-liter",
      bundleId: "standard",
      productName: "Agri Kisan Drone Small - 8 Liter",
      image: "https://example.com/drone.webp"
    });

    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]?.quantity).toBe(2);
    expect(cart.items[0]?.productName).toBe("Agri Kisan Drone Small - 8 Liter");
    expect(cart.items[0]?.image).toBe("https://example.com/drone.webp");
    expect(cart.items[0]).not.toHaveProperty("unitPrice");
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
