import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { roleHasPermission } from "@/lib/auth/permissions";

const root = process.cwd();

describe("supplier workflow guards", () => {
  it("requires products.submit for supplier mutations", () => {
    const supplierActions = readFileSync(join(root, "services/supplier-actions.ts"), "utf8");

    expect(roleHasPermission("supplier", "products.submit")).toBe(true);
    expect(roleHasPermission("supplier", "products.write")).toBe(false);
    expect(supplierActions).toContain('requirePermission("products.submit")');
    expect(supplierActions).toContain("supplierProductMutationOptions");
    expect(supplierActions).toContain("provisionAuthenticatedUser");
    expect(supplierActions).toContain("ensureSupplierProfile");
  });

  it("limits supplier edits to owned draft, rejected, or pending review products", () => {
    const supplierActions = readFileSync(join(root, "services/supplier-actions.ts"), "utf8");

    expect(supplierActions).toContain("Supplier cannot modify products they do not own.");
    expect(supplierActions).toContain('["draft", "pending_review", "rejected"]');
    expect(supplierActions).toContain("submitSupplierProductForReview");
    expect(supplierActions).toContain('workflow_status: "pending_review"');
  });

  it("includes supplier ownership fields in admin product reads", () => {
    const adminActions = readFileSync(join(root, "services/admin-actions.ts"), "utf8");
    expect(adminActions).toContain("supplier_id,submitted_by,rejection_reason");
    expect(readFileSync(join(root, "app/supplier/products/actions.ts"), "utf8")).toContain("isActionNavigationError");
    expect(readFileSync(join(root, "services/supplier-actions.ts"), "utf8")).toContain("getSupplierOwnedProduct");
    expect(readFileSync(join(root, "services/supplier-actions.ts"), "utf8")).not.toContain("7692/ingest");
  });

  it("redirects supplier product actions with product_status feedback", () => {
    const actions = readFileSync(join(root, "app/supplier/products/actions.ts"), "utf8");
    expect(actions).toContain("supplierProductRedirect");
    expect(actions).toContain("product_status");
    expect(actions).toContain("if (isActionNavigationError(submitError)) throw submitError");
  });

  it("ships supplier portal routes and admin approval queue", () => {
    for (const route of [
      "app/supplier/layout.tsx",
      "app/supplier/products/actions.ts",
      "app/admin/suppliers/products/actions.ts"
    ]) {
      expect(existsSync(join(root, route))).toBe(true);
    }

    const approvalActions = readFileSync(join(root, "app/admin/suppliers/products/actions.ts"), "utf8");
    expect(approvalActions).toContain("approveProductSubmissionFormAction");
    expect(approvalActions).toContain("rejectProductSubmissionFormAction");
    expect(approvalActions).toContain("runSupplierApprovalAction");
    expect(approvalActions).toContain("approval_status");
  });
});
