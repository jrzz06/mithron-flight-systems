import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("admin and warehouse light operational palette", () => {
  it("scopes the premium light palette to control-plane routes only", () => {
    const globals = source("app/globals.css");
    const platformShell = source("components/platform/platform-shell.tsx");
    const controlShell = source("components/admin/control-shell.tsx");
    const warehouseLoading = source("app/warehouse/loading.tsx");

    expect(globals).toContain('[data-control-plane-theme="light"]');
    expect(globals).toContain("--platform-bg: #f5f7fa");
    expect(globals).toContain("--platform-surface: #ffffff");
    expect(globals).toContain("--platform-text-primary: #0f172a");
    expect(globals).toContain("--platform-accent: #0f766e");

    expect(platformShell).toContain('data-control-plane-theme="light"');
    expect(controlShell).toContain("data-control-shell-header");
    expect(warehouseLoading).not.toContain('data-control-plane-theme="dark"');

    expect(globals).not.toContain("body[data-control-plane-theme=\"dark\"]");
    expect(source("components/layout/store-shell.tsx")).not.toContain("data-control-plane-theme");
  });
});
