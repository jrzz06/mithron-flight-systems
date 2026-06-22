import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AdminRecordConflictError } from "@/services/admin-actions";
import {
  inventoryFeedbackQueryParams,
  operationalFeedbackFromActionError,
  readExpectedUpdatedAt
} from "@/lib/admin/conflict-handling";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("inventory conflict handling", () => {
  it("passes warehouse and inventory timestamps from inventory manager forms", () => {
    const manager = source("components/admin/inventory-manager.tsx");
    const view = source("services/simple-inventory-view.ts");

    expect(view).toContain("warehouseUpdatedAt");
    expect(view).toContain("inventoryUpdatedAt");
    expect(manager).toContain('name="expected_updated_at"');
    expect(manager).toContain('name="expected_inventory_updated_at"');
  });

  it("routes quick inventory saves through the atomic adjustment RPC with CAS", () => {
    const actions = source("app/warehouse/actions.ts");

    expect(actions).toContain("readExpectedUpdatedAt");
    expect(actions).toContain("expectedUpdatedAt: expectedWarehouseUpdatedAt");
    expect(actions).toContain('reasonCode: "warehouse_quick_edit"');
    expect(actions).toContain('expectedUpdatedAt: expectedInventoryUpdatedAt');
  });

  it("maps record conflicts to reload guidance for inventory feedback", () => {
    const error = new AdminRecordConflictError("Concurrent inventory update detected.");
    const feedback = operationalFeedbackFromActionError(error);
    const params = inventoryFeedbackQueryParams(error);

    expect(feedback.status).toBe("warning");
    expect(feedback.message).toContain("Reload the page");
    expect(params.get("inventory_status")).toBe("conflict");
  });

  it("reads expected_updated_at from submitted form data", () => {
    const formData = new FormData();
    formData.set("expected_updated_at", "2026-06-22T12:00:00.000Z");
    expect(readExpectedUpdatedAt(formData)).toBe("2026-06-22T12:00:00.000Z");
  });
});
