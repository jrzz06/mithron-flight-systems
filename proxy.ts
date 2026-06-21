import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import {
  canAccessProtectedPath,
  defaultPathForRole,
  isAdminProtectedPath,
  isAuthPublicPath,
  isStrictAdminRole,
  normalizeCmsRole,
  sectionFromPath,
  shouldConfineRoleToControlPanel
} from "@/lib/auth/access-control";
import { buildContentSecurityPolicy, generateCspNonce } from "@/lib/csp";
import { isStorefrontGuestOnly } from "@/lib/storefront/guest-demo";
import { extractSecurityCorrelationId, recordSecurityEventFromMiddleware } from "@/services/security-observability";

const DEFAULT_SESSION_TIMEOUT_MINUTES = 60;

function applyRequestSecurityHeaders(request: NextRequest) {
  const nonce = generateCspNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  return { nonce, requestHeaders };
}

function withContentSecurityPolicy(response: NextResponse, nonce: string) {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  return response;
}

function secureNextResponse(request: NextRequest) {
  const { nonce, requestHeaders } = applyRequestSecurityHeaders(request);
  return withContentSecurityPolicy(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
}

function secureRedirectResponse(request: NextRequest, url: URL | string) {
  const { nonce } = applyRequestSecurityHeaders(request);
  return withContentSecurityPolicy(NextResponse.redirect(url), nonce);
}

async function redirectAfterSystemLogout(
  request: NextRequest,
  reason: "session_idle" | "session_revoked" | "disabled"
) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("logout_status", "signed_out");
  loginUrl.searchParams.set("logout_reason", reason);
  const redirectResponse = secureRedirectResponse(request, loginUrl);
  const supabase = createSupabaseOnRequest(request, redirectResponse);
  await supabase.auth.signOut();
  return redirectResponse;
}

function sessionTimeoutMs() {
  const configured = Number(process.env.SESSION_TIMEOUT_MINUTES ?? DEFAULT_SESSION_TIMEOUT_MINUTES);
  const minutes = Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_SESSION_TIMEOUT_MINUTES;
  return minutes * 60_000;
}

function createSupabaseOnRequest(request: NextRequest, response: NextResponse) {
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/_next/static")
    || pathname.startsWith("/_next/image")
    || pathname.startsWith("/favicon")
    || pathname === "/api/health"
  ) {
    return NextResponse.next();
  }

  if (isStorefrontGuestOnly()) {
    const guestBlockedPath =
      pathname === "/login"
      || pathname.startsWith("/forgot-password")
      || pathname.startsWith("/reset-password")
      || pathname.startsWith("/invite/")
      || pathname.startsWith("/account");
    if (guestBlockedPath) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      homeUrl.search = "";
      return secureRedirectResponse(request, homeUrl);
    }
  }

  const response = secureNextResponse(request);
  const supabase = createSupabaseOnRequest(request, response);
  const shouldProtect = isAdminProtectedPath(pathname) && !isAuthPublicPath(pathname);

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (!shouldProtect) {
    if (claims) {
      const claimsRole = normalizeCmsRole(claims.app_metadata?.role ?? claims.user_metadata?.role);
      const { data: dbRole, error: roleError } = await supabase.rpc("current_enterprise_role");
      const role = roleError ? claimsRole : normalizeCmsRole(dbRole);

      if (shouldConfineRoleToControlPanel(role, pathname)) {
        const panelUrl = request.nextUrl.clone();
        panelUrl.pathname = defaultPathForRole(role);
        panelUrl.searchParams.set("access_status", "control_panel_only");
        return secureRedirectResponse(request, panelUrl);
      }
    }

    return response;
  }

  const correlationId = extractSecurityCorrelationId(request.headers, "route");

  if (!claims) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const invalidJwt = Boolean(error);
    event.waitUntil(recordSecurityEventFromMiddleware(request, {
      correlationId,
      eventType: invalidJwt ? "security.invalid_jwt" : "security.auth_required",
      attemptedResource: `${pathname}${request.nextUrl.search}`,
      denialReason: invalidJwt
        ? `Invalid Supabase session: ${error?.message ?? "claims unavailable"}.`
        : "Protected route requires an authenticated Supabase session.",
      routePath: pathname,
      httpStatus: 401,
      severity: invalidJwt ? "warning" : "notice",
      source: "middleware",
      metadata: { section: sectionFromPath(pathname), auth_error: error?.message ?? null }
    }));
    const redirectResponse = secureRedirectResponse(request, loginUrl);
    redirectResponse.headers.set("x-correlation-id", correlationId);
    return redirectResponse;
  }

  const sessionIat = typeof claims.iat === "number" ? claims.iat : null;
  if (sessionIat && Date.now() - sessionIat * 1000 > sessionTimeoutMs()) {
    return redirectAfterSystemLogout(request, "session_idle");
  }

  const claimsRole = normalizeCmsRole(claims.app_metadata?.role ?? claims.user_metadata?.role);
  const { data: dbRole, error: roleError } = await supabase.rpc("current_enterprise_role");
  if (roleError) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("auth_status", "role_resolution_failed");
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    event.waitUntil(recordSecurityEventFromMiddleware(request, {
      correlationId,
      actorUserId: typeof claims.sub === "string" ? claims.sub : null,
      actorRole: claimsRole,
      eventType: "security.role_resolution_failed",
      attemptedResource: `${pathname}${request.nextUrl.search}`,
      denialReason: `Unable to resolve DB-backed enterprise role: ${roleError.message}.`,
      routePath: pathname,
      httpStatus: 403,
      severity: "critical",
      source: "middleware",
      metadata: { section: sectionFromPath(pathname), claims_role: claimsRole }
    }));
    const redirectResponse = secureRedirectResponse(request, loginUrl);
    redirectResponse.headers.set("x-correlation-id", correlationId);
    return redirectResponse;
  }

  const role = normalizeCmsRole(dbRole);
  const userId = typeof claims.sub === "string" ? claims.sub : null;

  if (userId) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("governance_status,session_revoked_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileRow?.governance_status === "disabled") {
      return redirectAfterSystemLogout(request, "disabled");
    }

    const revokedAt = profileRow?.session_revoked_at ? Date.parse(String(profileRow.session_revoked_at)) : NaN;
    if (sessionIat && Number.isFinite(revokedAt) && sessionIat * 1000 < revokedAt) {
      return redirectAfterSystemLogout(request, "session_revoked");
    }
  }

  if (shouldConfineRoleToControlPanel(role, pathname)) {
    const panelUrl = request.nextUrl.clone();
    panelUrl.pathname = defaultPathForRole(role);
    panelUrl.searchParams.set("access_status", "control_panel_only");
    return secureRedirectResponse(request, panelUrl);
  }

  const section = sectionFromPath(pathname);
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isStrictAdminRole(role)) {
      const roleHomeUrl = request.nextUrl.clone();
      roleHomeUrl.pathname = defaultPathForRole(role);
      roleHomeUrl.searchParams.set("admin_status", "forbidden");
      roleHomeUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
      event.waitUntil(recordSecurityEventFromMiddleware(request, {
        correlationId,
        actorUserId: typeof claims.sub === "string" ? claims.sub : null,
        actorRole: role,
        eventType: "security.admin_shell_denied",
        attemptedResource: `${pathname}${request.nextUrl.search}`,
        denialReason: `Role ${role ?? "anonymous"} cannot render the admin shell.`,
        routePath: pathname,
        httpStatus: 403,
        severity: "critical",
        source: "middleware",
        metadata: { section }
      }));
      const redirectResponse = secureRedirectResponse(request, roleHomeUrl);
      redirectResponse.headers.set("x-correlation-id", correlationId);
      return redirectResponse;
    }
  }

  if (!canAccessProtectedPath(role, pathname)) {
    const forbiddenUrl = request.nextUrl.clone();
    forbiddenUrl.pathname = defaultPathForRole(role);
    forbiddenUrl.searchParams.set("access_status", "forbidden");
    forbiddenUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    event.waitUntil(recordSecurityEventFromMiddleware(request, {
      correlationId,
      actorUserId: typeof claims.sub === "string" ? claims.sub : null,
      actorRole: role,
      eventType: "security.route_denied",
      attemptedResource: `${pathname}${request.nextUrl.search}`,
      denialReason: `Role ${role ?? "anonymous"} cannot access ${section}.`,
      routePath: pathname,
      httpStatus: 403,
      severity: "warning",
      source: "middleware",
      metadata: { section }
    }));
    const redirectResponse = secureRedirectResponse(request, forbiddenUrl);
    redirectResponse.headers.set("x-correlation-id", correlationId);
    return redirectResponse;
  }

  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export const config = {
  // Page routes are RBAC-gated here. Every /api/* route must enforce its own auth checks.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"]
};
