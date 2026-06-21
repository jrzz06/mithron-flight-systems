import { createClient as createSupabaseServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertSupabaseAdminConfig } from "@/lib/env";
import {
  assertDemoSeedingConfigured,
  listDemoAccessAccounts,
  resolveDemoPasswordForRole
} from "@/services/demo-access-accounts";
import { ensureAllCanonicalRoles, provisionAuthenticatedUser } from "@/services/auth-provisioning";

type EnvSource = Record<string, string | undefined>;

async function findAuthUserByEmail(supabase: SupabaseClient, email: string) {
  const normalizedEmail = email.toLowerCase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle() as { data: { id: string } | null };

  if (profile?.id) {
    const authUser = await supabase.auth.admin.getUserById(profile.id);
    if (authUser.data.user) return authUser.data.user;
  }

  for (let page = 1; page <= 3; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Failed to list auth users: ${error.message}`);
    const match = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

async function verifyCredentials(email: string, password: string, env: EnvSource) {
  const config = assertSupabaseAdminConfig(env);
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publishableKey) throw new Error("Missing Supabase publishable key.");

  const verifier = createSupabaseServiceClient(config.url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Demo login verification failed for ${email}: ${error.message}`);
}

export async function seedDemoAuthAccounts(env: EnvSource = process.env) {
  assertDemoSeedingConfigured(env);
  const config = assertSupabaseAdminConfig(env);
  const supabase = createSupabaseServiceClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  await ensureAllCanonicalRoles(env);
  const results: Array<{ email: string; role: string; action: "created" | "updated" }> = [];
  const accounts = await listDemoAccessAccounts(env);

  for (const account of accounts) {
    const password = resolveDemoPasswordForRole(account.role, env);
    if (!password) {
      throw new Error(`Missing password env for ${account.role} demo account.`);
    }
    const email = account.email.toLowerCase();
    const existing = await findAuthUserByEmail(supabase, email);
    let userId = existing?.id ?? null;

    if (existing) {
      const updated = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        app_metadata: {
          ...(existing.app_metadata ?? {}),
          role: account.role,
          governance_status: "active"
        },
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          display_name: account.label
        }
      });
      if (updated.error) {
        throw new Error(`Failed to update demo user ${email}: ${updated.error.message}`);
      }
      userId = existing.id;
      results.push({ email, role: account.role, action: "updated" });
    } else {
      const created = await supabase.auth.admin.createUser({
        id: account.id,
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: account.label },
        app_metadata: { role: account.role, governance_status: "active" }
      });
      if (created.error || !created.data.user) {
        throw new Error(`Failed to create demo user ${email}: ${created.error?.message ?? "missing user"}`);
      }
      userId = created.data.user.id;
      results.push({ email, role: account.role, action: "created" });
    }

    await provisionAuthenticatedUser({
      userId: userId!,
      email,
      displayName: account.label,
      preferredRole: account.role
    });

    await verifyCredentials(email, password, env);
  }

  return results;
}
