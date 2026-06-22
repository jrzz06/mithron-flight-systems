import { humanStatus } from "@/lib/platform/copy";

function statusToneClass(status: string) {
  const normalized = status.toLowerCase();
  if (/(blocked|failed|error|denied|cancelled|archived|out_of_stock|damaged|danger)/.test(normalized)) {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }
  if (/(partial|pending|draft|processing|packed|low_stock|warning|reserved|unread)/.test(normalized)) {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }
  if (/(live|verified|success|published|available|delivered|shipped|ready|clear|read)/.test(normalized)) {
    return "border-teal-200 bg-teal-50 text-teal-900";
  }
  return "border-[var(--platform-border)] bg-[var(--platform-surface-muted)] text-[var(--platform-text-secondary)]";
}

export function StatusPill({ status }: { status: string }) {
  const label = humanStatus(status);
  if (!label) return null;

  return (
    <span
      aria-label={`Status: ${label}`}
      className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusToneClass(status)}`}
    >
      {label}
    </span>
  );
}
