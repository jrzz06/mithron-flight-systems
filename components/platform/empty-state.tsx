import Link from "next/link";
import type { ReactNode } from "react";

type EmptyStateProps = {
  message: string;
  actionLabel?: string;
  actionHref?: string;
  action?: ReactNode;
};

export function EmptyState({ message, actionLabel, actionHref, action }: EmptyStateProps) {
  return (
    <div role="status" className="flex flex-col items-center justify-center rounded-[var(--platform-radius)] border border-dashed border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-6 py-10 text-center">
      <p className="max-w-sm text-sm text-[var(--platform-text-secondary)]">{message}</p>
      {action}
      {!action && actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mt-4 inline-flex h-9 items-center rounded-[10px] bg-[var(--platform-accent)] px-4 text-sm font-semibold text-white transition hover:bg-teal-700"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
