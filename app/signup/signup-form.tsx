"use client";

import { FormEvent, useMemo, useState } from "react";
import { recordClientAuthEvent } from "@/lib/auth/audit-client";
import { createClient } from "@/lib/client";

export function SignupForm({ inviteToken }: { inviteToken?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: inviteToken ? { invite_token: inviteToken } : undefined
      }
    });
    if (error) {
      if (inviteToken) {
        await recordClientAuthEvent("auth.invite_accept", {
          outcome: "failed",
          invite_token_present: true,
          error: error.message,
          provider: "supabase"
        });
      }
      setStatus("idle");
      setMessage(error.message);
      return;
    }
    if (inviteToken) {
      await recordClientAuthEvent("auth.invite_accept", {
        outcome: "submitted",
        invite_token_present: true,
        provider: "supabase"
      });
    }
    setStatus("sent");
    setMessage("Check your email to verify your account, then sign in at Mithron.");
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4">
      <input
        aria-label="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        type="email"
        autoComplete="email"
        className="h-13 rounded-full border border-white/12 bg-[#080b0f]/[0.06] px-5 text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#7ce7c9]"
        placeholder="name@company.com"
      />
      <input
        aria-label="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={8}
        type="password"
        autoComplete="new-password"
        className="h-13 rounded-full border border-white/12 bg-[#080b0f]/[0.06] px-5 text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#7ce7c9]"
        placeholder="Create a password (8+ characters)"
      />
      {message ? <p className="rounded-2xl border border-white/10 bg-[#080b0f]/[0.05] px-4 py-3 text-sm text-white/70">{message}</p> : null}
      <button
        type="submit"
        disabled={status === "submitting" || status === "sent"}
        className="h-13 rounded-full bg-[#7ce7c9] px-6 text-sm font-bold text-black transition-opacity disabled:opacity-60"
      >
        {status === "submitting" ? "Creating account…" : status === "sent" ? "Check your email" : "Create account"}
      </button>
    </form>
  );
}
