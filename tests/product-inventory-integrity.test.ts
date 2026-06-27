import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveProductSku } from "@/services/product-inventory-sync";
import { buildSimpleInventoryRows } from "@/services/simple-inventory-view";

vi.mock("@/services/admin-actions", () => ({
  createAdminRecord: vi.fn(),
  fetchAdminRecordsByColumn: vi.fn(),
  upsertInventoryRecord: vi.fn(),
  upsertWarehouseStockRecord: vi.fn()
}));

vi.mock("@/services/warehouse-config", () => ({
  getDefaultWarehouseCode: vi.fn(async () => "IN-WEST-01")
}));

import { createAdminRecord, fetchAdminRecordsByColumn, upsertInventoryRecord, upsertWarehouseStockRecord } from "@/services/admin-actions";
import {
  ensureProductCatalogInventoryRecord,
  ensureProductInventoryRecord,
  ensureWarehouseStockRecord
} from "@/services/product-inventory-sync";

describe("product inventory integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives canonical SKUs from product slugs", () => {
    expect(deriveProductSku("agri-drone-x1")).toBe("AGRI-DRONE-X1");
    expect(deriveProductSku("  survey_cam_v2 ")).toBe("SURVEY-CAM-V2");
    expect(deriveProductSku("---")).toBe("SKU");
  });

  it("creates catalog inventory rows with zero stock defaults", async () => {
    vi.mocked(fetchAdminRecordsByColumn).mockResolvedValue([]);
    vi.mocked(createAdminRecord).mockResolvedValue({ id: "row-1" });

    await ensureProductCatalogInventoryRecord("agri-drone-x1", "actor-1");

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
      process.env,
      {}
    );
    expect(upsertInventoryRecord).not.toHaveBeenCalled();
    expect(upsertWarehouseStockRecord).not.toHaveBeenCalled();
  });

  it("creates warehouse stock rows separately for warehouse workflows", async () => {
    vi.mocked(fetchAdminRecordsByColumn).mockResolvedValue([]);
    vi.mocked(upsertWarehouseStockRecord).mockResolvedValue({ id: "row-1" });

    await ensureWarehouseStockRecord("agri-drone-x1", "actor-1");

    expect(upsertWarehouseStockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        warehouse_code: "IN-WEST-01",
        product_slug: "agri-drone-x1",
        sku: "AGRI-DRONE-X1",
        available_quantity: 0,
        committed_quantity: 0
      }),
      "actor-1",
      process.env,
      {}
    );
    expect(upsertInventoryRecord).not.toHaveBeenCalled();
  });

  it("creates both catalog and warehouse rows for admin repair", async () => {
    vi.mocked(fetchAdminRecordsByColumn).mockResolvedValue([]);
    vi.mocked(createAdminRecord).mockResolvedValue({ id: "row-1" });
    vi.mocked(upsertWarehouseStockRecord).mockResolvedValue({ id: "row-2" });

    await ensureProductInventoryRecord("agri-drone-x1", "actor-1");

    expect(createAdminRecord).toHaveBeenCalled();
    expect(upsertWarehouseStockRecord).toHaveBeenCalled();
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
    expect(upsertWarehouseStockRecord).not.toHaveBeenCalled();
  });

  it("builds exactly one warehouse row per product without virtual fallbacks", () => {
    const products = [
      { slug: "agri-drone-x1", name: "Agri Drone", workflow_status: "published" },
      { slug: "archived-kit", name: "Archived Kit", workflow_status: "archived", archived_at: "2026-01-01T00:00:00.000Z" }
    ];
    const inventory = [
      { product_slug: "agri-drone-x1", sku: "AGRI-DRONE-X1", quantity: 4, stock_status: "available", reserved_quantity: 1, reorder_threshold: 2 }
    ];
    const stock = [
      { warehouse_code: "IN-WEST-01", product_slug: "agri-drone-x1", sku: "AGRI-DRONE-X1", available_quantity: 4, committed_quantity: 0 }
    ];

    const rows = buildSimpleInventoryRows(products, inventory, stock, "IN-WEST-01");
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.productSlug === "agri-drone-x1")?.quantity).toBe(4);
    expect(rows.find((row) => row.productSlug === "archived-kit")?.isArchived).toBe(true);
    expect(rows.find((row) => row.productSlug === "archived-kit")?.quantity).toBe(0);
  });
});

describe("product inventory integrity migration", () => {
  it("enforces one inventory row per product", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260701000100_inventory_one_per_product.sql"),
      "utf8"
    );

    expect(migration).toContain("reconcile_product_inventory_integrity");
    expect(migration).toContain("inventory_one_per_product");
    expect(migration).toContain("inventory_reconcile_reports");
    expect(migration).toContain("enforce_canonical_inventory_sku");
  });

  it("separates catalog inventory seeding from warehouse stock in follow-up migration", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260630000100_supplier_catalog_inventory_separation.sql"),
      "utf8"
    );

    expect(migration).toContain("ensure_product_catalog_inventory_row");
    expect(migration).toContain("ensure_warehouse_stock_row");
    expect(migration).toContain("ensure_product_catalog_inventory_row(new.slug)");
    expect(migration).toContain("inventory.update_own");
    expect(migration).not.toMatch(/trg_mithron_products_ensure_inventory_fn[\s\S]*ensure_warehouse_stock_row\(new\.slug/);
  });
});
