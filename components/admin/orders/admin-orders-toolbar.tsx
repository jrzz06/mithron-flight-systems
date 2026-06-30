"use client";

import Link from "next/link";
import { ADMIN_QUEUE_LABELS, type AdminOrderQueue } from "@/lib/orders/lifecycle";
import { buildOrdersUrl, orderMatchesQueue, orderNeedsAction, type AdminRow } from "@/components/admin/orders/order-view-helpers";

const queueDefinitions = (Object.keys(ADMIN_QUEUE_LABELS) as AdminOrderQueue[]).map((key) => ({
  key,
  label: ADMIN_QUEUE_LABELS[key]
}));

type AdminOrdersToolbarProps = {
  orders: AdminRow[];
  queue: string;
  selectedKey: string;
  filtersQuery: string;
  sort: string;
  onCreateOrder: () => void;
  onShowShortcuts: () => void;
};

export function AdminOrdersToolbar({
  orders,
  queue,
  selectedKey,
  filtersQuery,
  sort,
  onCreateOrder,
  onShowShortcuts
}: AdminOrdersToolbarProps) {
  const queueCounts = queueDefinitions.map((entry) => ({
    ...entry,
    count: orders.filter((order) => orderMatchesQueue(order, entry.key)).length
  }));
  const needsActionCount = orders.filter((order) => orderNeedsAction(order)).length;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div data-admin-orders-kpi-strip className="flex flex-wrap items-center gap-4 text-sm text-[var(--platform-text-secondary)]">
          <span>
            <span className="font-semibold text-[var(--platform-text-primary)]">{needsActionCount}</span> need action
          </span>
          <span>
            <span className="font-semibold text-[var(--platform-text-primary)]">
              {orders.filter((order) => orderMatchesQueue(order, queue)).length}
            </span>{" "}
            in queue
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onShowShortcuts}
            className="h-10 rounded-lg border border-[var(--platform-border)] px-3 text-sm text-[var(--platform-text-muted)] hover:bg-[var(--platform-surface-muted)]"
            title="Keyboard shortcuts"
          >
            ?
          </button>
          <button
            type="button"
            onClick={onCreateOrder}
            className="h-10 rounded-lg border border-violet-600 bg-violet-600/90 px-4 text-sm font-semibold text-white hover:bg-violet-600"
          >
            Create order
          </button>
        </div>
      </div>

      <nav
        data-order-status-board
        data-booking-workflow-board
        aria-label="Order queues"
        className="flex flex-wrap gap-2"
      >
        {queueCounts.map((entry) => {
          const active = queue === entry.key;
          return (
            <Link
              key={entry.key}
              href={buildOrdersUrl({
                queue: entry.key,
                order: selectedKey || undefined,
                q: filtersQuery || undefined,
                sort: sort !== "newest" ? sort : undefined
              })}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-violet-500/50 bg-violet-500/10 text-violet-100"
                  : "border-[var(--platform-border)] bg-[var(--platform-surface-muted)] text-[var(--platform-text-secondary)] hover:border-[var(--platform-border-strong)]"
              }`}
            >
              {entry.label}
              <span className={`rounded px-1 py-0.5 text-[10px] ${active ? "bg-violet-500/20" : "bg-[var(--platform-surface)]"}`}>
                {entry.count}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
