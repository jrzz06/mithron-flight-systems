import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("warehouse legacy route retirement", () => {
  it("retires the mixed fulfillment screen in favor of dedicated picking, packing, and dispatch flows", () => {
    const fulfillmentPage = source("app/warehouse/fulfillment/page.tsx");
    const actions = source("app/warehouse/actions.ts");
    const verifier = source("tools/verify-authenticated-warehouse-session.mjs");

    expect(fulfillmentPage).toContain('redirect("/warehouse/picking")');
    expect(fulfillmentPage).not.toContain("getWarehouseSnapshot");
    expect(fulfillmentPage).not.toContain("createShipmentFormAction");
    expect(fulfillmentPage).not.toContain("updateShipmentLifecycleFormAction");
    expect(fulfillmentPage).not.toContain("updateWarehouseOrderLifecycleFormAction");
    expect(fulfillmentPage).not.toContain("data-shipment-create-form");
    expect(fulfillmentPage).not.toContain("data-shipment-update-form");
    expect(fulfillmentPage).not.toContain("data-fulfillment-lifecycle-form");
    expect(actions).not.toContain('revalidatePath("/warehouse/fulfillment")');

    expect(verifier).not.toContain("/warehouse/fulfillment");
    expect(verifier).toContain("/warehouse/picking");
    expect(verifier).toContain("[data-picking-queue]");
  });
});
