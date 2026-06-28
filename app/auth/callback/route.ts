import { NextResponse, type NextRequest } from "next/server";
import { GUEST_AUTH_HOME } from "@/lib/auth/guest-auth";
import { resolveLoginPageRedirect } from "@/lib/auth/post-auth-redirect";
import { getSafeAuthRedirectPath } from "@/lib/auth/redirects";
import { createAuthRouteClient } from "@/lib/server";
import { resolveInviteRoleForUser } from "@/services/auth-invite";
import { provisionAuthenticatedUserIfMissing, syncGuestProfileFromIdentity } from "@/services/auth-provisioning";
import { recordAuthActivityEvent } from "@/services/security-observability";

function loginFailureRedirect(request: NextRequest, authError: string, nextPath: string) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("auth_error", authError);
  loginUrl.searchParams.set("next", nextPath);
  return loginUrl;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const oauthError = requestUrl.searchParams.get("error");
  const oauthErrorDescription = requestUrl.searchParams.get("error_description");
  const code = requestUrl.searchParams.get("code");
  const next = getSafeAuthRedirectPath(requestUrl.searchParams.get("next"), GUEST_AUTH_HOME);
  const { supabase, applySessionCookies } = await createAuthRouteClient();

  if (oauthError) {
    console.warn("[mithron-auth] OAuth callback error.", oauthError, oauthErrorDescription);
    return applySessionCookies(
      NextResponse.redirect(loginFailureRedirect(request, oauthError, next))
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.warn("[mithron-auth] OAuth code exchange failed.", {
        message: error.message,
        status: error.status,
        code: error.code
      });
      const failureUrl = loginFailureRedirect(request, "verification_failed", next);
      failureUrl.searchParams.delete("code");
      return applySessionCookies(
        NextResponse.redirect(failureUrl)
      );
    }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return applySessionCookies(
      NextResponse.redirect(loginFailureRedirect(request, "session_missing", next))
    );
  }

  const user = userData.user;
  const inviteToken = typeof user.user_metadata?.invite_token === "string"
    ? user.user_metadata.invite_token
    : requestUrl.searchParams.get("invite");
  const invitedRole = typeof user.user_metadata?.invited_role === "string"
    ? user.user_metadata.invited_role
    : null;

  const inviteRole = await resolveInviteRoleForUser({
    userId: user.id,
    email: user.email ?? "",
    inviteToken,
    invitedRole
  }).catch((error) => {
    console.warn("[mithron-auth] Invite resolution failed.", error);
    return null;
  });

  const displayName = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : user.email;

  await provisionAuthenticatedUserIfMissing({
    userId: user.id,
    email: user.email,
    displayName,
    preferredRole: inviteRole ?? "user"
  }).catch((error) => {
    console.warn("[mithron-auth] OAuth callback provisioning failed.", error);
  });

  await syncGuestProfileFromIdentity({
    userId: user.id,
    email: user.email,
    displayName
  }).catch((error) => {
    console.warn("[mithron-auth] OAuth profile sync failed.", error);
  });

  const { data: role, error: roleError } = await supabase.rpc("current_enterprise_role");
  if (roleError || !role) {
    return applySessionCookies(
      NextResponse.redirect(new URL("/login?auth_status=role_required", request.nextUrl.origin))
    );
  }

  const redirectPath = resolveLoginPageRedirect({ user, role, nextPath: next });

  await recordAuthActivityEvent({
    action: "auth.login",
    actorUserId: user.id,
    actorRole: role,
    sessionIdentifier: null,
    authProvider: "google",
    severity: "info",
    metadata: { email: user.email, user_id: user.id, provider: "google" }
  }, request).catch((error) => {
    console.warn("[mithron-auth] OAuth login audit failed.", error);
  });

  return applySessionCookies(
    NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin))
  );
}
