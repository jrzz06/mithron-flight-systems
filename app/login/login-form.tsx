"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { recordClientAuthEvent } from "@/lib/auth/audit-client";
import { mapAuthErrorForClient } from "@/lib/auth/client-errors";
import { GUEST_AUTH_HOME, isGuestStorefrontNextPath } from "@/lib/auth/guest-auth";
import { resolveClientAuthRedirectPath } from "@/lib/auth/redirects";
import { hasSocialSignIn, type AuthProviderAvailability } from "@/lib/auth/provider-registry";
import { createClient } from "@/lib/client";
import styles from "./login.module.css";

type LoginFormProps = {
  nextPath: string;
  auditToken?: string | null;
  providers: AuthProviderAvailability;
};

type LoginStatus =
  | "idle"
  | "authenticating"
  | "loading-role"
  | "google";

function guestRedirectTarget(nextPath: string) {
  return isGuestStorefrontNextPath(nextPath) ? nextPath : GUEST_AUTH_HOME;
}

function buildOAuthCallbackUrl(nextPath: string) {
  const callback = new URL("/auth/callback", window.location.origin);
  callback.searchParams.set("next", guestRedirectTarget(nextPath));
  return callback.toString();
}

function GoogleIcon() {
  return (
    <svg className={styles.methodIcon} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  if (hidden) {
    return (
      <svg className={styles.toggleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" />
        <path d="M4 4l16 16" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={styles.toggleIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EmailSignInForm({
  email,
  password,
  showPassword,
  busy,
  status,
  hasError,
  emailFieldId,
  passwordFieldId,
  passwordToggleId,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onSubmit
}: {
  email: string;
  password: string;
  showPassword: boolean;
  busy: boolean;
  status: LoginStatus;
  hasError: boolean;
  emailFieldId: string;
  passwordFieldId: string;
  passwordToggleId: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className={styles.authForm} data-testid="login-auth-form">
      <label className={styles.field} htmlFor={emailFieldId}>
        <span className={styles.labelText}>email address</span>
        <input
          id={emailFieldId}
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
          type="email"
          inputMode="email"
          autoComplete="email"
          className={styles.authInput}
          aria-invalid={hasError || undefined}
        />
      </label>

      <label className={styles.field} htmlFor={passwordFieldId}>
        <span className={`${styles.labelText} ${styles.labelTextPassword}`}>Password</span>
        <div className={styles.passwordField}>
          <input
            id={passwordFieldId}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className={styles.authInput}
            aria-invalid={hasError || undefined}
          />
          <button
            type="button"
            id={passwordToggleId}
            className={styles.passwordToggle}
            onClick={onTogglePassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            aria-controls={passwordFieldId}
          >
            <EyeIcon hidden={showPassword} />
          </button>
        </div>
      </label>

      <div className={styles.formMeta}>
        <Link className={styles.recoveryLink} href="/forgot-password">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={busy}
        aria-busy={busy}
        className={styles.authSubmit}
        data-testid="login-email-submit"
      >
        {status === "authenticating"
          ? "Signing in…"
          : status === "loading-role"
            ? "Loading…"
            : "Log In"}
      </button>
    </form>
  );
}

export function LoginForm({ nextPath, auditToken = null, providers }: LoginFormProps) {
  const socialEnabled = hasSocialSignIn(providers);
  const emailFieldId = useId();
  const passwordFieldId = useId();
  const passwordToggleId = useId();
  const isMountedRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<LoginStatus>("idle");
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

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: credentialPassword
      });

      if (!isMountedRef.current) return;

      if (signInError) {
        await recordClientAuthEvent("auth.failed_login", {
          email: normalizedEmail,
          error: signInError.message,
          provider: "email"
        }, auditToken);
        if (!isMountedRef.current) return;
        setStatus("idle");
        setError(mapAuthErrorForClient(signInError));
        return;
      }

      setStatus("loading-role");

      const provisionResponse = await fetch("/api/auth/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next: redirectNext }),
        credentials: "same-origin"
      });
      const payload = await provisionResponse.json().catch(() => ({})) as {
        error?: string;
        redirectPath?: string;
      };

      if (!isMountedRef.current) return;

      if (!provisionResponse.ok) {
        await supabase.auth.signOut();
        await recordClientAuthEvent("auth.failed_login", {
          email: normalizedEmail,
          error: typeof payload.error === "string" ? payload.error : "Sign in failed.",
          provider: "email"
        }, auditToken);
        if (!isMountedRef.current) return;
        setStatus("idle");
        setError(mapAuthErrorForClient(payload.error));
        return;
      }

      await recordClientAuthEvent("auth.login", {
        email: normalizedEmail,
        provider: "email"
      }, auditToken);
      if (!isMountedRef.current) return;
      setRedirectTo(resolveClientAuthRedirectPath(payload.redirectPath));
    } catch (authError) {
      if (!isMountedRef.current) return;
      await recordClientAuthEvent("auth.failed_login", {
        email: normalizedEmail,
        error: authError instanceof Error ? authError.message : "Sign in failed.",
        provider: "email"
      }, auditToken);
      if (!isMountedRef.current) return;
      setStatus("idle");
      setError(mapAuthErrorForClient(authError));
    }
  }

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isMountedRef.current) return;
    await authenticateWithCredentials(email.trim().toLowerCase(), password);
  }

  async function signInWithGoogle() {
    if (!providers.google || !isMountedRef.current) return;
    setStatus("google");
    setError(null);

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: buildOAuthCallbackUrl(nextPath),
          queryParams: {
            prompt: "select_account",
            access_type: "offline"
          },
          skipBrowserRedirect: false
        }
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (oauthError) {
      if (!isMountedRef.current) return;
      await recordClientAuthEvent("auth.failed_login", {
        provider: "google",
        error: oauthError instanceof Error ? oauthError.message : "Sign in failed."
      }, auditToken);
      if (!isMountedRef.current) return;
      setStatus("idle");
      setError(mapAuthErrorForClient(oauthError));
    }
  }

  const busy = status !== "idle";
  const showInlineEmail = providers.email;

  return (
    <div className={styles.authCard} data-testid="login-auth-card">
      {error ? <p className={styles.inlineAlert} role="alert">{error}</p> : null}

      <div data-testid="login-guest-account">
        {socialEnabled && providers.google ? (
          <section className={styles.methodStack} data-testid="login-social-methods" aria-label="Continue with Google">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              data-testid="login-google-button"
              className={styles.googleButton}
              aria-busy={status === "google"}
            >
              <GoogleIcon />
              <span>{status === "google" ? "Signing in…" : "Continue With Google"}</span>
            </button>
          </section>
        ) : null}

        {showInlineEmail && socialEnabled ? (
          <div className={styles.methodDivider} aria-hidden="true">
            <span>or</span>
          </div>
        ) : null}

        {showInlineEmail ? (
          <section className={styles.emailSection} aria-label="Email sign in">
            <EmailSignInForm
              email={email}
              password={password}
              showPassword={showPassword}
              busy={busy}
              status={status}
              hasError={Boolean(error)}
              emailFieldId={emailFieldId}
              passwordFieldId={passwordFieldId}
              passwordToggleId={passwordToggleId}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onTogglePassword={() => setShowPassword((current) => !current)}
              onSubmit={submitEmail}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
