import { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";
import { LoginHeroBackground } from "../login/login-hero-background";
import styles from "../login/login.module.css";

export const metadata: Metadata = {
  title: "Set new password · Mithron Flight Systems",
  description: "Secure your Mithron account with a new password."
};

export default function ResetPasswordPage() {
  return (
    <main className={styles.authGateway}>
      <div className={styles.authSplit}>
        <section className={styles.brandColumn}>
          <LoginHeroBackground priority={false} />
        </section>

        <section className={styles.formColumn}>
          <div className={styles.formStack}>
            <header className={styles.formHeader}>
              <h1 className={styles.formTitle}>Set a new password</h1>
              <p className={styles.formCopy}>Choose a strong password for your Mithron account.</p>
            </header>
            <ResetPasswordForm />
          </div>
        </section>
      </div>
    </main>
  );
}
