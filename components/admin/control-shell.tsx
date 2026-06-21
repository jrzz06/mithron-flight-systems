import { AdminMetricGrid } from "@/components/admin/module-panel";
import { ControlShellActionNav } from "@/components/admin/control-shell-action-nav";
import { OperatorToastBridge } from "@/components/admin/operator-toast-bridge";
import Link from "next/link";

type ControlShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics?: Array<{ label: string; value: string }>;
  actions?: Array<{ label: string; href: string }>;
  scope?: "warehouse" | "operations";
  children?: React.ReactNode;
};

export function ControlShell({ eyebrow, title, description, metrics = [], actions = [], scope = "warehouse", children }: ControlShellProps) {
  const rootClassName = scope === "warehouse"
    ? "min-h-screen bg-[#070B14] px-4 py-4 text-slate-100 md:px-6 md:py-5"
    : "min-h-screen bg-[#080b10] px-4 py-4 text-slate-100 md:px-6 md:py-5";

  return (
    <main data-control-plane data-control-plane-scope={scope} data-control-plane-theme="dark" data-admin-performance-theme className={rootClassName}>
      <OperatorToastBridge />
      <section className="mx-auto grid max-w-[1240px] gap-4">
        <div data-control-shell-header className="rounded-xl border border-slate-800 bg-[#0f141b] p-4 shadow-none md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="font-[var(--type-display)] text-sm font-semibold uppercase tracking-[0.14em] text-slate-100">
              MITHRON
            </Link>
            <ControlShellActionNav actions={actions} />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(260px,420px)] md:items-end">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">{eyebrow}</p>
              <h1 className="mt-1 max-w-3xl font-[var(--type-display)] text-[1.45rem] font-semibold leading-tight tracking-normal text-slate-100 md:text-[1.8rem]">
                {title}
              </h1>
            </div>
            <p className="max-w-xl text-sm leading-6 text-slate-400 md:justify-self-end">
              {description}
            </p>
          </div>
          <AdminMetricGrid metrics={metrics} className="mt-4" />
          <div data-operator-state-strip className="sr-only" aria-hidden="true" />
        </div>

        {children}
      </section>
    </main>
  );
}
