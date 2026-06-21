import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildInventoryLinkageRecords,
  buildProductInventoryWorkflowFromFormData,
  buildSimpleInventoryUpdateFromFormData
} from "@/services/enterprise-admin-forms";

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("product inventory enterprise workflow", () => {
  it("builds SKU-safe inventory and warehouse records with persisted variant linkage", () => {
    const input = buildProductInventoryWorkflowFromFormData(formData({
      product_slug: "source-agri-kisan-drone-small-8-liter",
      sku: " AG-8L-BASE ",
      variant_id: "base",
      warehouse_code: " IN-WEST-01 ",
      stock_status: "available",
      quantity: "4",
      reserved_quantity: "1",
      reorder_threshold: "5",
      available_quantity: "3",
      committed_quantity: "1",
      change_summary: "Link base variant stock"
    }));

    const records = buildInventoryLinkageRecords(input, {
      actorId: "00000000-0000-0000-0000-000000000001",
      at: "2026-05-24T10:00:00.000Z"
    });

    expect(records.inventoryRecord).toEqual({
      product_slug: "source-agri-kisan-drone-small-8-liter",
      sku: "AG-8L-BASE",
      variant_id: "base",
      stock_status: "low_stock",
      quantity: 4,
      reserved_quantity: 1,
      reorder_threshold: 5,
      updated_by: "00000000-0000-0000-0000-000000000001",
      updated_at: "2026-05-24T10:00:00.000Z"
    });
    expect(records.warehouseStockRecord).toEqual({
      warehouse_code: "IN-WEST-01",
      product_slug: "source-agri-kisan-drone-small-8-liter",
      sku: "AG-8L-BASE",
      variant_id: "base",
      available_quantity: 3,
      committed_quantity: 1,
      last_counted_at: "2026-05-24T10:00:00.000Z",
      updated_by: "00000000-0000-0000-0000-000000000001",
      updated_at: "2026-05-24T10:00:00.000Z"
    });
    expect(records.lowStock).toBe(true);
  });

  it("rejects inconsistent reserved and committed quantities before mutation", () => {
    const input = buildProductInventoryWorkflowFromFormData(formData({
      product_slug: "source-agri-kisan-drone-small-8-liter",
      sku: "AG-8L-BASE",
      warehouse_code: "IN-WEST-01",
      stock_status: "available",
      quantity: "2",
      reserved_quantity: "3",
      reorder_threshold: "1",
      available_quantity: "5",
      committed_quantity: "6"
    }));

    expect(() => buildInventoryLinkageRecords(input, {
      actorId: "00000000-0000-0000-0000-000000000001",
      at: "2026-05-24T10:00:00.000Z"
    })).toThrow("Reserved quantity cannot exceed inventory quantity.");
  });

  it("maps Wix-style stock edits into the existing inventory and warehouse contract", () => {
    const input = buildSimpleInventoryUpdateFromFormData(formData({
      product_slug: "source-agri-kisan-drone-small-8-liter",
      sku: " AG-8L-BASE ",
      variant_id: "base",
      warehouse_code: " IN-WEST-01 ",
      stock_status: "out_of_stock",
      quantity: "0",
      note: "Manual count from simple inventory"
    }));

    expect(input).toEqual({
      productSlug: "source-agri-kisan-drone-small-8-liter",
      sku: "AG-8L-BASE",
      variantId: "base",
      warehouseCode: "IN-WEST-01",
      stockStatus: "out_of_stock",
      quantity: 0,
      note: "Manual count from simple inventory",
      changeSummary: "Update stock for source-agri-kisan-drone-small-8-liter:AG-8L-BASE"
    });
  });

  it("wires product and warehouse inventory forms through one shared linkage builder", () => {
    const productActions = readFileSync(join(process.cwd(), "app/admin/products/actions.ts"), "utf8");
    const warehouseActions = readFileSync(join(process.cwd(), "app/warehouse/actions.ts"), "utf8");
    const adminPage = readFileSync(join(process.cwd(), "app/admin/products/page.tsx"), "utf8");
    const warehousePage = readFileSync(join(process.cwd(), "app/warehouse/inventory/page.tsx"), "utf8");

    expect(productActions).toContain("buildInventoryLinkageRecords");
    expect(warehouseActions).toContain("buildInventoryLinkageRecords");
    expect(warehouseActions).toContain("saveSimpleInventoryFormAction");
    expect(warehouseActions).toContain("saveInventoryQuickEditFormAction");
    expect(adminPage).toContain("data-product-inventory-table=\"inventory\"");
    expect(warehousePage).toContain("InventoryManager");
    expect(warehousePage).toContain("saveWarehouseInventoryWithFeedback");
  });

  it("adds additive schema support for variant-linked, SKU-required inventory rows", () => {
    const migrationPath = join(process.cwd(), "supabase", "migrations", "20260524000400_product_inventory_linkage.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();

    expect(sql).toContain("alter table public.inventory");
    expect(sql).toContain("add column if not exists variant_id text");
    expect(sql).toContain("alter table public.warehouse_stock");
    expect(sql).toContain("inventory_sku_required_chk");
    expect(sql).toContain("warehouse_stock_sku_required_chk");
    expect(sql).toContain("inventory_variant_lookup_idx");
    expect(sql).toContain("warehouse_stock_variant_lookup_idx");
  });
});
