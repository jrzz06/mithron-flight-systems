"use client";

import type { ReactNode } from "react";

type AdminOrdersShellProps = {
  toolbar: ReactNode;
  filters: ReactNode;
  list: ReactNode;
  detail: ReactNode;
  actions?: ReactNode;
  hasSelectedOrder?: boolean;
};

export function AdminOrdersShell({
  toolbar,
  filters,
  list,
  detail,
  actions,
  hasSelectedOrder = false
}: AdminOrdersShellProps) {
  return (
    <div data-admin-orders-shell className="grid gap-0">
      <div className="sticky top-0 z-20 -mx-1 space-y-3 border-b border-[var(--platform-border)] bg-[var(--platform-bg)]/95 px-1 pb-4 backdrop-blur-sm">
        {toolbar}
        {filters}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(300px,34%)_minmax(0,1fr)] xl:grid-cols-[minmax(320px,30%)_minmax(0,50%)_minmax(260px,20%)]">
        <div className="flex h-[calc(100vh-11rem)] min-h-0 flex-col overflow-hidden">{list}</div>
        <div
          className={`flex h-[calc(100vh-11rem)] min-h-0 min-w-0 flex-col overflow-hidden ${hasSelectedOrder ? "max-xl:pb-24" : ""}`}
        >
          {detail}
        </div>
        {actions ? (
          <div className="flex h-[calc(100vh-11rem)] min-h-0 flex-col overflow-hidden max-xl:fixed max-xl:bottom-0 max-xl:left-0 max-xl:right-0 max-xl:z-40 max-xl:h-auto max-xl:border-t max-xl:border-[var(--platform-border)] max-xl:bg-[var(--platform-surface)] max-xl:p-3 max-xl:shadow-[0_-8px_24px_rgba(0,0,0,0.35)] lg:col-start-2 lg:row-start-2 xl:static xl:col-start-3 xl:row-start-1 xl:border-t-0 xl:p-0 xl:shadow-none">
            <div className="min-h-0 flex-1 overflow-y-auto xl:sticky xl:top-4">{actions}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
