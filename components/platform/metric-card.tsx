type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
  trend?: string;
};

export function MetricCard({ label, value, detail, trend }: MetricCardProps) {
  return (
    <div
      className="mithron-elevated-card rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 py-3.5"
    >
      <p className="truncate text-xs font-medium text-[var(--platform-text-muted)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--platform-text-primary)]">{value}</p>
      {detail ? <p className="mt-1 text-xs text-[var(--platform-text-muted)]">{detail}</p> : null}
      {trend ? <p className="mt-1 text-xs font-medium text-teal-700">{trend}</p> : null}
    </div>
  );
}

export function MetricGrid({
  metrics,
  className = ""
}: {
  metrics: MetricCardProps[];
  className?: string;
}) {
  if (!metrics.length) return null;
  return (
    <div data-admin-metric-grid className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {metrics.map((metric) => (
        <MetricCard key={`${metric.label}-${metric.value}`} {...metric} />
      ))}
    </div>
  );
}
