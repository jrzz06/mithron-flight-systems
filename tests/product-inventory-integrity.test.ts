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

  it("builds exactly one warehouse row per product using inventory.quantity as source of truth", () => {
    const products = [
      { slug: "agri-drone-x1", name: "Agri Drone", workflow_status: "published" },
      { slug: "archived-kit", name: "Archived Kit", workflow_status: "archived", archived_at: "2026-01-01T00:00:00.000Z" }
    ];
    const inventory = [
      { product_slug: "agri-drone-x1", sku: "AGRI-DRONE-X1", quantity: 4, stock_status: "available" }
    ];
    const stock = [
      { warehouse_code: "IN-WEST-01", product_slug: "agri-drone-x1", sku: "AGRI-DRONE-X1", available_quantity: 3 }
    ];

    const rows = buildSimpleInventoryRows(products, inventory, stock, "IN-WEST-01");
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.productSlug === "agri-drone-x1")?.quantity).toBe(4);
    expect(rows.find((row) => row.productSlug === "archived-kit")?.isArchived).toBe(true);
    expect(rows.find((row) => row.productSlug === "archived-kit")?.quantity).toBe(0);
  });

  it("derives in stock / out of stock from quantity only", () => {
    const products = [{ slug: "agri-drone-x1", name: "Agri Drone", workflow_status: "published" }];
    const inventory = [{ product_slug: "agri-drone-x1", sku: "AGRI-DRONE-X1", quantity: 0, stock_status: "out_of_stock" }];
    const stock = [{ warehouse_code: "IN-WEST-01", product_slug: "agri-drone-x1", sku: "AGRI-DRONE-X1", available_quantity: 8 }];

    const rows = buildSimpleInventoryRows(products, inventory, stock, "IN-WEST-01");
    expect(rows[0]?.quantity).toBe(0);
    expect(rows[0]?.stockStatus).toBe("out_of_stock");
  });

  it("picks the preferred warehouse row for admin product stock display", () => {
    const stock = [
      { warehouse_code: "IN-EAST-01", product_slug: "agri-drone-x1", available_quantity: 2 },
      { warehouse_code: "IN-WEST-01", product_slug: "agri-drone-x1", available_quantity: 7 }
    ];
    expect(pickWarehouseStockRow(stock, "agri-drone-x1", "IN-WEST-01")?.warehouse_code).toBe("IN-WEST-01");
  });
});

describe("product inventory integrity migration", () => {
  it("simplifies inventory to single-quantity model", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260712000100_simplified_inventory_model.sql"),
      "utf8"
    );

    expect(migration).toContain("deduct_order_inventory_on_fulfillment");
    expect(migration).toContain("reserved_quantity = 0");
    expect(migration).toContain("inventory_skipped");
    expect(migration).not.toContain("fulfill_reserved_stock(p_order_id");
  });

  it("enforces one inventory row per product", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260701000100_inventory_one_per_product.sql"),
      "utf8"
    );

    expect(migration).toContain("reconcile_product_inventory_integrity");
    expect(migration).toContain("inventory_one_per_product");
  });
});
