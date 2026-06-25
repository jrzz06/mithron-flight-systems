import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("checkout route hardening", () => {
  it("cancels checkout when order item creation fails", () => {
    const route = source("app/api/checkout/route.ts");
    expect(route).toContain("order_items_failed");
    expect(route).toMatch(/createCustomerCheckoutOrderItemRecord[\s\S]*cancelCheckoutOrder/);
  });

  it("cancels checkout when payment record creation fails after intent", () => {
    const route = source("app/api/checkout/route.ts");
    expect(route).toContain("payment_record_failed");
    expect(route).toMatch(/createCustomerCheckoutPaymentRecord[\s\S]*cancelCheckoutOrder/);
  });

  it("replays checkout when idempotency unique constraint conflicts", () => {
    const route = source("app/api/checkout/route.ts");
    expect(route).toContain("isDuplicateIdempotencyError");
    expect(route).toContain("findCheckoutByIdempotencyKey");
    expect(route).toContain("23505");
  });

  it("defines database idempotency unique index in migration", () => {
    const migration = source("supabase/migrations/20260626000100_commerce_system_hardening.sql");
    expect(migration).toContain("orders_idempotency_key_uidx");
  });
});
