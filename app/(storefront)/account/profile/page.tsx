import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";
import { updateProfileFormAction } from "./actions";

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name,phone")
    .maybeSingle();

  if (error) {
    console.warn("[mithron-account] Failed to load profile via RLS client.", error.message);
    return null;
  }

  return data ?? null;
}

export default async function AccountProfilePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) redirect("/login?next=/account/profile");

  const profile = await getProfile(supabase);
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";

  return (
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
      <h2 className="type-section">Profile</h2>
      <p className="mt-2 text-sm text-white/60">{email}</p>
      <form action={updateProfileFormAction} className="mt-6 grid gap-4 max-w-lg">
        <label className="grid gap-2 text-sm">
          <span className="text-white/70">Display name</span>
          <input name="display_name" defaultValue={String(profile?.display_name ?? "")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-white/70">Phone</span>
          <input name="phone" defaultValue={String(profile?.phone ?? "")} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white" />
        </label>
        <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black w-fit">Save profile</button>
      </form>
    </div>
  );
}
