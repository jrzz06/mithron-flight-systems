import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canTransitionOrderStatus } from "@/services/orders";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("order workflow hardening", () => {
  it("defines timeline RPCs in migration", () => {
    const migration = source("supabase/migrations/20260626000300_order_timeline_atomic_transitions.sql");
    expect(migration).toContain("append_order_timeline_entry");
    expect(migration).toContain("transition_order_with_timeline");
    expect(migration).toContain("p_idempotency_key");
  });

  it("calls transition RPC with matching PostgREST parameter names", () => {
    const adminActions = source("services/admin-actions.ts");
    expect(adminActions).toContain("rpc/transition_order_with_timeline");
    expect(adminActions).toContain("p_order_id");
    expect(adminActions).toContain("p_entry");
    expect(adminActions).toContain("p_status");
    expect(adminActions).toContain("p_fulfillment_status");
    expect(adminActions).toContain("p_expected_updated_at");
    expect(adminActions).toContain("p_idempotency_key");
  });

  it("uses atomic workflow service for admin confirm and warehouse assign", () => {
    const actions = source("app/admin/orders/actions.ts");
    const workflow = source("services/order-workflow.ts");
    expect(actions).toContain("confirmAdminOrderWorkflow");
    expect(actions).toContain("assignOrderToWarehouseWorkflow");
    expect(actions).toContain("rejectAdminOrderWorkflow");
    expect(workflow).toContain("idempotencyKey");
    expect(workflow).toContain("notifyWarehouseAboutOrder");
  });

  it("allows admin review rejection transition", () => {
    expect(canTransitionOrderStatus("admin_review", "confirmed")).toBe(true);
    expect(canTransitionOrderStatus("admin_review", "cancelled")).toBe(true);
  });

  it("defaults delete workflow to soft delete and supports restore", () => {
    const workflow = source("services/order-workflow.ts");
    const actions = source("app/admin/orders/actions.ts");
    expect(workflow).toContain("softDeleteAdminOrderWorkflow");
    expect(workflow).toContain("restoreAdminOrderWorkflow");
    expect(workflow).toContain("permanentDeleteAdminOrderWorkflow");
    expect(workflow).toContain("return softDeleteAdminOrderWorkflow(input, env);");
    expect(actions).toContain("restoreAdminOrderFormAction");
    expect(actions).toContain("permanentDeleteAdminOrderFormAction");
  });
});
