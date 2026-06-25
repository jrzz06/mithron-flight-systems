import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fulfillReservedStock,
  releaseCheckoutStock,
  reserveCheckoutStock,
  resolveCheckoutStockSkus
} from "@/services/checkout-stock";

const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  DEFAULT_WAREHOUSE_CODE: "IN-WEST-01"
};

describe("checkout stock RPC contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves checkout SKUs from warehouse stock", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ product_slug: "ag10", sku: "AG10-STD", available_quantity: 5 }]
    }));

    const items = await resolveCheckoutStockSkus([{ productSlug: "ag10", quantity: 2 }], env);
    expect(items).toEqual([{ productSlug: "ag10", quantity: 2, sku: "AG10-STD" }]);
    expect(String((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).toContain("warehouse_stock");
  });

  it("calls reserve_checkout_stock RPC with order and warehouse code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ order_id: "order-1", rows_reserved: 1 })
    }));

    await reserveCheckoutStock("order-1", [{ productSlug: "ag10", quantity: 1, sku: "AG10-STD" }], env);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    expect(String(url)).toContain("/rpc/reserve_checkout_stock");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      p_order_id: "order-1",
      p_warehouse_code: "IN-WEST-01"
    });
  });

  it("calls release_checkout_stock RPC for cancellations", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    }));

    await releaseCheckoutStock("order-1", env);
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    expect(String(url)).toContain("/rpc/release_checkout_stock");
  });

  it("calls fulfill_reserved_stock RPC for fulfillment", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true })
    }));

    await fulfillReservedStock("order-1", "actor-1", env);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] ?? [];
    expect(String(url)).toContain("/rpc/fulfill_reserved_stock");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      p_order_id: "order-1",
      p_actor_id: "actor-1"
    });
  });
});
