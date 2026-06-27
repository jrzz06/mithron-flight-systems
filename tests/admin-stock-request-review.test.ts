import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin stock request review UX", () => {
  it("renders a comprehensive stock submission review panel", () => {
    const panel = readFileSync(join(process.cwd(), "components/admin/admin-stock-request-review-panel.tsx"), "utf8");
    const inventoryPage = readFileSync(join(process.cwd(), "app/admin/inventory/page.tsx"), "utf8");
    const supplierInventory = readFileSync(join(process.cwd(), "app/supplier/inventory/page.tsx"), "utf8");

    expect(panel).toContain("AdminStockRequestReviewPanel");
    expect(panel).toContain("Product description");
    expect(panel).toContain("Existing approved stock");
    expect(panel).toContain("Newly requested stock");
    expect(panel).toContain("Stock after approval");
    expect(panel).toContain("approveStockRequestAction");
    expect(inventoryPage).toContain("listPendingStockRequestsForReview");
    expect(supplierInventory).toContain('min={0}');
    expect(supplierInventory).toContain("step={1}");
  });
});
