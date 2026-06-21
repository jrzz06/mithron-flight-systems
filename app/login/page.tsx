import styles from "./login.module.css";
import { buildAuthAuditClientToken } from "@/lib/auth-audit-client";
import { LoginFormClient } from "./login-form-client";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
    auth_status?: string;
    admin_status?: string;
    access_status?: string;
    auth_error?: string;
    logout_status?: string;
    logout_reason?: string;
    logout_notice?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const auditToken = buildAuthAuditClientToken();

  return (
    <main className={styles.authGateway} data-testid="login-auth-gateway">
      <section className={styles.authShell} aria-labelledby="mithron-login-title">
        <div className={styles.brandPanel}>
          <div className={styles.brandMark} aria-label="Mithron">
            <span className={styles.brandGlyph} aria-hidden="true">M</span>
            <span>Mithron</span>
          </div>

          <div className={styles.brandContent}>
            <h1 className={styles.brandTitle}>Sign in to Mithron</h1>
            <p className={styles.brandCopy}>
              Access products, inventory, orders, and content from one secure workspace.
            </p>
          </div>

          <p className={styles.brandFootnote}>
            Need an account? Contact your administrator.
          </p>
        </div>

        <div className={styles.formPanel}>
          <div className={styles.formStack}>
            <header className={styles.formHeader}>
              <h2 className={styles.formTitle} id="mithron-login-title">Welcome back</h2>
              <p className={styles.formCopy}>
                Sign in with your work email and password.
              </p>
            </header>

            {params.auth_error ? (
              <p className={styles.pageAlert} role="alert">{params.auth_error}</p>
            ) : params.logout_status === "signed_out" ? (
              <p className={styles.pageAlert} role="status">You have been signed out successfully.</p>
            ) : params.logout_notice ? (
              <p className={styles.pageAlert} role="status">{params.logout_notice}</p>
            ) : params.logout_reason === "session_idle" ? (
              <p className={styles.pageAlert} role="status">Your session expired. Please sign in again.</p>
            ) : params.logout_reason === "session_revoked" ? (
              <p className={styles.pageAlert} role="status">Your session was revoked. Please sign in again.</p>
            ) : params.logout_reason === "disabled" ? (
              <p className={styles.pageAlert} role="alert">This account has been disabled. Contact your administrator.</p>
            ) : params.auth_status === "role_required" ? (
              <p className={styles.pageAlert} role="status">Your account is active, but no role has been assigned yet. Contact your administrator.</p>
            ) : params.auth_status === "role_resolution_failed" ? (
              <p className={styles.pageAlert} role="alert">We could not verify your account permissions. Please try again or contact support.</p>
            ) : params.admin_status === "forbidden" || params.access_status === "forbidden" ? (
              <p className={styles.pageAlert} role="status">You do not have permission to open that page.</p>
            ) : null}
            <LoginFormClient
              nextPath={params.next ?? ""}
              auditToken={auditToken}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
