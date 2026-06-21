"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type SecurityPanelProps = {
  workspaceHref: string | null;
  workspaceLabel: string;
  isStaff: boolean;
};

export function SecurityPanel({ workspaceHref, workspaceLabel, isStaff }: SecurityPanelProps) {
  return (
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
      <h2 className="type-section">Security</h2>
      <p className="mt-3 max-w-2xl text-sm text-white/60">
        {isStaff
          ? `Manage account security for your ${workspaceLabel.toLowerCase()}. Password changes are handled through Supabase Auth.`
          : "Manage your account security settings. Contact support if you need help updating your password."}
      </p>
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
