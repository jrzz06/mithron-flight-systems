import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("dark performance theme", () => {
  it("scopes the dark operational palette to admin and warehouse control planes", () => {
    const globals = source("app/globals.css");

    expect(globals).toContain("--surface-page: var(--bg-primary)");
    expect(globals).toContain("--bg-primary: #f1f4f7");
    expect(globals).toContain("--surface-card: #ffffff");
    expect(globals).toContain("[data-control-plane-theme=\"dark\"]");
    expect(globals).toContain("--admin-bg: #080b10");
    expect(globals).toContain("--admin-text: #e7edf5");
    expect(globals).toContain("[data-control-plane-theme=\"dark\"] [class*=\"backdrop-blur\"]");
    expect(globals).toContain("@media (prefers-reduced-motion: reduce)");
    expect(globals).toContain("[data-control-plane-theme=\"dark\"] [data-product-card]");
    expect(globals).toContain("content-visibility: auto");
    expect(globals).not.toContain("Global dark performance pass");
  });

  it("keeps admin products and CMS on compact dark surfaces without blur-heavy modals", () => {
    const grid = source("app/admin/products/product-catalog-grid.tsx");
    const cmsWorkspace = source("features/admin/cms/cms-visual-workspace.tsx");

    expect(grid).toContain("border-slate-800 bg-[#10151d]");
    expect(grid).toContain("shadow-none");
    expect(grid).not.toContain("hover:-translate-y-0.5");
    expect(grid).not.toContain("backdrop-blur-sm");
    expect(cmsWorkspace).toContain("data-cms-visual-editor");
    expect(cmsWorkspace).toContain("bg-[#10151d]");
    expect(cmsWorkspace).not.toContain("backdrop-blur");
  });
});

