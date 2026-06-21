import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyCheckoutStockAvailability } from "@/services/checkout-stock";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key"
};

describe("checkout stock verification", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes when warehouse stock covers requested quantity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ available_quantity: 5, product_slug: "ag10" }]
    }));

    await expect(
      verifyCheckoutStockAvailability([{ productSlug: "ag10", quantity: 2 }], env)
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toContain("product_slug=in.(ag10)");
  });

  it("batches stock verification for multiple products in one query", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { available_quantity: 4, product_slug: "ag10" },
        { available_quantity: 2, product_slug: "m350" }
      ]
    }));

    await expect(
      verifyCheckoutStockAvailability([
        { productSlug: "ag10", quantity: 2 },
        { productSlug: "m350", quantity: 1 }
      ], env)
    ).resolves.toBeUndefined();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toContain("product_slug=in.(ag10,m350)");
  });

  it("rejects checkout when stock is insufficient", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ available_quantity: 1, product_slug: "ag10" }]
    }));

    await expect(
      verifyCheckoutStockAvailability([{ productSlug: "ag10", quantity: 3 }], env)
    ).rejects.toThrow("Insufficient stock for ag10");
  });

  it("rejects checkout when stock lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

    await expect(
      verifyCheckoutStockAvailability([{ productSlug: "ag10", quantity: 1 }], env)
    ).rejects.toThrow("Unable to verify checkout stock availability");
  });
});
