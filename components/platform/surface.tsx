import type { ReactNode } from "react";

type SurfaceProps = {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md";
};

const paddingClass = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5"
};

export function Surface({ children, className = "", padding = "md" }: SurfaceProps) {
  return (
    <section
      className={`mithron-elevated-card rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface)] ${paddingClass[padding]} ${className}`}
    >
      {children}
    </section>
  );
}

type CardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Card({ title, description, actions, children, className = "" }: CardProps) {
  return (
    <Surface className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--platform-text-primary)]">{title}</h3>
          {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--platform-text-secondary)]">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </Surface>
  );
}
