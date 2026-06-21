import { NextResponse, type NextRequest } from "next/server";
import { getRoleAwareAuthRedirectPath, getSafeAuthRedirectPath } from "@/lib/auth/redirects";
import { createAuthRouteClient } from "@/lib/server";
import { resolveInviteRoleForUser } from "@/services/auth-invite";
import { provisionAuthenticatedUserIfMissing } from "@/services/auth-provisioning";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = getSafeAuthRedirectPath(requestUrl.searchParams.get("next"), "/account");
  const { supabase, applySessionCookies } = await createAuthRouteClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("auth_error", error.message);
      loginUrl.searchParams.set("next", next);
      return applySessionCookies(NextResponse.redirect(loginUrl));
    }
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("auth_error", userError?.message ?? "Authentication session missing.");
    loginUrl.searchParams.set("next", next);
    return applySessionCookies(NextResponse.redirect(loginUrl));
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

  await provisionAuthenticatedUserIfMissing({
    userId: user.id,
    email: user.email,
    displayName: typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name
      : typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : user.email,
    preferredRole: inviteRole ?? "user"
  }).catch((error) => {
    console.warn("[mithron-auth] OAuth callback provisioning failed.", error);
  });

  const { data: role, error: roleError } = await supabase.rpc("current_enterprise_role");
  const redirectPath = roleError
    ? "/login?auth_status=role_required"
    : getRoleAwareAuthRedirectPath(next, role);

  return applySessionCookies(
    NextResponse.redirect(new URL(redirectPath, request.nextUrl.origin))
  );
}
