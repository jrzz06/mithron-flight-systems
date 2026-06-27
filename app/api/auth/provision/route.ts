import { NextResponse } from "next/server";
import { mapAuthErrorForClient } from "@/lib/auth/client-errors";
import { ProfileDisabledError } from "@/lib/auth/profile-disabled";
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { createClient } from "@/lib/server";
import { resolveInviteRoleForUser } from "@/services/auth-invite";
import { provisionAuthenticatedUserIfMissing } from "@/services/auth-provisioning";

type ProvisionRequestBody = {
  next?: unknown;
};

export async function POST(request: Request) {
  const rateKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const limit = await checkDistributedRateLimit(`auth-provision:${rateKey}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as ProvisionRequestBody;
  const nextPath = typeof body.next === "string" ? body.next : "";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const user = data.user;
    const inviteToken = typeof user.user_metadata?.invite_token === "string" ? user.user_metadata.invite_token : null;
    const invitedRole = typeof user.user_metadata?.invited_role === "string" ? user.user_metadata.invited_role : null;
    const inviteRole = await resolveInviteRoleForUser({
      userId: user.id,
      email: user.email ?? "",
      inviteToken,
      invitedRole
    }).catch(() => null);

    const provisioned = await provisionAuthenticatedUserIfMissing({
      userId: user.id,
      email: user.email,
      emailConfirmedAt: user.email_confirmed_at ?? null,
      displayName: typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : user.email,
      preferredRole: inviteRole ?? "user"
    });

    const { data: role, error: roleError } = await supabase.rpc("current_enterprise_role");
    if (roleError || !role) {
      console.error("[mithron-auth] Role resolution failed during provision.", roleError);
      return NextResponse.json({ error: mapAuthErrorForClient("role could not be loaded") }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      provisioned: Boolean(provisioned),
      role,
      redirectPath: resolvePostAuthRedirect({ user, role, nextPath })
    });
  } catch (provisionError) {
    if (provisionError instanceof ProfileDisabledError) {
      await supabase.auth.signOut();
      return NextResponse.json({ error: mapAuthErrorForClient(provisionError) }, { status: 403 });
    }

    console.error("[mithron-auth] Provisioning failed.", provisionError);
    return NextResponse.json({ error: mapAuthErrorForClient(provisionError) }, { status: 500 });
  }
}
