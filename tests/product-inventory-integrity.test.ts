import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveProductSku } from "@/lib/product-sku";
import { buildSimpleInventoryRows, pickWarehouseStockRow } from "@/services/simple-inventory-view";

describe("product inventory integrity", () => {
  it("derives canonical SKUs from product slugs", () => {
    expect(deriveProductSku("agri-drone-x1")).toBe("AGRI-DRONE-X1");
    expect(deriveProductSku("  survey_cam_v2 ")).toBe("SURVEY-CAM-V2");
    expect(deriveProductSku("---")).toBe("SKU");
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
      { warehouse_code: "IN-WEST-01", product_slug: "agri-drone-x1", sku: "AGRI-DRONE-X1", available_quantity: 3, committed_quantity: 0 }
    ];

    const rows = buildSimpleInventoryRows(products, inventory, stock, "IN-WEST-01");
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.productSlug === "agri-drone-x1")?.quantity).toBe(3);
    expect(rows.find((row) => row.productSlug === "agri-drone-x1")?.onHandQuantity).toBe(4);
    expect(rows.find((row) => row.productSlug === "archived-kit")?.isArchived).toBe(true);
    expect(rows.find((row) => row.productSlug === "archived-kit")?.quantity).toBe(0);
  });

  it("uses checkout warehouse availability as the sellable quantity", () => {
    const products = [{ slug: "agri-drone-x1", name: "Agri Drone", workflow_status: "published" }];
    const inventory = [{ product_slug: "agri-drone-x1", sku: "AGRI-DRONE-X1", quantity: 10, stock_status: "available" }];
    const stock = [{ warehouse_code: "IN-WEST-01", product_slug: "agri-drone-x1", sku: "AGRI-DRONE-X1", available_quantity: 8 }];

    const rows = buildSimpleInventoryRows(products, inventory, stock, "IN-WEST-01");
    expect(rows[0]?.quantity).toBe(8);
    expect(rows[0]?.onHandQuantity).toBe(10);
  });

  it("picks the preferred warehouse row for admin product stock display", () => {
    const stock = [
      { warehouse_code: "IN-EAST-01", product_slug: "agri-drone-x1", available_quantity: 2 },
      { warehouse_code: "IN-WEST-01", product_slug: "agri-drone-x1", available_quantity: 7 }
    ];
    expect(pickWarehouseStockRow(stock, "agri-drone-x1", "IN-WEST-01")?.available_quantity).toBe(7);
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

  it("seeds inventory rows from product inserts", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260628000100_product_inventory_integrity.sql"),
      "utf8"
    );

    expect(migration).toContain("ensure_product_inventory_row");
    expect(migration).toContain("trg_mithron_products_ensure_inventory");
  });

  it("provides a single atomic write path for inventory updates", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260707000100_unified_product_inventory_writes.sql"),
      "utf8"
    );

    expect(migration).toContain("upsert_product_inventory");
    expect(migration).toContain("drop trigger if exists trg_sync_inventory_on_update");
    expect(migration).toContain("drop trigger if exists trg_sync_inventory_on_insert");
  });
});
