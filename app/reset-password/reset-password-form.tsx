"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { recordClientAuthEvent } from "@/lib/auth/audit-client";
import { createClient } from "@/lib/client";
import styles from "../auth/auth-page.module.css";

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
    <form onSubmit={submit} className={styles.form}>
      <input
        aria-label="New password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={8}
        type="password"
        autoComplete="new-password"
        className={styles.input}
        placeholder="New secure password"
      />
      {message ? <p className={styles.message}>{message}</p> : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className={styles.submit}
      >
        {status === "submitting" ? "Updating password" : "Update password"}
      </button>
    </form>
  );
}
