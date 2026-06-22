import Link from "next/link";
import type { ReactNode } from "react";

export function ReportPageShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="grid gap-5">
      <div>
        <Link href="/admin/reports" className="text-sm font-medium text-teal-700 hover:text-teal-800">
          Back to reports
        </Link>
        <h2 className="mt-3 text-xl font-semibold text-[var(--platform-text-primary)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
