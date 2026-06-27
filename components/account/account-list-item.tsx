import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccountListItemProps = {
  href: string;
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  badges?: React.ReactNode;
  footer?: React.ReactNode;
  actionLabel?: string;
  className?: string;
};

export function AccountListItem({
  href,
  title,
  subtitle,
  meta,
  badges,
  footer,
  actionLabel = "View details",
  className
}: AccountListItemProps) {
  return (
    <article
      className={cn(
        "rounded-2xl border border-[var(--account-border)] bg-[var(--account-surface-muted)] p-4 transition hover:border-[var(--account-border-strong)]",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Link href={href} className="block min-w-0">
            <p className="truncate font-semibold text-[var(--account-ink)]">{title}</p>
            {subtitle ? <p className="mt-1 text-sm text-[var(--account-ink-muted)]">{subtitle}</p> : null}
            {meta ? <div className="mt-2 text-sm text-[var(--account-ink-muted)]">{meta}</div> : null}
          </Link>
          {badges ? <div className="mt-3 flex flex-wrap gap-2">{badges}</div> : null}
          {footer ? <div className="mt-3 text-sm text-[var(--account-ink-muted)]">{footer}</div> : null}
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 self-start">
          <Link href={href} aria-label={`${actionLabel} for ${title}`}>
            {actionLabel}
          </Link>
        </Button>
      </div>
    </article>
  );
}
