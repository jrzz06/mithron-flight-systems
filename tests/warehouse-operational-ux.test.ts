import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("warehouse operational UX maturity", () => {
  it("turns the warehouse dashboard route into an operational control surface", () => {
    const rootPage = source("app/warehouse/page.tsx");
    const page = source("app/warehouse/dashboard/page.tsx");
    const shell = source("components/admin/control-shell.tsx");
    const platformShell = source("components/platform/platform-shell.tsx");

    expect(platformShell).toContain("data-control-plane");
    expect(shell).toContain("AdminMetricGrid");
    expect(shell).toContain("data-control-shell-header");
    expect(rootPage).toContain('redirect("/warehouse/dashboard")');
    expect(page).toContain("data-warehouse-operational-dashboard");
    expect(page).toContain("low stock alerts");
    expect(page).toContain("dispatched today");
    expect(page).toContain("inventory movement stats");
    expect(page).toContain('href: "/warehouse/orders"');
    expect(page).toContain('href: "/warehouse/picking"');
    expect(page).not.toContain('href: "/warehouse/fulfillment"');
    expect(page).not.toContain("EnterpriseRealtimePanel");
  });

  it("makes stock adjustment fast, auditable, and quantity-aware", () => {
    const page = source("app/warehouse/inventory/page.tsx");
    const inventoryManager = source("components/admin/inventory-manager.tsx");

    expect(page).toContain("inventory-manager-loader");
    expect(page).toContain("saveWarehouseInventoryWithFeedback");
    expect(inventoryManager).toContain("data-inventory-system");
    expect(inventoryManager).toContain("data-inventory-table");
    expect(inventoryManager).toContain("data-inventory-quick-edit-form");
    expect(inventoryManager).toContain("data-advanced-warehouse-details");
    expect(inventoryManager).toContain("inventory_movements");
    expect(page).toContain('label: "Shipments"');
    expect(page).toContain('label: "Stock Movements"');
    expect(page).not.toContain('href: "/warehouse/orders"');
    expect(page).not.toContain('href: "/warehouse/fulfillment"');
    expect(inventoryManager).toContain("OperationalSubmitButton");
  });

  it("adds direct shipment status actions and visible shipment progression", () => {
    const shipmentsPage = source("app/warehouse/shipments/page.tsx");
    const detailPage = source("app/warehouse/shipments/[id]/page.tsx");

    expect(shipmentsPage).toContain("data-shipment-status-actions");
    expect(shipmentsPage).toContain("mark packed");
    expect(shipmentsPage).toContain("mark shipped");
    expect(shipmentsPage).toContain("ready pickup");
    expect(shipmentsPage).toContain('label: "Stock Movements"');
    expect(shipmentsPage).not.toContain('href: "/warehouse/orders"');
    expect(shipmentsPage).not.toContain('href: "/warehouse/fulfillment"');
    expect(shipmentsPage).toContain("OperationalSubmitButton");
    expect(detailPage).toContain("data-shipment-progress-meter");
    expect(detailPage).toContain("data-shipment-action-feedback");
    expect(detailPage).toContain("OperationalSubmitButton");
  });

  it("makes fulfillment timeline and movement history operationally visible", () => {
    const ordersPage = source("app/warehouse/orders/page.tsx");
    const movementsPage = source("app/warehouse/movements/page.tsx");

    expect(ordersPage).toContain("data-fulfillment-timeline");
    expect(ordersPage).toContain("order.timeline");
    expect(ordersPage).toContain("data-order-product-picker");
    expect(ordersPage).not.toContain("Order items JSON");
    expect(ordersPage).not.toContain("Shipment tracking JSON");
    expect(movementsPage).toContain("data-movement-audit-feed");
    expect(movementsPage).toContain("data-recent-activity-filter");
    expect(movementsPage).toContain('label: "Shipments"');
    expect(movementsPage).not.toContain('href: "/warehouse/orders"');
    expect(movementsPage).not.toContain('href: "/warehouse/fulfillment"');
    expect(movementsPage).toContain("related_order_id");
    expect(movementsPage).toContain("actor_user_id");
  });
});
