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
    expect(supplierActions).not.toContain("ensureProductInventoryRecord");
    expect(supplierActions).not.toContain("ensureWarehouseStockRecord");
    expect(supplierActions).not.toContain("warehouse.write");
  });

  it("limits supplier edits to owned draft or rejected products", () => {
    const supplierActions = readFileSync(join(root, "services/supplier-actions.ts"), "utf8");

    expect(supplierActions).toContain("Supplier cannot modify products they do not own.");
    expect(supplierActions).toContain('["draft", "rejected"]');
    expect(supplierActions).not.toContain('["draft", "pending_review", "rejected"]');
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

  it("locks supplier edit UI while products are pending review", () => {
    const editPage = readFileSync(join(root, "app/supplier/products/[slug]/edit/page.tsx"), "utf8");
    expect(editPage).toContain('const canEdit = ["draft", "rejected"]');
    expect(editPage).not.toContain('["draft", "pending_review", "rejected"]');
    expect(editPage).toContain("supplierStatusExplanation");
    expect(editPage).toContain("You cannot edit this product while it is being reviewed.");
    expect(editPage).toContain("description_json");
  });

  it("uses a single product description field in supplier and admin editors", () => {
    const supplierCreateForm = readFileSync(join(root, "components/supplier/supplier-new-product-form.tsx"), "utf8");
    const supplierEditForm = readFileSync(join(root, "components/supplier/supplier-edit-product-form.tsx"), "utf8");
    const supplierActions = readFileSync(join(root, "app/supplier/products/actions.ts"), "utf8");
    const adminCreateFields = readFileSync(join(root, "app/admin/products/product-create-detail-fields.tsx"), "utf8");
    const adminEditDialog = readFileSync(join(root, "app/admin/products/product-detail-edit-dialog.tsx"), "utf8");

    expect(supplierCreateForm).toContain('jsonName="description_json"');
    expect(supplierEditForm).toContain('jsonName="description_json"');
    expect(supplierCreateForm).not.toContain("tagline");
    expect(supplierEditForm).not.toContain("tagline");
    expect(supplierCreateForm).not.toContain("Short description");
    expect(supplierActions).toContain("readSupplierProductDescriptionFields");
    expect(supplierActions).not.toContain("tagline || name");
    expect(adminCreateFields).toContain('jsonName="description_json"');
    expect(adminEditDialog).toContain('jsonName="description_json"');
    expect(adminCreateFields).not.toContain("tagline");
    expect(adminEditDialog).not.toContain("tagline");
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
