import { createClient as createSupabaseServiceClient } from "@supabase/supabase-js";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { ProfileDisabledError } from "@/lib/auth/profile-disabled";
import { normalizeCmsRole, type CmsRole } from "@/lib/auth/permissions";

type EnvSource = Record<string, string | undefined>;

const canonicalRoleRows: Record<CmsRole, { label: string; description: string; sort_order: number }> = {
  admin: {
    label: "Admin",
    description: "Full admin, CMS, product, media, order, warehouse, settings, and audit access.",
    sort_order: 1
  },
  warehouse: {
    label: "Warehouse",
    description: "Inventory, shipment, stock, and order-fulfillment access.",
    sort_order: 2
  },
  supplier: {
    label: "Supplier",
    description: "Submit and manage own products pending admin approval.",
    sort_order: 3
  },
  user: {
    label: "User",
    description: "Storefront customer access with orders, enquiries, and profile.",
    sort_order: 4
  }
};

function serviceClient(env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  return createSupabaseServiceClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

export async function ensureAllCanonicalRoles(env: EnvSource = process.env) {
  const supabase = serviceClient(env);
  for (const [key, row] of Object.entries(canonicalRoleRows) as Array<[CmsRole, (typeof canonicalRoleRows)[CmsRole]]>) {
    const { error } = await supabase.from("roles").upsert({ key, ...row }, { onConflict: "key" });
    if (error) {
      throw new Error(`Failed to ensure role ${key}: ${error.message}`);
    }
  }
}

export async function provisionAuthenticatedUser(input: {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  preferredRole?: string | null;
  actorId?: string | null;
}, env: EnvSource = process.env) {
  const userId = input.userId.trim();
  if (!userId) throw new Error("Authenticated user provisioning requires a user id.");

  await ensureAllCanonicalRoles(env);
  const supabase = serviceClient(env);
  const authUser = await supabase.auth.admin.getUserById(userId);
  if (authUser.error || !authUser.data.user) {
    throw new Error(`Failed to load auth user ${userId}: ${authUser.error?.message ?? "missing user"}`);
  }

  const user = authUser.data.user;
  const email = (input.email ?? user.email ?? "").trim().toLowerCase();

  const { data: existingProfile, error: existingProfileError } = await supabase
    .from("profiles")
    .select("governance_status")
    .eq("id", userId)
    .maybeSingle();
  if (existingProfileError) {
    throw new Error(`Failed to inspect profile for ${userId}: ${existingProfileError.message}`);
  }
  if (existingProfile?.governance_status === "disabled") {
    throw new ProfileDisabledError();
  }

  const metadataRole = normalizeCmsRole(
    input.preferredRole ?? "user"
  ) ?? "user";
  const displayName = input.displayName?.trim()
    || (typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : null)
    || (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null)
    || email
    || "Mithron user";
  const now = new Date().toISOString();

  const { data: existingRoles, error: rolesError } = await supabase
    .from("user_roles")
    .select("role_key")
    .eq("user_id", userId);
  if (rolesError) {
    throw new Error(`Failed to read user roles for ${userId}: ${rolesError.message}`);
  }

  const roleKeys = (existingRoles ?? [])
    .map((row) => normalizeCmsRole(row.role_key))
    .filter(Boolean) as CmsRole[];
  const explicitRole = input.preferredRole ? normalizeCmsRole(input.preferredRole) : null;
  const assignedRole = explicitRole ?? roleKeys[0] ?? metadataRole;

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: email || null,
      display_name: displayName,
      default_role: assignedRole,
      governance_status: "active",
      updated_at: now
    },
    { onConflict: "id" }
  );
  if (profileError) {
    throw new Error(`Failed to upsert profile for ${userId}: ${profileError.message}`);
  }

  if (explicitRole) {
    const { error: clearRolesError } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (clearRolesError) {
      throw new Error(`Failed to reset roles for ${userId}: ${clearRolesError.message}`);
    }
  }

  if (explicitRole || !roleKeys.length) {
    const { error: userRoleError } = await supabase.from("user_roles").upsert(
      { user_id: userId, role_key: assignedRole },
      { onConflict: "user_id,role_key" }
    );
    if (userRoleError) {
      throw new Error(`Failed to assign role ${assignedRole} to ${userId}: ${userRoleError.message}`);
    }
  }

  const existingAppRole = normalizeCmsRole(user.app_metadata?.role);
  if (existingAppRole !== assignedRole) {
    const { error: metadataError } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: {
        ...(user.app_metadata ?? {}),
        role: assignedRole,
        governance_status: "active"
      }
    });
    if (metadataError) {
      throw new Error(`Failed to sync auth metadata for ${userId}: ${metadataError.message}`);
    }
  }

  return { userId, email, role: assignedRole };
}

export async function provisionAuthenticatedUserIfMissing(input: {
  userId: string;
  email?: string | null;
  displayName?: string | null;
  preferredRole?: string | null;
}, env: EnvSource = process.env) {
  const supabase = serviceClient(env);
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,governance_status")
    .eq("id", input.userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to inspect profile for ${input.userId}: ${error.message}`);
  }

  if (profile?.governance_status === "disabled") {
    throw new ProfileDisabledError();
  }

  const { count, error: roleCountError } = await supabase
    .from("user_roles")
    .select("role_key", { count: "exact", head: true })
    .eq("user_id", input.userId);
  if (roleCountError) {
    throw new Error(`Failed to inspect user roles for ${input.userId}: ${roleCountError.message}`);
  }

  if (profile && (count ?? 0) > 0 && profile.governance_status !== "disabled") {
    return null;
  }

  return provisionAuthenticatedUser(input, env);
}
