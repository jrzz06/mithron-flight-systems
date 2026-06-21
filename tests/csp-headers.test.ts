import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/csp";

describe("CSP headers", () => {
  it("configures enforcing CSP via proxy nonce and HSTS in next.config", () => {
    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    const proxy = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");
    const policy = buildContentSecurityPolicy("test-nonce");

    expect(config).not.toContain("Content-Security-Policy-Report-Only");
    expect(config).not.toContain("script-src");
    expect(config).toContain("Strict-Transport-Security");
    expect(proxy).toContain("buildContentSecurityPolicy");
    expect(proxy).toContain("generateCspNonce");
    expect(policy).toContain("checkout.razorpay.com");
    expect(policy).toContain("/api/csp-report");
    expect(policy).toContain("script-src 'self' 'nonce-test-nonce'");
    expect(policy).not.toContain("script-src 'self' 'unsafe-inline'");

    const devPolicy = buildContentSecurityPolicy("test-nonce", { NODE_ENV: "development" });
    expect(devPolicy).toContain("'unsafe-eval'");
    const prodPolicy = buildContentSecurityPolicy("test-nonce", { NODE_ENV: "production" });
    expect(prodPolicy).not.toContain("'unsafe-eval'");
  });
});
