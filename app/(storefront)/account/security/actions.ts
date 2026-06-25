"use server";

import { createClient } from "@/lib/server";
import { getSiteOrigin } from "@/lib/site-url";

export async function sendPasswordResetAction() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email.trim() : "";

  if (!email) {
    return { ok: false as const, message: "No email address is associated with this account." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteOrigin()}/reset-password`
  });

  if (error) {
    return { ok: false as const, message: error.message || "Could not send password reset email." };
  }

  return { ok: true as const, message: `Password reset email sent to ${email}.` };
}
