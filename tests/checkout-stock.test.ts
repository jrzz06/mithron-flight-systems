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

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<unknown> }>) {
  vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const target = String(url);
    if (target.includes("warehouse_configuration")) {
      return { ok: false, json: async () => [] };
    }
    return handler(target, init);
  }));
}

describe("checkout stock RPC contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves checkout SKUs from warehouse stock", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => [{ product_slug: "ag10", sku: "AG10-STD", available_quantity: 5 }]
    }));

    const items = await resolveCheckoutStockSkus([{ productSlug: "ag10", quantity: 2 }], env);
    expect(items).toEqual([{ productSlug: "ag10", quantity: 2, sku: "AG10-STD" }]);
    const stockCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([callUrl]) => String(callUrl).includes("warehouse_stock"));
    expect(stockCall).toBeTruthy();
  });

  it("calls reserve_checkout_stock RPC with order and warehouse code", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ order_id: "order-1", rows_reserved: 1 })
    }));

    await reserveCheckoutStock("order-1", [{ productSlug: "ag10", quantity: 1, sku: "AG10-STD" }], env);
    const rpcCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([callUrl]) => String(callUrl).includes("/rpc/reserve_checkout_stock"));
    const [, init] = rpcCall ?? [];
    expect(rpcCall).toBeTruthy();
    expect(JSON.parse(String(init?.body))).toMatchObject({
      p_order_id: "order-1",
      p_warehouse_code: "IN-WEST-01"
    });
  });

  it("calls release_checkout_stock RPC for cancellations", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ ok: true })
    }));

    await releaseCheckoutStock("order-1", env);
    const rpcCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([callUrl]) => String(callUrl).includes("/rpc/release_checkout_stock"));
    expect(rpcCall).toBeTruthy();
  });

  it("calls fulfill_reserved_stock RPC for fulfillment", async () => {
    mockFetch(async () => ({
      ok: true,
      json: async () => ({ ok: true })
    }));

    await fulfillReservedStock("order-1", "actor-1", env);
    const rpcCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(([callUrl]) => String(callUrl).includes("/rpc/fulfill_reserved_stock"));
    const [, init] = rpcCall ?? [];
    expect(rpcCall).toBeTruthy();
    expect(JSON.parse(String(init?.body))).toMatchObject({
      p_order_id: "order-1",
      p_actor_id: "actor-1"
    });
  });
});
