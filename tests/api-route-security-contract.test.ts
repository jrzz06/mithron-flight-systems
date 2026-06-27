import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

type RouteSecurityCategory =
  | "public_rate_limited"
  | "session_auth"
  | "bearer_secret"
  | "staff_bearer_jwt"
  | "token_auth"
  | "dev_only"
  | "health";

const ROUTE_CATEGORIES: Record<string, RouteSecurityCategory> = {
  "app/api/client-verification/route.ts": "public_rate_limited",
  "app/api/catalog/search/route.ts": "public_rate_limited",
  "app/api/checkout/route.ts": "public_rate_limited",
  "app/api/checkout/enquiry/route.ts": "public_rate_limited",
  "app/api/enquiries/route.ts": "public_rate_limited",
  "app/api/auth/login/route.ts": "public_rate_limited",
  "app/api/auth/audit/route.ts": "public_rate_limited",
  "app/api/csp-report/route.ts": "public_rate_limited",
  "app/api/payments/webhooks/[provider]/route.ts": "public_rate_limited",
  "app/api/account/addresses/route.ts": "session_auth",
  "app/api/notifications/route.ts": "session_auth",
  "app/api/payments/intent/route.ts": "session_auth",
  "app/api/auth/provision/route.ts": "session_auth",
  "app/api/admin/prune-logs/route.ts": "bearer_secret",
  "app/api/admin/archive-movements/route.ts": "bearer_secret",
  "app/api/admin/customers/lookup/route.ts": "session_auth",
  "app/api/notifications/dispatch/route.ts": "bearer_secret",
  "app/api/payments/expire-pending/route.ts": "bearer_secret",
  "app/api/security/denials/route.ts": "staff_bearer_jwt",
  "app/api/upload/route.ts": "token_auth",
  "app/api/dev/load-test/route.ts": "dev_only",
  "app/api/health/route.ts": "health"
};

const CATEGORY_REQUIREMENTS: Record<RouteSecurityCategory, RegExp[]> = {
  public_rate_limited: [/checkDistributedRateLimit/],
  session_auth: [/getClaims|getUser/, /checkDistributedRateLimit/],
  bearer_secret: [/authorizeBearerSecret|safeBearerEquals/],
  staff_bearer_jwt: [/getUser\(/, /checkDistributedRateLimit/],
  token_auth: [/safeTokenEquals|safeBearerEquals/, /checkDistributedRateLimit/],
  dev_only: [/NODE_ENV\s*===\s*["']production["']/],
  health: [/safeBearerEquals|authorizeBearerSecret/]
};

function listApiRouteFiles(dir: string, root = dir): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...listApiRouteFiles(fullPath, root));
      continue;
    }
    if (entry === "route.ts") {
      files.push(relative(root, fullPath).replace(/\\/g, "/"));
    }
  }

  return files.sort();
}

describe("API route security contract", () => {
  it("classifies every app/api route with required security controls", () => {
    const root = process.cwd();
    const apiRoot = join(root, "app", "api");
    const routes = listApiRouteFiles(apiRoot, root);

    expect(routes.length).toBeGreaterThan(0);

    const unclassified = routes.filter((route) => !ROUTE_CATEGORIES[route]);
    expect(unclassified, `Unclassified API routes: ${unclassified.join(", ")}`).toEqual([]);

    for (const route of routes) {
      const category = ROUTE_CATEGORIES[route];
      const source = readFileSync(join(root, route), "utf8");
      const requirements = CATEGORY_REQUIREMENTS[category];

      for (const pattern of requirements) {
        expect(source, `${route} missing ${pattern}`).toMatch(pattern);
      }
    }
  });
});
