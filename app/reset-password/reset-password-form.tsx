"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { recordClientAuthEvent } from "@/lib/auth/audit-client";
import { createClient } from "@/lib/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      await recordClientAuthEvent("auth.password_reset", {
        outcome: "failed_update",
        error: error.message,
        provider: "supabase"
      });
      setStatus("idle");
      setMessage(error.message);
      return;
    }
    await recordClientAuthEvent("auth.password_reset", {
      outcome: "completed",
      provider: "supabase"
    });
    router.replace("/login?next=/account");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4">
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={8}
        type="password"
        autoComplete="new-password"
        className="h-13 rounded-full border border-white/12 bg-[#080b0f]/[0.06] px-5 text-white outline-none transition-colors placeholder:text-white/28 focus:border-[#7ce7c9]"
        placeholder="New secure password"
      />
      {message ? <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{message}</p> : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="h-13 rounded-full bg-[#7ce7c9] px-6 text-sm font-bold text-black transition-opacity disabled:opacity-60"
      >
        {status === "submitting" ? "Updating password" : "Update password"}
      </button>
    </form>
  );
}
