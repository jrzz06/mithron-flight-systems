import { AdminMetricGrid } from "@/components/admin/module-panel";
import { Card } from "@/components/platform";
import { ControlShellActionNav } from "@/components/admin/control-shell-action-nav";

type ControlShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics?: Array<{ label: string; value: string }>;
  actions?: Array<{ label: string; href: string }>;
  scope?: "warehouse" | "operations";
  children?: React.ReactNode;
};

export function ControlShell({
  eyebrow,
  title,
  description,
  metrics = [],
  actions = [],
  children
}: ControlShellProps) {
  return (
    <div data-control-shell-header className="grid gap-4">
      <Card
        title={title}
        description={description}
        actions={actions.length ? <ControlShellActionNav actions={actions} /> : undefined}
      >
        <p className="mb-3 text-xs font-medium text-[var(--platform-text-muted)]">{eyebrow}</p>
        <AdminMetricGrid metrics={metrics} />
        <div data-operator-state-strip className="sr-only" aria-hidden="true" />
      </Card>
      {children}
    </div>
  );
}
