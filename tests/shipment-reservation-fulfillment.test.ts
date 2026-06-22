import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("shipment reservation fulfillment", () => {
  it("fulfills checkout reservations instead of deducting available stock again", () => {
    const shipments = source("services/shipments.ts");
    expect(shipments).toContain("orderHasCheckoutReservations");
    expect(shipments).toContain("fulfillReservedStock");
    expect(shipments).toContain("if (!hasCheckoutReservation)");
    expect(shipments).toContain("if (hasCheckoutReservation)");
  });

  it("defines reservation probe and atomic inventory adjustment RPCs", () => {
    const migration = source("supabase/migrations/20260622160000_inventory_adjustment_rpc.sql");
    expect(migration).toContain("order_has_checkout_reservations");
    expect(migration).toContain("apply_inventory_adjustment");
    expect(migration).toContain("for update");
  });

  it("routes manual warehouse adjustments through the inventory RPC", () => {
    const movements = source("services/warehouse-movements.ts");
    expect(movements).toContain("apply_inventory_adjustment");
    expect(movements).toContain("applyInventoryAdjustmentRpc");
    expect(movements).toContain("expectedUpdatedAt?: string | null");
  });

  it("uses atomic checkout reservation for manual warehouse orders", () => {
    const actions = source("app/warehouse/actions.ts");
    expect(actions).toContain("reserveCheckoutStock");
    expect(actions).not.toContain("reasonCode: \"order_reservation\"");
  });
});
