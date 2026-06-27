import Link from "next/link";
import { cn } from "@/lib/utils";

type AccountStatProps = {
  label: string;
  value: string | number;
  href?: string;
  className?: string;
};

export function AccountStat({ label, value, href, className }: AccountStatProps) {
  const content = (
    <>
      <p className="text-sm text-[var(--account-ink-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--account-ink)]">{value}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          "rounded-2xl border border-[var(--account-border)] bg-[var(--account-surface-muted)] p-4 transition hover:border-[var(--account-border-strong)] hover:bg-[var(--account-surface)]",
          className
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--account-border)] bg-[var(--account-surface-muted)] p-4",
        className
      )}
    >
      {content}
    </div>
  );
}
