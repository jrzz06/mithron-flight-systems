import { SignupForm } from "./signup-form";
import styles from "../auth/auth-page.module.css";

export default function SignupPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Create account</p>
        <h1 className={styles.title}>Join Mithron</h1>
        <p className={styles.copy}>
          Register with your work email. You will receive a verification link before you can access your account.
        </p>
        <SignupForm />
      </section>
    </main>
  );
}
