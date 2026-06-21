import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("admin and warehouse dark operational palette", () => {
  it("scopes the premium dark palette to control-plane routes only", () => {
    const globals = source("app/globals.css");
    const adminFrame = source("components/admin/admin-frame.tsx");
    const controlShell = source("components/admin/control-shell.tsx");
    const warehouseLoading = source("app/warehouse/loading.tsx");

    expect(globals).toContain('[data-control-plane-theme="dark"]');
    expect(globals).toContain("--admin-bg: #080b10");
    expect(globals).toContain("--admin-surface: #0f141b");
    expect(globals).toContain("--admin-elevated: #151c26");
    expect(globals).toContain("--admin-muted: #0b1017");
    expect(globals).toContain("--admin-border: #253041");
    expect(globals).toContain("--admin-text: #e7edf5");
    expect(globals).toContain("--admin-subtle: #94a3b8");
    expect(globals).toContain("--admin-accent: #34d399");
    expect(globals).toContain('[data-control-plane-theme="dark"] [class*="backdrop-blur"]');
    expect(globals).toContain("backdrop-filter: none !important");
    expect(globals).toContain("content-visibility: auto");

    expect(adminFrame).toContain("data-control-plane-theme=\"dark\"");
    expect(adminFrame).toContain("bg-[#070B14]");
    expect(adminFrame).toContain("bg-[#0A101A]");
    expect(controlShell).toContain("data-control-plane-theme=\"dark\"");
    expect(controlShell).toContain("bg-[#070B14]");
    expect(warehouseLoading).toContain("data-control-plane-theme=\"dark\"");
    expect(source("app/operations/page.tsx")).toContain("scope=\"operations\"");
    expect(source("app/operations/orders/page.tsx")).toContain("scope=\"operations\"");

    expect(globals).not.toContain("body[data-control-plane-theme=\"dark\"]");
    expect(source("components/layout/store-shell.tsx")).not.toContain("data-control-plane-theme");
  });
});
