import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const LIVE_ACCOUNTS = [
  {
    email: "live-admin@mithron.com",
    password: "MithronLiveAdmin26!",
    role: "admin",
    label: "Live Admin Demo"
  },
  {
    email: "live-supplier@mithron.com",
    password: "MithronLiveSupplier26!",
    role: "supplier",
    label: "Live Supplier Demo"
  },
  {
    email: "live-warehouse@mithron.com",
    password: "MithronLiveWarehouse26!",
    role: "warehouse",
    label: "Live Warehouse Demo"
  }
];

async function findAuthUserByEmail(supabase, email) {
  const normalizedEmail = email.toLowerCase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profile?.id) {
    const authUser = await supabase.auth.admin.getUserById(profile.id);
    if (authUser.data.user) return authUser.data.user;
  }

  for (let page = 1; page <= 3; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail);
    if (match) return match;
    if (data.users.length < 200) break;
  }

  return null;
}

async function ensureRoles(supabase) {
  const rows = [
    { key: "admin", label: "Admin", description: "Full admin access.", sort_order: 1 },
    { key: "warehouse", label: "Warehouse", description: "Warehouse access.", sort_order: 2 },
    { key: "supplier", label: "Supplier", description: "Supplier access.", sort_order: 3 },
    { key: "user", label: "User", description: "Storefront user access.", sort_order: 4 }
  ];

  for (const row of rows) {
    const { error } = await supabase.from("roles").upsert(row, { onConflict: "key" });
    if (error) throw error;
  }
}

async function provisionUser(supabase, userId, account) {
  const now = new Date().toISOString();
  const email = account.email.toLowerCase();

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      display_name: account.label,
      default_role: account.role,
      governance_status: "active",
      updated_at: now
    },
    { onConflict: "id" }
  );
  if (profileError) throw profileError;

  const { error: clearRolesError } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (clearRolesError) throw clearRolesError;

  const { error: roleError } = await supabase.from("user_roles").upsert(
    { user_id: userId, role_key: account.role },
    { onConflict: "user_id,role_key" }
  );
  if (roleError) throw roleError;

  const { error: metadataError } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { role: account.role, governance_status: "active" },
    user_metadata: { display_name: account.label }
  });
  if (metadataError) throw metadataError;
}

async function verifyLogin(url, anonKey, email, password) {
  const verifier = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error } = await verifier.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !serviceRoleKey || !anonKey) {
    throw new Error("Missing Supabase env vars in .env.local");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  await ensureRoles(supabase);

  for (const account of LIVE_ACCOUNTS) {
    const email = account.email.toLowerCase();
    const existing = await findAuthUserByEmail(supabase, email);
    let userId = existing?.id ?? null;

    if (existing) {
      const { error } = await supabase.auth.admin.updateUserById(existing.id, {
        password: account.password,
        email_confirm: true
      });
      if (error) throw error;
      userId = existing.id;
      console.log(`updated ${email}`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: account.password,
        email_confirm: true,
        user_metadata: { display_name: account.label },
        app_metadata: { role: account.role, governance_status: "active" }
      });
      if (error || !data.user) throw error ?? new Error(`Failed to create ${email}`);
      userId = data.user.id;
      console.log(`created ${email}`);
    }

    await provisionUser(supabase, userId, account);
    await verifyLogin(url, anonKey, email, account.password);
    console.log(`verified ${email} (${account.role})`);
  }

  console.log("LIVE_ACCOUNTS_READY");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
