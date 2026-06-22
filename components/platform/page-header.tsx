import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  kicker?: string;
};

export function PageHeader({ title, description, action, kicker }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {kicker ? <p className="text-xs font-medium text-[var(--platform-text-muted)]">{kicker}</p> : null}
        <h2 className="mt-0.5 text-xl font-semibold tracking-tight text-[var(--platform-text-primary)] md:text-2xl">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--platform-text-secondary)]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
