import { ResetPasswordForm } from "./reset-password-form";
import styles from "../auth/auth-page.module.css";

export default function ResetPasswordPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>New password</p>
        <h1 className={styles.title}>Set a new password</h1>
        <p className={styles.copy}>Choose a strong password for your Mithron account.</p>
        <ResetPasswordForm />
      </section>
    </main>
  );
}
