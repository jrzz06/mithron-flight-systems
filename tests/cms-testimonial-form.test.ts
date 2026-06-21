import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProductReviewDraftFromFormData } from "@/services/cms-admin-forms";

function formData(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("product review CMS draft form", () => {
  it("maps product review form data into the registered product_reviews draft workflow input", () => {
    expect(buildProductReviewDraftFromFormData(formData({
      id: "review-atlas",
      reviewer_name: "Atlas Survey Systems",
      product_slug: "source-agri-kisan-drone-small-8-liter",
      body: "The workflow stays calm under load and the handoff to operations is predictable.",
      rating: "4.8",
      sort_order: "40",
      is_visible: "on",
      change_summary: "Draft product review from admin CMS form"
    }))).toEqual({
      table: "product_reviews",
      identity: {
        id: "review-atlas"
      },
      fields: {
        reviewer_name: "Atlas Survey Systems",
        product_slug: "source-agri-kisan-drone-small-8-liter",
        body: "The workflow stays calm under load and the handoff to operations is predictable.",
        rating: 4.8
      },
      entityId: "review-atlas",
      sortOrder: 40,
      isVisible: true,
      changeSummary: "Draft product review from admin CMS form"
    });
  });

  it("wires the draft-only product review form to the server action and admin page without changing storefront loaders", () => {
    const workspaceSource = readFileSync(join(process.cwd(), "features/admin/cms/cms-visual-workspace.tsx"), "utf8");
    const actionSource = readFileSync(join(process.cwd(), "app/admin/cms/actions.ts"), "utf8");

    expect(workspaceSource).toContain("saveProductReviewDraftFormAction");
    expect(workspaceSource).toContain("data-cms-table=\"product_reviews\"");
    expect(actionSource).toContain("buildProductReviewDraftFromFormData");
    expect(actionSource).toContain("saveProductReviewDraftFormAction");
    expect(actionSource).not.toContain("getPublicCmsSnapshot");
  });
});
