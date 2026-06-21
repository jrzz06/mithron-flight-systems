import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("logout CSRF protection", () => {
  it("keeps POST logout and guidance-only GET redirects without GET sign-out", () => {
    const route = readFileSync(join(process.cwd(), "app/auth/logout/route.ts"), "utf8");
    expect(route).toContain("export async function POST");
    expect(route).toContain("export async function GET");
    expect(route).toContain("signOut");
    expect(route).toContain("logout_notice");
    expect(route).toContain("SYSTEM_LOGOUT_REASONS");
    expect(route).not.toMatch(/GET[\s\S]*performLogout/);
    expect(route).toContain("createLogoutClient");
  });

  it("uses POST forms for account and control panel logout buttons", () => {
    const accountLayout = readFileSync(join(process.cwd(), "app/(storefront)/account/layout.tsx"), "utf8");
    const adminNav = readFileSync(join(process.cwd(), "components/admin/admin-nav.tsx"), "utf8");
    const warehouseFrame = readFileSync(join(process.cwd(), "components/warehouse/warehouse-frame.tsx"), "utf8");
    const supplierFrame = readFileSync(join(process.cwd(), "components/supplier/supplier-frame.tsx"), "utf8");

    expect(accountLayout).toContain("LogoutForm");
    expect(readFileSync(join(process.cwd(), "components/auth/logout-form.tsx"), "utf8")).toContain('action="/auth/logout"');
    expect(accountLayout).not.toContain('href="/auth/logout"');
    expect(adminNav).toContain('action="/auth/logout"');
    expect(warehouseFrame).toContain('action="/auth/logout"');
    expect(warehouseFrame).not.toContain("hidden md:block");
    expect(supplierFrame).toContain('action="/auth/logout"');
    expect(supplierFrame).not.toContain("hidden md:block");
  });
});
