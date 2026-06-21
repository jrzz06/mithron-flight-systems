"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/client";
import { recordClientAuthEvent } from "@/lib/auth/audit-client";
import styles from "./login.module.css";

type LoginFormProps = {
  nextPath: string;
  auditToken?: string | null;
};

export function LoginForm({ nextPath, auditToken = null }: LoginFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const isMountedRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "authenticating" | "loading-role" | "google">("idle");
  const [error, setError] = useState<string | null>(null);
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!redirectTo) return;
    window.location.assign(redirectTo);
  }, [redirectTo]);

  async function authenticateWithCredentials(normalizedEmail: string, credentialPassword: string, redirectNext = nextPath) {
    if (!isMountedRef.current) return;

    setStatus("authenticating");
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auditToken ? { "x-auth-audit-token": auditToken } : {})
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: credentialPassword,
        next: redirectNext
      }),
      credentials: "same-origin"
    });
    const payload = await response.json().catch(() => ({})) as { error?: string; redirectPath?: string };

    if (!isMountedRef.current) return;

    if (!response.ok) {
      await recordClientAuthEvent("auth.failed_login", {
        email: normalizedEmail,
        error: typeof payload.error === "string" ? payload.error : "Sign in failed.",
        provider: "supabase"
      }, auditToken);
      if (!isMountedRef.current) return;
      setStatus("idle");
      setError(typeof payload.error === "string" ? payload.error : "Sign in failed.");
      return;
    }

    await recordClientAuthEvent("auth.login", {
      email: normalizedEmail,
      provider: "supabase"
    }, auditToken);
    if (!isMountedRef.current) return;
    setStatus("loading-role");
    setRedirectTo(typeof payload.redirectPath === "string" ? payload.redirectPath : "/account");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isMountedRef.current) return;
    await authenticateWithCredentials(email.trim().toLowerCase(), password);
  }

  async function signInWithGoogle() {
    if (!isMountedRef.current) return;
    setStatus("google");
    setError(null);

    const redirectToGoogle = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath || "/account")}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectToGoogle,
        queryParams: {
          prompt: "select_account"
        }
      }
    });

    if (!isMountedRef.current) return;
    if (oauthError) {
      await recordClientAuthEvent("auth.failed_login", {
        provider: "google",
        error: oauthError.message
      }, auditToken);
      if (!isMountedRef.current) return;
      setStatus("idle");
      setError(oauthError.message);
    }
  }

  const busy = status !== "idle";

  return (
    <div className={styles.authFormStack}>
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy}
        data-testid="login-google-button"
        className={styles.oauthButton}
      >
        {status === "google" ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <div className={styles.authDivider}>
        <span>or sign in with email</span>
      </div>

      <form onSubmit={submit} className={styles.authForm} data-testid="login-auth-form">
        <label className={styles.field}>
          <span className={styles.labelText}>Work email</span>
          <input
            aria-label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            inputMode="email"
            autoComplete="email"
            className={styles.authInput}
            placeholder="name@company.com"
          />
        </label>
        <label className={styles.field}>
          <span className={styles.labelText}>Password</span>
          <input
            aria-label="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            autoComplete="current-password"
            className={styles.authInput}
            placeholder="Enter your password"
          />
        </label>
        <div className={styles.formMeta}>
          <Link className={styles.recoveryLink} href="/forgot-password">Forgot password?</Link>
        </div>
        {error ? <p className={styles.inlineAlert} role="alert">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className={styles.authSubmit}
        >
          {status === "authenticating" ? "Signing in…" : status === "loading-role" ? "Loading…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
