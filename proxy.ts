import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import {
  authorizeRoute,
  defaultPathForRole,
  isAdminProtectedPath,
  isAuthPublicPath,
  isStrictAdminRole,
  normalizeCmsRole,
  resolveApiRoutePolicy,
  sectionFromPath,
  shouldConfineRoleToControlPanel
} from "@/lib/auth/access-control";
import { buildContentSecurityPolicy, generateCspNonce } from "@/lib/csp";
import { isStorefrontGuestOnly } from "@/lib/storefront/guest-demo";
import { resolveSupabaseCookieOptions, resolveSupabasePublishableKey } from "@/lib/supabase/cookie-config";
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
  const publishableKey = resolveSupabasePublishableKey();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey,
    {
      cookieOptions: resolveSupabaseCookieOptions(),
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

function secureJsonResponse(request: NextRequest, body: Record<string, unknown>, status: number, correlationId?: string) {
  const { nonce } = applyRequestSecurityHeaders(request);
  const response = withContentSecurityPolicy(NextResponse.json(body, { status }), nonce);
  if (correlationId) response.headers.set("x-correlation-id", correlationId);
  return response;
}

async function resolveRequestRole(supabase: ReturnType<typeof createSupabaseOnRequest>, claims: Record<string, unknown>) {
  const appMetadata = claims.app_metadata;
  const userMetadata = claims.user_metadata;
  const claimsRole = normalizeCmsRole(
    (appMetadata && typeof appMetadata === "object" ? (appMetadata as Record<string, unknown>).role : null)
      ?? (userMetadata && typeof userMetadata === "object" ? (userMetadata as Record<string, unknown>).role : null)
  );
  const { data: dbRole, error: roleError } = await supabase.rpc("current_enterprise_role");
  if (roleError) {
    return { role: null as ReturnType<typeof normalizeCmsRole>, claimsRole, roleError };
  }
  return { role: normalizeCmsRole(dbRole), claimsRole, roleError: null };
}

async function validateActiveProfile(
  supabase: ReturnType<typeof createSupabaseOnRequest>,
  userId: string,
  sessionIat: number | null
) {
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("governance_status,session_revoked_at")
    .eq("id", userId)
    .maybeSingle();

  if (profileRow?.governance_status === "disabled") {
    return { blocked: true as const, reason: "disabled" as const };
  }

  const revokedAt = profileRow?.session_revoked_at ? Date.parse(String(profileRow.session_revoked_at)) : NaN;
  if (sessionIat && Number.isFinite(revokedAt) && sessionIat * 1000 < revokedAt) {
    return { blocked: true as const, reason: "session_revoked" as const };
  }

  return { blocked: false as const };
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;
  const authCode = request.nextUrl.searchParams.get("code");
  if (authCode && pathname !== "/auth/callback") {
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    return secureRedirectResponse(request, callbackUrl);
  }

  // OAuth PKCE exchange must run in the auth callback route without middleware
  // touching Supabase cookies first — otherwise code_verifier no longer matches.
  if (pathname === "/auth/callback") {
    return secureNextResponse(request);
  }

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
  const apiPolicy = resolveApiRoutePolicy(pathname);
  const shouldProtect = isAdminProtectedPath(pathname) && !isAuthPublicPath(pathname);

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (apiPolicy && apiPolicy.kind !== "public") {
    const correlationId = extractSecurityCorrelationId(request.headers, "api");
    if (apiPolicy.kind === "bearer" || apiPolicy.kind === "upload_token" || apiPolicy.kind === "session_or_guest") {
      return response;
    }

    if (!claims) {
      event.waitUntil(recordSecurityEventFromMiddleware(request, {
        correlationId,
        eventType: error ? "security.invalid_jwt" : "security.api_auth_required",
        attemptedResource: `${pathname}${request.nextUrl.search}`,
        denialReason: "API route requires an authenticated Supabase session.",
        routePath: pathname,
        httpStatus: 401,
        severity: error ? "warning" : "notice",
        source: "middleware",
        metadata: { api_policy: apiPolicy.kind, auth_error: error?.message ?? null }
      }));
      return secureJsonResponse(request, { error: "Authentication required." }, 401, correlationId);
    }

    const sessionIat = typeof claims.iat === "number" ? claims.iat : null;
    if (sessionIat && Date.now() - sessionIat * 1000 > sessionTimeoutMs()) {
      return redirectAfterSystemLogout(request, "session_idle");
    }

    const userId = typeof claims.sub === "string" ? claims.sub : null;
    if (userId) {
      const profileGate = await validateActiveProfile(supabase, userId, sessionIat);
      if (profileGate.blocked) {
        return redirectAfterSystemLogout(request, profileGate.reason);
      }
    }

    const roleResolution = await resolveRequestRole(supabase, claims);
    if (roleResolution.roleError || !roleResolution.role) {
      event.waitUntil(recordSecurityEventFromMiddleware(request, {
        correlationId,
        actorUserId: userId,
        actorRole: roleResolution.claimsRole,
        eventType: "security.role_resolution_failed",
        attemptedResource: `${pathname}${request.nextUrl.search}`,
        denialReason: `Unable to resolve DB-backed enterprise role: ${roleResolution.roleError?.message ?? "unknown"}.`,
        routePath: pathname,
        httpStatus: 403,
        severity: "critical",
        source: "middleware",
        metadata: { api_policy: apiPolicy.kind }
      }));
      return secureJsonResponse(request, { error: "Access denied." }, 403, correlationId);
    }

    if (apiPolicy.kind === "admin" && !isStrictAdminRole(roleResolution.role)) {
      event.waitUntil(recordSecurityEventFromMiddleware(request, {
        correlationId,
        actorUserId: userId,
        actorRole: roleResolution.role,
        eventType: "security.api_admin_denied",
        attemptedResource: `${pathname}${request.nextUrl.search}`,
        denialReason: `Role ${roleResolution.role} cannot access admin API.`,
        routePath: pathname,
        httpStatus: 403,
        severity: "warning",
        source: "middleware",
        metadata: { api_policy: apiPolicy.kind }
      }));
      return secureJsonResponse(request, { error: "Access denied." }, 403, correlationId);
    }

    if (apiPolicy.kind === "staff" && !["admin", "warehouse", "supplier"].includes(roleResolution.role)) {
      event.waitUntil(recordSecurityEventFromMiddleware(request, {
        correlationId,
        actorUserId: userId,
        actorRole: roleResolution.role,
        eventType: "security.api_staff_denied",
        attemptedResource: `${pathname}${request.nextUrl.search}`,
        denialReason: `Role ${roleResolution.role} cannot access staff API.`,
        routePath: pathname,
        httpStatus: 403,
        severity: "warning",
        source: "middleware",
        metadata: { api_policy: apiPolicy.kind }
      }));
      return secureJsonResponse(request, { error: "Access denied." }, 403, correlationId);
    }

    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

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

  const userId = typeof claims.sub === "string" ? claims.sub : null;

  if (userId) {
    const profileGate = await validateActiveProfile(supabase, userId, sessionIat);
    if (profileGate.blocked) {
      return redirectAfterSystemLogout(request, profileGate.reason);
    }
  }

  const roleResolution = await resolveRequestRole(supabase, claims);
  if (roleResolution.roleError || !roleResolution.role) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("auth_status", "role_resolution_failed");
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    event.waitUntil(recordSecurityEventFromMiddleware(request, {
      correlationId,
      actorUserId: userId,
      actorRole: roleResolution.claimsRole,
      eventType: "security.role_resolution_failed",
      attemptedResource: `${pathname}${request.nextUrl.search}`,
      denialReason: `Unable to resolve DB-backed enterprise role: ${roleResolution.roleError?.message ?? "unknown"}.`,
      routePath: pathname,
      httpStatus: 403,
      severity: "critical",
      source: "middleware",
      metadata: { section: sectionFromPath(pathname), claims_role: roleResolution.claimsRole }
    }));
    const redirectResponse = secureRedirectResponse(request, loginUrl);
    redirectResponse.headers.set("x-correlation-id", correlationId);
    return redirectResponse;
  }

  const role = roleResolution.role;

  if (shouldConfineRoleToControlPanel(role, pathname)) {
    const panelUrl = request.nextUrl.clone();
    panelUrl.pathname = defaultPathForRole(role);
    panelUrl.searchParams.set("access_status", "control_panel_only");
    return secureRedirectResponse(request, panelUrl);
  }

  const authorization = authorizeRoute(role, pathname, { userId });
  if (!authorization.allowed) {
    const forbiddenUrl = request.nextUrl.clone();
    forbiddenUrl.pathname = authorization.redirectPath;
    if (authorization.httpStatus === 403) {
      forbiddenUrl.searchParams.set(
        authorization.eventType === "security.admin_shell_denied" ? "admin_status" : "access_status",
        "forbidden"
      );
      forbiddenUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    }
    event.waitUntil(recordSecurityEventFromMiddleware(request, {
      correlationId,
      actorUserId: userId,
      actorRole: role,
      eventType: authorization.eventType,
      attemptedResource: `${pathname}${request.nextUrl.search}`,
      denialReason: authorization.reason,
      routePath: pathname,
      httpStatus: authorization.httpStatus,
      severity: authorization.eventType === "security.admin_shell_denied" ? "critical" : "warning",
      source: "middleware",
      metadata: { section: sectionFromPath(pathname) }
    }));
    const redirectResponse = secureRedirectResponse(request, forbiddenUrl);
    redirectResponse.headers.set("x-correlation-id", correlationId);
    return redirectResponse;
  }

  response.headers.set("x-correlation-id", correlationId);
  return response;
}

export const config = {
  // Page and API routes are RBAC-gated here. Bearer/upload routes still verify secrets in handlers.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"]
};
