import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("warehouse route snapshot scoping", () => {
  it("keeps warehouse pages on route-scoped Supabase reads instead of one broad snapshot", () => {
    const pages = {
      dashboard: source("app/warehouse/dashboard/page.tsx"),
      orders: source("app/warehouse/orders/page.tsx"),
      picking: source("app/warehouse/picking/page.tsx"),
      packing: source("app/warehouse/packing/page.tsx"),
      dispatch: source("app/warehouse/dispatch/page.tsx"),
      returns: source("app/warehouse/returns/page.tsx"),
      transfers: source("app/warehouse/transfers/page.tsx"),
      activity: source("app/warehouse/activity/page.tsx"),
      settings: source("app/warehouse/settings/page.tsx")
    };

    for (const [scope, page] of Object.entries(pages)) {
      expect(page).toContain(`getWarehouseSnapshot({ scope: "${scope}" })`);
    }
  });

  it("defines explicit warehouse snapshot scopes that avoid unrelated table reads", () => {
    const adminService = source("services/admin.ts");

    expect(adminService).toContain("type WarehouseSnapshotScope");
    expect(adminService).toContain("const warehouseSnapshotScopes");
    expect(adminService).toContain('picking: new Set(["stock", "orders", "orderItems"])');
    expect(adminService).toContain('dispatch: new Set(["shipments", "shipmentItems", "shipmentTimeline", "orders", "orderItems"])');
    expect(adminService).toContain("quantity,created_at&order=created_at.desc&limit=120");
    expect(adminService).not.toContain("quantity_packed");
    expect(adminService).toContain('movements: new Set(["movements"])');
    expect(adminService).toContain('orders: new Set(["products", "stock", "orders", "orderItems", "shipments"])');
    expect(adminService).toContain('activity: new Set(["movements", "shipmentTimeline", "activityLogs"])');
    expect(adminService).toContain("resolveWarehouseSnapshotInput");
    expect(adminService).toMatch(/env:\s*options\s*\?\s*\(options\.env\s*\?\?\s*process\.env\)/);
  });

  it("uses process.env for scoped warehouse snapshots when env is omitted", async () => {
    const { getWarehouseSnapshot } = await import("@/services/admin");
    const hasAdminEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
    const snapshot = await getWarehouseSnapshot({ scope: "dispatch" });

    if (hasAdminEnv) {
      expect(snapshot.status).not.toBe("BLOCKED");
      expect(snapshot.blockedReason ?? "").not.toMatch(/Missing Supabase admin environment/);
    } else {
      expect(snapshot.status).toBe("BLOCKED");
    }
  });

  it("scopes shipment and movement routes to the smallest warehouse snapshot", () => {
    const shipments = source("app/warehouse/shipments/page.tsx");
    const shipmentDetail = source("app/warehouse/shipments/[id]/page.tsx");
    const movements = source("app/warehouse/movements/page.tsx");
    const adminOrders = source("app/admin/orders/page.tsx");

    expect(shipments).toContain('getWarehouseSnapshot({ scope: "dispatch" })');
    expect(shipmentDetail).toContain('getWarehouseSnapshot({ scope: "dispatch" })');
    expect(movements).toContain('getWarehouseSnapshot({ scope: "movements" })');
    expect(adminOrders).toContain('getWarehouseSnapshot({ scope: "orders" })');
  });

  it("keeps the packing station behind the picked state instead of processing shortcuts", () => {
    const packingPage = source("app/warehouse/packing/page.tsx");

    expect(packingPage).toContain('text(order.fulfillment_status, "pending") === "picked"');
    expect(packingPage).not.toContain('["picked", "processing"].includes');
  });
});
