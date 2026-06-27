import Link from "next/link";
import { redirect } from "next/navigation";
import { MithronBrandMark } from "@/components/brand/mithron-brand-mark";
import styles from "./login.module.css";
import { mapAuthPageNotice } from "@/lib/auth/client-errors";
import { resolveGuestPostAuthRedirect, resolveLoginPageRedirect } from "@/lib/auth/post-auth-redirect";
import { getAuthProviderAvailability } from "@/lib/auth/provider-registry";
import { buildAuthAuditClientToken } from "@/lib/auth-audit-client";
import { createClient } from "@/lib/server";
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

const trustItems = [
  {
    label: "Enterprise fleet support",
    icon: (
      <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M12 2L2 7l10 5 10-5-10-5z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    label: "Secure checkout",
    icon: (
      <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    label: "Fast delivery",
    icon: (
      <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  },
  {
    label: "Pro-grade hardware",
    icon: (
      <svg className={styles.trustIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
] as const;

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (user) {
    const { data: role } = await supabase.rpc("current_enterprise_role");
    if (role) {
      redirect(resolveLoginPageRedirect({
        user,
        role,
        nextPath: params.next ?? ""
      }));
    }

    redirect(resolveGuestPostAuthRedirect(params.next ?? ""));
  }

  const auditToken = buildAuthAuditClientToken();
  const providers = getAuthProviderAvailability();
  const notice = mapAuthPageNotice(params);

  return (
    <main className={styles.authGateway} data-testid="login-auth-gateway">
      <section className={styles.authShell} aria-labelledby="mithron-login-title">
        <div className={styles.brandPanel}>
          <div className={styles.brandMark} aria-label="Mithron">
            <MithronBrandMark className={styles.brandMarkImage} priority />
          </div>

          <div className={styles.brandContent}>
            <p className={styles.eyebrow}>Enterprise commerce</p>
            <h1 className={styles.brandTitle}>Mithron</h1>
            <p className={styles.brandCopy}>
              Precision drones and enterprise gear, delivered.
            </p>
          </div>

          <ul className={styles.trustGrid} aria-label="Why Mithron">
            {trustItems.map((item) => (
              <li key={item.label} className={styles.trustItem}>
                {item.icon}
                <span>{item.label}</span>
              </li>
            ))}
          </ul>

          <p className={styles.brandFootnote}>
            Don&apos;t have an account?{" "}
            <Link href="/signup" className={styles.brandLink}>Create one</Link>
          </p>
        </div>

        <div className={styles.formPanel}>
          <div className={styles.formStack}>
            <header className={styles.formHeader}>
              <h2 className={styles.formTitle} id="mithron-login-title">Sign in</h2>
              <p className={styles.formCopy}>Sign in to manage your account and orders.</p>
            </header>

            {notice ? (
              <p
                className={notice.tone === "error" ? styles.pageAlert : `${styles.pageAlert} ${styles.neutralAlert}`}
                role={notice.tone === "error" ? "alert" : "status"}
              >
                {notice.message}
              </p>
            ) : null}

            <LoginFormClient
              nextPath={params.next ?? ""}
              auditToken={auditToken}
              providers={providers}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
