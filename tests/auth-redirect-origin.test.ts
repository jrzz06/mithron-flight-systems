import { describe, expect, it } from "vitest";
import {
  buildAuthCallbackUrl,
  buildPasswordResetUrl,
  resolveAuthRedirectUrlFromRequest,
  resolveRequestOrigin
} from "@/lib/auth/request-origin";
import { resolveClientAuthRedirectPath } from "@/lib/auth/redirects";
import {
  getSiteOrigin,
  hasConfiguredSiteUrl,
  isObsoleteAppHost,
  sanitizeAppOrigin
} from "@/lib/site-url";

const CANONICAL_ORIGIN = "https://final-mithron-deploy.vercel.app";
const OBSOLETE_HOST = "mithron-flight-systems-kbkbkh.vercel.app";

describe("auth redirect origin resolution", () => {
  it("rejects obsolete deployment hosts", () => {
    expect(isObsoleteAppHost(OBSOLETE_HOST)).toBe(true);
    expect(sanitizeAppOrigin(`https://${OBSOLETE_HOST}`)).toBeNull();
    expect(
      getSiteOrigin({
        NEXT_PUBLIC_SITE_URL: `https://${OBSOLETE_HOST}`,
        VERCEL_PROJECT_PRODUCTION_URL: "final-mithron-deploy.vercel.app"
      })
    ).toBe(CANONICAL_ORIGIN);
  });

  it("prefers the active Vercel production URL over stale env values", () => {
    expect(
      getSiteOrigin({
        VERCEL_PROJECT_PRODUCTION_URL: "final-mithron-deploy.vercel.app",
        NEXT_PUBLIC_SITE_URL: `https://${OBSOLETE_HOST}`
      })
    ).toBe(CANONICAL_ORIGIN);
  });

  it("resolves auth callback URLs from the incoming request origin", () => {
    const request = new Request(`${CANONICAL_ORIGIN}/login`, {
      headers: {
        host: "final-mithron-deploy.vercel.app",
        "x-forwarded-host": "final-mithron-deploy.vercel.app",
        "x-forwarded-proto": "https"
      }
    });

    expect(resolveRequestOrigin(request)).toBe(CANONICAL_ORIGIN);
    expect(buildAuthCallbackUrl(resolveRequestOrigin(request), "/warehouse")).toBe(
      `${CANONICAL_ORIGIN}/auth/callback?next=%2Fwarehouse`
    );
    expect(buildPasswordResetUrl(resolveRequestOrigin(request))).toBe(
      `${CANONICAL_ORIGIN}/reset-password`
    );
  });

  it("falls back to request origin when client redirect targets an obsolete host", () => {
    const request = new Request(`${CANONICAL_ORIGIN}/api/auth/signup`, {
      headers: {
        host: "final-mithron-deploy.vercel.app",
        "x-forwarded-proto": "https"
      }
    });

    expect(
      resolveAuthRedirectUrlFromRequest(request, {
        clientRedirectTo: `https://${OBSOLETE_HOST}/auth/callback?next=/onboarding`,
        defaultPath: "/auth/callback",
        defaultNext: "/onboarding"
      })
    ).toBe(`${CANONICAL_ORIGIN}/auth/callback?next=%2Fonboarding`);
  });

  it("only allows relative client redirects after login", () => {
    expect(resolveClientAuthRedirectPath("/warehouse")).toBe("/warehouse");
    expect(resolveClientAuthRedirectPath(`${CANONICAL_ORIGIN}/admin`)).toBe("/account");
    expect(resolveClientAuthRedirectPath("//evil.example/admin")).toBe("/account");
  });

  it("accepts Vercel deployment URLs as configured site URLs", () => {
    expect(
      hasConfiguredSiteUrl({
        VERCEL_PROJECT_PRODUCTION_URL: "final-mithron-deploy.vercel.app"
      })
    ).toBe(true);
  });
});
