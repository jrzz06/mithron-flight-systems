"use client";

export function SupplierFormDebugPanel({
  entries
}: {
  entries: Array<{ label: string; value: string }>;
}) {
  if (!entries.length) return null;

  return (
    <aside
      data-supplier-form-debug-panel
      className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 text-xs text-amber-100"
    >
      <p className="font-semibold uppercase tracking-wide text-amber-300">Supplier form debug</p>
      <dl className="mt-2 grid gap-1.5">
        {entries.map((entry) => (
          <div key={entry.label} className="grid gap-0.5">
            <dt className="font-medium text-amber-200/90">{entry.label}</dt>
            <dd className="whitespace-pre-wrap break-all font-mono text-[11px] text-amber-50/90">{entry.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
