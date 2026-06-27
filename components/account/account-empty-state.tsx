import { cn } from "@/lib/utils";

type AccountEmptyStateProps = {
  children: React.ReactNode;
  className?: string;
};

export function AccountEmptyState({ children, className }: AccountEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-[var(--account-border-strong)] bg-[var(--account-surface-muted)] px-4 py-6 text-sm leading-relaxed text-[var(--account-ink-muted)]",
        className
      )}
    >
      {children}
    </div>
  );
}
