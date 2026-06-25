"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
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
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
      <h2 className="type-section">Security</h2>
      <p className="mt-3 max-w-2xl text-sm text-white/60">
        {isStaff
          ? `Manage account security for your ${workspaceLabel.toLowerCase()}. Password changes are handled through Supabase Auth.`
          : "Manage your account security settings. Send yourself a password reset email to update your password."}
      </p>

      {!isStaff ? (
        <div className="mt-6 max-w-xl rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
          <p className="text-sm text-white/70">Account email</p>
          <p className="mt-1 font-medium text-white">{email || "No email on file"}</p>
          <Button
            type="button"
            className="mt-4"
            disabled={!email || pending}
            onClick={handlePasswordReset}
          >
            {pending ? "Sending..." : "Send password reset email"}
          </Button>
          {message ? <p className="mt-3 text-sm text-emerald-400">{message}</p> : null}
          {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
        </div>
      ) : null}

      {workspaceHref ? (
        <div className="mt-6">
          <Button asChild>
            <Link href={workspaceHref}>Open {workspaceLabel}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
