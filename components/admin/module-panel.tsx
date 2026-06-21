import Image from "next/image";

type ModulePanelProps = {
  eyebrow: string;
  title: string;
  description: string;
  status?: string;
  metrics?: Array<{ label: string; value: string; detail?: string; status?: string }>;
  children?: React.ReactNode;
};

export function ModulePanel({ eyebrow, title, description, status, metrics = [], children }: ModulePanelProps) {
  return (
    <section className="rounded-xl border border-slate-800 bg-[#0f141b] p-4 shadow-none md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">{eyebrow}</p>
          <h1 className="mt-1 max-w-4xl font-[var(--type-display)] text-xl font-semibold leading-tight tracking-normal text-slate-100 md:text-2xl">
            {title}
          </h1>
        </div>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
        {description}
      </p>
      {metrics.length ? <AdminMetricGrid metrics={metrics} className="mt-5" /> : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}

export function AdminMetricGrid({
  metrics,
  className = ""
}: {
  metrics: Array<{ label: string; value: string; detail?: string; status?: string }>;
  className?: string;
}) {
  if (!metrics.length) return null;

  return (
    <div data-admin-metric-grid className={`grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {metrics.map((metric) => (
        <div key={`${metric.label}-${metric.value}`} className="rounded-xl border border-slate-800 bg-[#10151d] px-3.5 py-3 shadow-none">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-xs font-medium text-slate-500">{metric.label}</p>
            {metric.status ? <StatusBadge status={metric.status} /> : null}
          </div>
          <p className="mt-1.5 font-[var(--type-display)] text-xl font-semibold tracking-normal text-slate-100">{metric.value}</p>
          {metric.detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{metric.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function AdminSection({
  eyebrow,
  title,
  description,
  actions,
  children,
  className = ""
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-slate-800 bg-[#0f141b] p-4 shadow-none ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p> : null}
          <h2 className="mt-1 text-base font-semibold text-slate-100">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminTableShell({
  title,
  description,
  action,
  children,
  className = ""
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-slate-800 bg-[#0f141b] shadow-none ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#10151d] px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

export function AdminFormSection({
  title,
  description,
  children,
  className = ""
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`grid gap-4 rounded-xl border border-slate-800 bg-[#0f141b] p-4 shadow-none ${className}`}>
      <div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminStickyActionFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 bg-[#0b1017] px-4 py-2.5 md:-mx-5 md:px-5">
      {children}
    </div>
  );
}

function statusToneClass(status: string) {
  const normalized = status.toLowerCase();
  if (/(blocked|failed|error|denied|cancelled|archived|out_of_stock|damaged|danger)/.test(normalized)) {
    return "border-rose-500/25 bg-rose-950/30 text-rose-200";
  }
  if (/(partial|pending|draft|processing|packed|low_stock|warning|reserved)/.test(normalized)) {
    return "border-amber-500/25 bg-amber-950/30 text-amber-200";
  }
  if (/(live|verified|success|published|available|delivered|shipped|ready|clear)/.test(normalized)) {
    return "border-emerald-500/25 bg-emerald-950/30 text-emerald-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-300";
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      aria-label={`Status: ${status.replaceAll("_", " ")}`}
      className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize leading-4 ${statusToneClass(status)}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

export function OperationalFeedback({
  status,
  message,
  context = "Operation",
  idle = "Mutation results, validation errors, and retry status appear here."
}: {
  status?: string | null;
  message?: string | null;
  context?: string;
  idle?: string;
}) {
  const normalizedStatus = status === "success" || status === "error" || status === "warning" ? status : "idle";
  const tone = normalizedStatus === "success"
    ? "border-emerald-500/25 bg-emerald-950/30 text-emerald-200"
    : normalizedStatus === "warning"
      ? "border-amber-500/25 bg-amber-950/30 text-amber-200"
    : normalizedStatus === "error"
      ? "border-rose-500/25 bg-rose-950/30 text-rose-200"
      : "border-slate-800 bg-[#10151d] text-slate-400";

  return (
    <div
      aria-live="polite"
      role={normalizedStatus === "idle" ? "status" : "alert"}
      data-operational-feedback={normalizedStatus}
      className={`rounded-xl border px-4 py-3 text-sm ${tone}`}
    >
      {normalizedStatus === "idle" ? (
        idle
      ) : (
        <>
          <span className="font-semibold">
            {normalizedStatus === "success" ? "Saved" : normalizedStatus === "warning" ? "Needs review" : "Action failed"}
          </span>
          <span className="ml-3 text-slate-300">{context}: {message || "No additional detail was returned."}</span>
        </>
      )}
    </div>
  );
}

export function OperationalStateStrip({
  states
}: {
  states: Array<{ label: string; value: string; status?: string; detail?: string }>;
}) {
  return (
    <div data-operator-state-strip className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {states.map((state) => (
        <div key={`${state.label}-${state.value}`} className="rounded-xl border border-slate-800 bg-[#10151d] p-3 shadow-none">
          <p className="text-xs font-medium text-slate-500">{state.label}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-slate-100">{state.value}</p>
            {state.status ? <StatusBadge status={state.status} /> : null}
          </div>
          {state.detail ? <p className="mt-2 text-xs leading-5 text-slate-500">{state.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

type OperationalRecord = {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  thumbnailSrc?: string | null;
  thumbnailAlt?: string;
  metrics?: Array<{ label: string; value: string }>;
};

export function OperationalRecordGrid({
  rows,
  emptyLabel = "No operational rows available."
}: {
  rows: OperationalRecord[];
  emptyLabel?: string;
}) {
  if (!rows.length) {
    return (
      <div role="status" className="rounded-xl border border-slate-800 bg-[#10151d] p-4 text-sm text-slate-400 shadow-none">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={row.id} className="grid gap-3 rounded-xl border border-slate-800 bg-[#10151d] p-3 shadow-none md:grid-cols-[52px_minmax(0,1fr)_auto] md:items-center">
          <div className="grid size-[52px] place-items-center overflow-hidden rounded-lg border border-slate-800 bg-[#0b1017]">
            {row.thumbnailSrc ? (
              <Image
                src={row.thumbnailSrc}
                alt={row.thumbnailAlt ?? ""}
                width={56}
                height={56}
                sizes="56px"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-[var(--type-display)] text-xl font-semibold text-slate-400">
                {row.title.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-slate-100">{row.title}</p>
              {row.status ? <StatusBadge status={row.status} /> : null}
            </div>
            {row.subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{row.subtitle}</p> : null}
          </div>
          {row.metrics?.length ? (
            <div className="grid min-w-[180px] grid-cols-2 gap-2">
              {row.metrics.map((metric) => (
                <div key={`${row.id}-${metric.label}`} className="rounded-lg border border-slate-800 bg-[#0b1017] px-3 py-1.5">
                  <p className="text-[11px] font-medium text-slate-500">{metric.label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">{metric.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function DataList({ rows }: { rows: Array<{ id?: string; label: string; value: string; detail?: string }> }) {
  return (
    <div className="grid gap-2">
      {rows.map((row, index) => (
        <div key={row.id ?? `${row.label}-${row.value}-${row.detail ?? ""}-${index}`} className="grid gap-2 rounded-xl border border-slate-800 bg-[#10151d] p-3 shadow-none md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-100">{row.label}</p>
            {row.detail ? <p className="mt-1 text-xs leading-5 text-slate-500">{row.detail}</p> : null}
          </div>
          <p className="font-[var(--type-display)] text-xl font-semibold tracking-normal text-slate-100">{row.value}</p>
        </div>
      ))}
    </div>
  );
}
