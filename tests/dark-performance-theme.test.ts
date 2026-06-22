import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("light performance theme", () => {
  it("scopes the light operational palette to admin and warehouse control planes", () => {
    const globals = source("app/globals.css");
    const platformShell = source("components/platform/platform-shell.tsx");
    const productsPage = source("app/admin/products/page.tsx");

    expect(globals).toContain("[data-control-plane-theme=\"light\"]");
    expect(globals).toContain("--platform-bg: #f5f7fa");
    expect(platformShell).toContain('data-control-plane-theme="light"');
    expect(productsPage).toContain("platformFieldClass");
    expect(globals).not.toContain("Global dark performance pass");
  });

  it("keeps admin products and CMS on compact light surfaces without blur-heavy modals", () => {
    const productsPage = source("app/admin/products/page.tsx");
    const cmsPage = source("app/admin/cms/page.tsx");

    expect(productsPage).toContain("var(--platform-border)");
    expect(cmsPage).toContain("HomepageCmsEditor");
    expect(productsPage).not.toContain("bg-white/[0.055]");
  });
});
