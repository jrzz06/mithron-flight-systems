"use client";

import { FormEvent, useMemo, useState } from "react";
import { recordClientAuthEvent } from "@/lib/auth/audit-client";
import { createClient } from "@/lib/client";
import styles from "../auth/auth-page.module.css";

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
    <form onSubmit={submit} className={styles.form}>
      <input
        aria-label="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        type="email"
        autoComplete="email"
        className={styles.input}
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
        className={styles.input}
        placeholder="Create a password (8+ characters)"
      />
      {message ? <p className={styles.message}>{message}</p> : null}
      <button
        type="submit"
        disabled={status === "submitting" || status === "sent"}
        className={styles.submit}
      >
        {status === "submitting" ? "Creating account…" : status === "sent" ? "Check your email" : "Create account"}
      </button>
    </form>
  );
}
