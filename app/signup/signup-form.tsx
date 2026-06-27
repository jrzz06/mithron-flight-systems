"use client";

import { FormEvent, useState } from "react";
import { recordClientAuthEvent } from "@/lib/auth/audit-client";
import styles from "../auth/auth-page.module.css";

export function SignupForm({ inviteToken }: { inviteToken?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "sent">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setMessage(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=/onboarding`;
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        redirectTo,
        inviteToken: inviteToken ?? null
      })
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (inviteToken) {
        await recordClientAuthEvent("auth.invite_accept", {
          outcome: "failed",
          invite_token_present: true,
          error: data.error ?? "Request failed",
          provider: "supabase"
        });
      }
      setStatus("idle");
      setMessage(data.error ?? "Something went wrong. Please try again.");
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
