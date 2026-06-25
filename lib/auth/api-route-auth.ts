import { NextResponse } from "next/server";
import { PermissionDeniedError } from "@/lib/auth/permissions";
import {
  isControlPanelRole,
  isStrictAdminRole,
  resolveApiRoutePolicy,
  type ApiRoutePolicy
} from "@/lib/auth/access-control";
import { getCurrentAuthContext } from "@/services/auth";
import { recordSecurityEvent } from "@/services/security-observability";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function permissionStatus(error: PermissionDeniedError) {
  const message = error.message.toLowerCase();
  if (
    message.includes("not authenticated")
    || message.includes("authentication required")
    || message.includes("anonymous")
  ) {
    return 401;
  }
  return 403;
}

export async function guardApiRoute(pathname: string) {
  const policy = resolveApiRoutePolicy(pathname);
  if (!policy || policy.kind === "public" || policy.kind === "bearer" || policy.kind === "upload_token" || policy.kind === "session_or_guest") {
    return null;
  }

  const context = await getCurrentAuthContext();
  if (context.disabled || !context.userId) {
    await recordSecurityEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      eventType: "security.api_auth_required",
      attemptedResource: pathname,
      denialReason: "API route requires an authenticated session.",
      routePath: pathname,
      httpStatus: 401,
      severity: "notice",
      source: "api-route",
      metadata: { policy: policy.kind }
    }).catch((error) => console.error("[mithron-security] Failed to log API auth denial.", error));
    return jsonError("Authentication required.", 401);
  }

  if (policy.kind === "admin" && !isStrictAdminRole(context.role)) {
    await recordSecurityEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      eventType: "security.api_admin_denied",
      attemptedResource: pathname,
      denialReason: `Role ${context.role ?? "anonymous"} cannot access admin API ${pathname}.`,
      routePath: pathname,
      httpStatus: 403,
      severity: "warning",
      source: "api-route"
    }).catch((error) => console.error("[mithron-security] Failed to log admin API denial.", error));
    return jsonError("Access denied.", 403);
  }

  if (policy.kind === "staff" && !isControlPanelRole(context.role)) {
    await recordSecurityEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      eventType: "security.api_staff_denied",
      attemptedResource: pathname,
      denialReason: `Role ${context.role ?? "anonymous"} cannot access staff API ${pathname}.`,
      routePath: pathname,
      httpStatus: 403,
      severity: "warning",
      source: "api-route"
    }).catch((error) => console.error("[mithron-security] Failed to log staff API denial.", error));
    return jsonError("Access denied.", 403);
  }

  return null;
}

export async function guardApiRouteWithPermission(pathname: string, permission: Parameters<typeof import("@/services/auth").requirePermission>[0]) {
  const { requirePermission } = await import("@/services/auth");
  try {
    await requirePermission(permission);
    return null;
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return jsonError(error.message, permissionStatus(error));
    }
    return jsonError("Access denied.", 403);
  }
}

export type { ApiRoutePolicy };
