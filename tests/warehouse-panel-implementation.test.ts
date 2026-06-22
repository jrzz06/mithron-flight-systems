import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ORDER_FULFILLMENT_STATES,
  assertOrderFulfillmentTransition
} from "@/services/enterprise-admin-forms";
import { canAccessProtectedPath, defaultPathForRole } from "@/lib/auth/access-control";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function exists(path: string) {
  return existsSync(join(root, path));
}

describe("warehouse panel implementation", () => {
  it("creates a separate warehouse route group with a warehouse-only sidebar", () => {
    for (const path of [
      "app/warehouse/layout.tsx",
      "app/warehouse/dashboard/page.tsx",
      "app/warehouse/orders/page.tsx",
      "app/warehouse/picking/page.tsx",
      "app/warehouse/packing/page.tsx",
      "app/warehouse/dispatch/page.tsx",
      "app/warehouse/inventory/page.tsx",
      "app/warehouse/returns/page.tsx",
      "app/warehouse/transfers/page.tsx",
      "app/warehouse/activity/page.tsx",
      "app/warehouse/settings/page.tsx",
      "components/warehouse/warehouse-frame.tsx"
    ]) {
      expect(exists(path), `${path} should exist`).toBe(true);
    }

    const frame = source("components/warehouse/warehouse-frame.tsx");
    const navConfig = source("components/platform/nav-config.ts");
    for (const label of [
      "Today",
      "Orders",
      "Fulfillment",
      "Shipments",
      "Stock",
      "Returns",
      "History",
      "Settings"
    ]) {
      expect(navConfig).toContain(label);
    }
    expect(frame).toContain("PlatformShell");
    expect(navConfig).toContain("/warehouse/shipments");
    expect(navConfig).toContain("/warehouse/inventory");
    expect(frame).not.toContain("/admin/media");
    expect(frame).not.toContain("/admin/users");
    expect(frame).not.toContain("/admin/settings");
  });

  it("keeps warehouse RBAC isolated from admin and sends warehouse users to the dashboard", () => {
    expect(canAccessProtectedPath("warehouse", "/warehouse/dashboard")).toBe(true);
    expect(canAccessProtectedPath("warehouse", "/warehouse/settings")).toBe(true);
    expect(canAccessProtectedPath("warehouse", "/admin/settings")).toBe(false);
    expect(canAccessProtectedPath("warehouse", "/admin/cms")).toBe(false);
    expect(defaultPathForRole("warehouse")).toBe("/warehouse/dashboard");

    const layout = source("app/warehouse/layout.tsx");
    expect(layout).toContain("getCurrentAuthContext");
    expect(layout).toContain("canAccessProtectedPath");
    expect(layout).toContain("WarehouseFrame");
  });

  it("extends the real order lifecycle without bypassing validation", () => {
    expect(ORDER_FULFILLMENT_STATES).toEqual([
      "pending",
      "processing",
      "picked",
      "packed",
      "ready_to_dispatch",
      "shipped",
      "delivered",
      "returned",
      "cancelled"
    ]);
    expect(assertOrderFulfillmentTransition("processing", "picked")).toBe("picked");
    expect(assertOrderFulfillmentTransition("picked", "packed")).toBe("packed");
    expect(assertOrderFulfillmentTransition("packed", "ready_to_dispatch")).toBe("ready_to_dispatch");
    expect(assertOrderFulfillmentTransition("ready_to_dispatch", "shipped")).toBe("shipped");
    expect(() => assertOrderFulfillmentTransition("pending", "shipped")).toThrow("Invalid order fulfillment transition pending -> shipped.");

    const migration = source("supabase/migrations/20260526000400_warehouse_order_lifecycle_expansion.sql");
    expect(migration).toContain("'picked'");
    expect(migration).toContain("'ready_to_dispatch'");
    expect(migration).toContain("orders_fulfillment_transition_guard");
  });

  it("wires operational warehouse pages to real Supabase snapshots and existing server actions", () => {
    const pages = {
      dashboard: source("app/warehouse/dashboard/page.tsx"),
      picking: source("app/warehouse/picking/page.tsx"),
      packing: source("app/warehouse/packing/page.tsx"),
      dispatch: source("app/warehouse/dispatch/page.tsx"),
      returns: source("app/warehouse/returns/page.tsx"),
      transfers: source("app/warehouse/transfers/page.tsx"),
      activity: source("app/warehouse/activity/page.tsx"),
      settings: source("app/warehouse/settings/page.tsx")
    };

    for (const page of Object.values(pages)) {
      expect(page).toContain("getWarehouseSnapshot");
      expect(page).not.toMatch(/mock|demo|placeholder/i);
    }

    expect(pages.dashboard).toContain("data-warehouse-operational-dashboard");
    expect(pages.dashboard).toContain("pending orders");
    expect(pages.dashboard).toContain("picking queue");
    expect(pages.dashboard).toContain("dispatched today");

    expect(pages.picking).toContain("data-picking-queue");
    expect(pages.picking).toContain("updateWarehouseOrderLifecycleFormAction");
    expect(pages.picking).toContain("value=\"picked\"");
    expect(pages.picking).toContain("data-barcode-ready");

    expect(pages.packing).toContain("data-packing-station");
    expect(pages.packing).toContain("createShipmentFormAction");
    expect(pages.packing).toContain("value=\"packed\"");
    expect(pages.packing).toContain("data-packing-checklist");

    expect(pages.dispatch).toContain("data-dispatch-handoff-center");
    expect(pages.dispatch).toContain("updateShipmentLifecycleFormAction");
    expect(pages.dispatch).toContain("value=\"shipped\"");
    expect(pages.dispatch).toContain("export shipment CSV");

    expect(pages.returns).toContain("data-returns-workflow");
    expect(pages.returns).toContain("value=\"returned\"");
    expect(pages.returns).toContain("value=\"damaged\"");

    expect(pages.transfers).toContain("data-stock-transfer-workflow");
    expect(pages.transfers).toContain("applyWarehouseMovementFormAction");
    expect(pages.transfers).toContain("value=\"transfer\"");

    expect(pages.activity).toContain("data-warehouse-activity-timeline");
    expect(pages.activity).toContain("activityLogs");

    expect(pages.settings).toContain("data-warehouse-settings");
    expect(pages.settings).not.toContain("admin_settings");
    expect(pages.settings).not.toContain("CMS");
  });
});
