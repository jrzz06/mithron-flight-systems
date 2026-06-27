"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AccountCard, AccountSection } from "@/components/account";
import { Button } from "@/components/ui/button";
import { sendPasswordResetAction } from "./actions";

type SecurityPanelProps = {
  workspaceHref: string | null;
  workspaceLabel: string;
  isStaff: boolean;
  email: string | null;
};

export function SecurityPanel({ workspaceHref, workspaceLabel, isStaff, email }: SecurityPanelProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handlePasswordReset() {
    setMessage("");
    setError("");
    startTransition(async () => {
      const result = await sendPasswordResetAction();
      if (result.ok) {
        setMessage(result.message);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <AccountCard>
      <AccountSection
        title="Security"
        description={
          isStaff
            ? `Manage security settings for your ${workspaceLabel.toLowerCase()}.`
            : "Change your password using a secure link sent to your email."
        }
      >
        {!isStaff ? (
          <div className="max-w-xl rounded-2xl border border-[var(--account-border)] bg-[var(--account-surface-muted)] p-5">
            <p className="text-sm text-[var(--account-ink-muted)]">Registered email</p>
            <p className="mt-1 font-medium text-[var(--account-ink)]">{email || "No email on file"}</p>
            <Button
              type="button"
              className="mt-4"
              disabled={!email || pending}
              onClick={handlePasswordReset}
            >
              {pending ? "Sending..." : "Send password reset email"}
            </Button>
            {message ? <p className="mt-3 text-sm text-[var(--account-accent)]">{message}</p> : null}
            {error ? <p className="mt-3 text-sm text-[var(--account-danger)]">{error}</p> : null}
          </div>
        ) : null}

        {workspaceHref ? (
          <div className="mt-6">
            <Button asChild>
              <Link href={workspaceHref}>Open {workspaceLabel}</Link>
            </Button>
          </div>
        ) : null}
      </AccountSection>
    </AccountCard>
  );
}
