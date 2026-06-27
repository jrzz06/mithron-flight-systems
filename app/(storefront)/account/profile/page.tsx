import { redirect } from "next/navigation";
import {
  AccountCard,
  AccountField,
  AccountInput,
  AccountPage as AccountPageShell,
  AccountSection
} from "@/components/account";
import { LogoutForm } from "@/components/auth/logout-form";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/server";
import { updateProfileFormAction } from "./actions";
import { ProfileSecurityPanel } from "./profile-security-panel";

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
    <AccountPageShell>
      <AccountCard>
        <AccountSection
          title="Profile"
          description="Update your name and phone number for orders and enquiries."
        >
          <form action={updateProfileFormAction} className="grid max-w-lg gap-4">
            <AccountField label="Email address">
              <AccountInput value={email} readOnly disabled aria-readonly="true" />
            </AccountField>
            <AccountField label="Full name">
              <AccountInput
                name="display_name"
                defaultValue={displayName}
                placeholder="Your name"
                autoComplete="name"
              />
            </AccountField>
            <AccountField label="Phone number">
              <AccountInput
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                defaultValue={String(profile?.phone ?? "")}
                placeholder="+91 98765 43210"
              />
            </AccountField>
            <div>
              <Button type="submit">Save profile</Button>
            </div>
          </form>
        </AccountSection>
      </AccountCard>

      <div id="security">
        <ProfileSecurityPanel email={email || null} />
      </div>

      <AccountCard>
        <AccountSection title="Account" description="Sign out of your account on this device.">
          <LogoutForm
            buttonClassName="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--account-danger)] bg-transparent px-5 py-2 text-sm font-medium text-[var(--account-danger)] transition hover:bg-[color-mix(in_srgb,var(--account-danger)_8%,white)]"
          />
        </AccountSection>
      </AccountCard>
    </AccountPageShell>
  );
}
