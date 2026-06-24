"use client";

import { FormEvent, useMemo, useState } from "react";
import { recordClientAuthEvent } from "@/lib/auth/audit-client";
import { createClient } from "@/lib/client";
import styles from "../auth/auth-page.module.css";

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
      {message ? <p className={styles.message}>{message}</p> : null}
      <button
        type="submit"
        disabled={status === "submitting" || status === "sent"}
        className={styles.submit}
      >
        {status === "submitting" ? "Sending reset" : "Send reset link"}
      </button>
    </form>
  );
}
