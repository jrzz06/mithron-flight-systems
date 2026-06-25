import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveProductSku } from "@/services/product-inventory-sync";

vi.mock("@/services/admin-actions", () => ({
  createAdminRecord: vi.fn(),
  fetchAdminRecordsByColumn: vi.fn()
}));

vi.mock("@/services/warehouse-config", () => ({
  getDefaultWarehouseCode: vi.fn(async () => "IN-WEST-01")
}));

import { createAdminRecord, fetchAdminRecordsByColumn } from "@/services/admin-actions";
import { ensureProductInventoryRecord } from "@/services/product-inventory-sync";

describe("product inventory integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives canonical SKUs from product slugs", () => {
    expect(deriveProductSku("agri-drone-x1")).toBe("AGRI-DRONE-X1");
    expect(deriveProductSku("  survey_cam_v2 ")).toBe("SURVEY-CAM-V2");
    expect(deriveProductSku("---")).toBe("SKU");
  });

  it("creates inventory and warehouse rows with zero stock defaults", async () => {
    vi.mocked(fetchAdminRecordsByColumn).mockResolvedValue([]);
    vi.mocked(createAdminRecord).mockResolvedValue({ id: "row-1" });

    await ensureProductInventoryRecord("agri-drone-x1", "actor-1");

    expect(createAdminRecord).toHaveBeenCalledWith(
      "inventory",
      expect.objectContaining({
        product_slug: "agri-drone-x1",
        sku: "AGRI-DRONE-X1",
        stock_status: "out_of_stock",
        quantity: 0,
        reserved_quantity: 0
      }),
      "actor-1",
      process.env
    );
    expect(createAdminRecord).toHaveBeenCalledWith(
      "warehouse_stock",
      expect.objectContaining({
        warehouse_code: "IN-WEST-01",
        product_slug: "agri-drone-x1",
        sku: "AGRI-DRONE-X1",
        available_quantity: 0,
        committed_quantity: 0
      }),
      "actor-1",
      process.env
    );
  });

  it("does not overwrite existing canonical inventory rows", async () => {
    vi.mocked(fetchAdminRecordsByColumn).mockImplementation(async (table, _column, slug) => {
      if (table === "inventory") {
        return [{ product_slug: slug, sku: "AGRI-DRONE-X1" }];
      }
      if (table === "warehouse_stock") {
        return [{ product_slug: slug, sku: "AGRI-DRONE-X1", warehouse_code: "IN-WEST-01" }];
      }
      return [];
    });

    await ensureProductInventoryRecord("agri-drone-x1", "actor-1");

    expect(createAdminRecord).not.toHaveBeenCalled();
  });
});

describe("product inventory integrity migration", () => {
  it("backfills missing rows without duplicating inventory", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260628000100_product_inventory_integrity.sql"),
      "utf8"
    );

    expect(migration).toContain("derive_product_sku");
    expect(migration).toContain("ensure_product_inventory_row");
    expect(migration).toContain("on conflict (product_slug, sku) do nothing");
    expect(migration).toContain("trg_mithron_products_ensure_inventory");
    expect(migration).toContain("stock_status");
    expect(migration).toContain("'out_of_stock'");
  });
});
