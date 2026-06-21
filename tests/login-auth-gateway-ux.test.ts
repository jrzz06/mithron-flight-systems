import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("login auth gateway UX", () => {
  it("uses production sign-in language on the login page", () => {
    const page = source("app/login/page.tsx");

    expect(page).toContain("Sign in to Mithron");
    expect(page).toContain("Welcome back");
    expect(page).toContain("Sign in with your work email");
    expect(page).not.toContain("Authorized access");
    expect(page).not.toContain("Enter Mithron Control");
    expect(page).not.toContain("mission operations");
    expect(page).not.toContain("trustGrid");
  });

  it("renders the interactive login form without a non-interactive loading skeleton", () => {
    const page = source("app/login/page.tsx");
    const client = source("app/login/login-form-client.tsx");
    const form = source("app/login/login-form.tsx");

    expect(page).toContain("LoginFormClient");
    expect(page).not.toContain("isDemoAccessEnabled");
    expect(client).toContain("\"use client\"");
    expect(client).toContain("LoginForm");
    expect(client).not.toContain("dynamic(");
    expect(client).not.toContain("login-auth-form-loading");
    expect(form).toContain('type="email"');
    expect(form).toContain('type="password"');
  });

  it("keeps the Supabase role-aware authentication contract", () => {
    const form = source("app/login/login-form.tsx");
    const loginRoute = source("app/api/auth/login/route.ts");

    expect(form).not.toContain("demoAccessEnabled");
    expect(form).not.toContain("signInWithDemoAccount");
    expect(form).not.toContain("login-demo-access");
    expect(form).toContain('fetch("/api/auth/login"');
    expect(form).toContain("setRedirectTo");
    expect(form).toContain("window.location.assign");
    expect(form).toContain("toLowerCase");
    expect(form).toContain("aria-busy={busy}");
    expect(loginRoute).toContain("auth.failed_login");
    expect(loginRoute).toContain("auth.login");
    expect(loginRoute).toContain("current_enterprise_role");
    expect(loginRoute).toContain("getRoleAwareAuthRedirectPath");
  });

  it("keeps public demo login UI out of the production auth gateway", () => {
    const form = source("app/login/login-form.tsx");
    const page = source("app/login/page.tsx");
    const demoAccess = source("lib/auth/demo-access.ts");
    expect(form).not.toContain("Development access");
    expect(page).not.toContain("getDemoLoginAccounts");
    expect(demoAccess).toContain("ALLOW_DEMO_SEED");
    expect(demoAccess).not.toContain("NEXT_PUBLIC_ENABLE_DEMO_LOGIN");
  });

  it("defines production-grade custom input and CTA geometry", () => {
    const css = source("app/login/login.module.css");

    expect(css).toContain("grid-template-columns: minmax(0, 3fr) minmax(380px, 2fr)");
    expect(css).toContain(".authInput");
    expect(css).toContain("height: 56px");
    expect(css).toContain("box-shadow:");
    expect(css).toContain(".authSubmit");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
