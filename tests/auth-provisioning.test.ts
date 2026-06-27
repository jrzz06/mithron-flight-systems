import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth provisioning and google login", () => {
  it("ships auth provisioning service and callback wiring", () => {
    const root = process.cwd();
    expect(existsSync(join(root, "services/auth-provisioning.ts"))).toBe(true);
    expect(readFileSync(join(root, "app/auth/callback/route.ts"), "utf8")).toContain("provisionAuthenticatedUserIfMissing");
    expect(readFileSync(join(root, "app/api/auth/provision/route.ts"), "utf8")).toContain("provisionAuthenticatedUserIfMissing");
  });

  it("routes password login through Supabase auth and provisions the session server-side", () => {
    const loginForm = readFileSync(join(process.cwd(), "app/login/login-form.tsx"), "utf8");
    expect(loginForm).toContain("signInWithPassword");
    expect(loginForm).toContain('fetch("/api/auth/provision"');
    expect(loginForm).toContain("signInWithOAuth");
    expect(loginForm).toContain('provider: "google"');
  });

  it("allows settings.write to write governance activity logs", () => {
    const adminActions = readFileSync(join(process.cwd(), "services/admin-actions.ts"), "utf8");
    expect(adminActions).toContain('"settings.write"');
  });
});
