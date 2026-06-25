import Link from "next/link";
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
  const metadataName = typeof data?.claims?.user_metadata?.display_name === "string"
    ? data.claims.user_metadata.display_name.trim()
    : typeof data?.claims?.user_metadata?.full_name === "string"
      ? data.claims.user_metadata.full_name.trim()
      : "";
  const displayName = profile?.display_name?.trim() || metadataName;

  return (
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
      <h2 className="type-section">Profile</h2>
      <p className="mt-2 text-sm text-white/60">
        Keep your contact details up to date. This information is used to pre-fill enquiry forms.
      </p>
      <form action={updateProfileFormAction} className="mt-6 grid gap-4 max-w-lg">
        <label className="grid gap-2 text-sm">
          <span className="text-white/70">Account email</span>
          <input
            value={email}
            readOnly
            disabled
            className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white/70"
            aria-readonly="true"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-white/70">Display name</span>
          <input
            name="display_name"
            defaultValue={displayName}
            placeholder="Your name as shown on enquiries"
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-white/70">Phone number</span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={String(profile?.phone ?? "")}
            placeholder="+91XXXXXXXXXX"
            className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-white"
          />
        </label>
        <button type="submit" className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black w-fit">
          Save profile
        </button>
      </form>
      <p className="mt-6 text-sm text-white/60">
        Need to update your password?{" "}
        <Link href="/account/security" className="text-emerald-400 underline-offset-2 hover:underline">
          Go to security settings
        </Link>
      </p>
    </div>
  );
}
