"use client";

import { FormEvent, useMemo, useState } from "react";
import { recordClientAuthEvent } from "@/lib/auth/audit-client";
import { createClient } from "@/lib/client";

type ForgotPasswordFormProps = {
  auditToken?: string | null;
};

export function ForgotPasswordForm({ auditToken }: ForgotPasswordFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) {
      await recordClientAuthEvent("auth.password_reset", {
        email,
        outcome: "failed",
        error: error.message,
        provider: "supabase"
      }, auditToken);
      setStatus("idle");
      setMessage(error.message);
      return;
    }
    await recordClientAuthEvent("auth.password_reset", {
      email,
      outcome: "requested",
      provider: "supabase"
    }, auditToken);
    setStatus("sent");
    setMessage("Password reset instructions have been sent if the account exists.");
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4">
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        type="email"
        autoComplete="email"
        className="h-13 rounded-full border border-white/12 bg-[#080b0f]/[0.06] px-5 text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#7ce7c9]"
        placeholder="name@company.com"
      />
      {message ? <p className="rounded-2xl border border-white/10 bg-[#080b0f]/[0.05] px-4 py-3 text-sm text-white/70">{message}</p> : null}
      <button
        type="submit"
        disabled={status === "submitting" || status === "sent"}
        className="h-13 rounded-full bg-[#7ce7c9] px-6 text-sm font-bold text-black transition-opacity disabled:opacity-60"
      >
        {status === "submitting" ? "Sending reset" : "Send reset link"}
      </button>
    </form>
  );
}
