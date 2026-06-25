import { cache } from "react";
import { redirect } from "next/navigation";
import { authorizeRoute, defaultPathForRole, isStrictAdminRole } from "@/lib/auth/access-control";
import { assertRolePermission, PermissionDeniedError, normalizeCmsRole, type EnterprisePermission } from "@/lib/auth/permissions";
import { ProfileDisabledError } from "@/lib/auth/profile-disabled";
import { createClient } from "@/lib/server";
import { provisionAuthenticatedUserIfMissing } from "@/services/auth-provisioning";
import { recordSecurityEvent } from "@/services/security-observability";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AuthContext = {
  userId: string | null;
  role: ReturnType<typeof normalizeCmsRole>;
  claimsRole: ReturnType<typeof normalizeCmsRole>;
  disabled?: boolean;
};

async function resolveCurrentEnterpriseRole(supabase: SupabaseServerClient) {
  const { data, error } = await supabase.rpc("current_enterprise_role");

  if (error) {
    console.warn("[mithron-auth] Unable to resolve DB-backed enterprise role from Supabase.", error);
    return null;
  }

  return normalizeCmsRole(data);
}

async function resolveProfileGate(supabase: SupabaseServerClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("governance_status,session_revoked_at")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[mithron-auth] Unable to load profile gate.", error);
    return { blocked: false as const };
  }

  if (data?.governance_status === "disabled") {
    return { blocked: true as const, reason: "disabled" as const };
  }

  return { blocked: false as const, sessionRevokedAt: data?.session_revoked_at as string | null | undefined };
}

export const getCurrentCmsRole = cache(async () => {
  const context = await getCurrentAuthContext();
  return context.role;
});

export const getCurrentAuthContext = cache(async (): Promise<AuthContext> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    return {
      userId: null,
      role: null,
      claimsRole: null
    };
  }

  const userId = typeof data.claims.sub === "string" ? data.claims.sub : null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  const claimsRole = normalizeCmsRole(data.claims.app_metadata?.role ?? data.claims.user_metadata?.role);

  if (userId) {
    const gate = await resolveProfileGate(supabase, userId);
    if (gate.blocked) {
      return { userId: null, role: null, claimsRole, disabled: true };
    }

    const sessionIat = typeof data.claims.iat === "number" ? data.claims.iat : null;
    if (sessionIat && gate.sessionRevokedAt) {
      const revokedMs = Date.parse(gate.sessionRevokedAt);
      if (Number.isFinite(revokedMs) && sessionIat * 1000 < revokedMs) {
        return { userId: null, role: null, claimsRole, disabled: true };
      }
    }
  }

  let role = await resolveCurrentEnterpriseRole(supabase);

  if (!role && userId) {
    try {
      await provisionAuthenticatedUserIfMissing({
        userId,
        email,
        preferredRole: "user"
      });
      role = await resolveCurrentEnterpriseRole(supabase);
    } catch (provisionError) {
      if (provisionError instanceof ProfileDisabledError) {
        return { userId: null, role: null, claimsRole, disabled: true };
      }
      console.warn("[mithron-auth] Failed to auto-provision authenticated user access.", provisionError);
    }
  }

  return {
    userId,
    role,
    claimsRole
  };
});

export async function requireActiveSession() {
  const context = await getCurrentAuthContext();
  if (context.disabled || !context.userId) {
    throw new PermissionDeniedError("Authentication required.");
  }
  return context;
}

export async function requirePermission(permission: EnterprisePermission) {
  const context = await getCurrentAuthContext();
  if (context.disabled) {
    throw new ProfileDisabledError();
  }
  try {
    assertRolePermission(context.role, permission);
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      await recordSecurityEvent({
        actorUserId: context.userId,
        actorRole: context.role,
        eventType: "security.permission_denied",
        attemptedResource: permission,
        denialReason: error.message,
        httpStatus: context.userId ? 403 : 401,
        severity: "warning",
        source: "server-action",
        metadata: {
          required_permission: permission,
          claims_role: context.claimsRole
        }
      }).catch((securityError) => console.error("[mithron-security] Failed to log permission denial.", securityError));
    }
    throw error;
  }
  return context;
}

export async function assertRouteAccessOrRedirect(pathname: string) {
  const context = await getCurrentAuthContext();
  const authorization = authorizeRoute(context.role, pathname, { userId: context.userId });

  if (!authorization.allowed) {
    await recordSecurityEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      eventType: authorization.eventType,
      attemptedResource: pathname,
      denialReason: authorization.reason,
      routePath: pathname,
      httpStatus: authorization.httpStatus,
      severity: authorization.eventType === "security.admin_shell_denied" ? "critical" : "warning",
      source: "route-guard",
      metadata: {
        claims_role: context.claimsRole
      }
    }).catch((error) => console.error("[mithron-security] Failed to log route denial.", error));

    const destination = authorization.httpStatus === 401
      ? `/login?next=${encodeURIComponent(pathname)}`
      : `${defaultPathForRole(context.role)}?${authorization.eventType === "security.admin_shell_denied" ? "admin_status" : "access_status"}=forbidden&next=${encodeURIComponent(pathname)}`;
    redirect(destination);
  }

  return context;
}

export async function requireRouteAccess(pathname: string) {
  const context = await getCurrentAuthContext();
  const authorization = authorizeRoute(context.role, pathname, { userId: context.userId });

  if (!authorization.allowed) {
    await recordSecurityEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      eventType: authorization.eventType,
      attemptedResource: pathname,
      denialReason: authorization.reason,
      routePath: pathname,
      httpStatus: authorization.httpStatus,
      severity: authorization.eventType === "security.admin_shell_denied" ? "critical" : "warning",
      source: "route-guard",
      metadata: {
        claims_role: context.claimsRole
      }
    }).catch((error) => console.error("[mithron-security] Failed to log route denial.", error));
    throw new PermissionDeniedError(authorization.reason);
  }

  return context;
}

export async function requireAdminPermission(permission: EnterprisePermission) {
  const context = await requirePermission(permission);
  if (!isStrictAdminRole(context.role)) {
    const error = new PermissionDeniedError(`Admin role required for ${permission}.`);
    await recordSecurityEvent({
      actorUserId: context.userId,
      actorRole: context.role,
      eventType: "security.permission_denied",
      attemptedResource: permission,
      denialReason: error.message,
      httpStatus: 403,
      severity: "warning",
      source: "server-action",
      metadata: {
        required_permission: permission,
        required_role: "admin",
        claims_role: context.claimsRole
      }
    }).catch((securityError) => console.error("[mithron-security] Failed to log admin permission denial.", securityError));
    throw error;
  }
  return context;
}
