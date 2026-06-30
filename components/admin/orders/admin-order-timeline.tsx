"use client";

import { OrderDetailSection } from "@/components/admin/orders/order-detail-primitives";
import { OrderStatusBadge } from "@/components/admin/orders/order-status-badge";
import { fullOrderTimeline, text, type AdminRow } from "@/components/admin/orders/order-view-helpers";

type AdminOrderTimelineProps = {
  order: AdminRow;
};

export function AdminOrderTimeline({ order }: AdminOrderTimelineProps) {
  const timeline = fullOrderTimeline(order);
  const defaultOpen = timeline.length < 5;

  return (
    <OrderDetailSection title="Timeline" collapsible defaultOpen={defaultOpen} dataAttribute="data-order-timeline">
      <div className="relative pl-4">
        <div className="absolute bottom-2 left-[5px] top-2 w-px bg-[var(--platform-border)]" aria-hidden />
        {timeline.length ? (
          <ol className="grid gap-4">
            {timeline.map((entry, index) => {
              const eventLabel = text(entry.note) || text(entry.event, text(entry.summary, "Updated"));
              const eventAt = text(entry.at);
              return (
                <li key={`${text(entry.status, "status")}-${index}`} className="relative py-2">
                  <span className="absolute -left-4 top-3 h-2 w-2 rounded-full border border-violet-400 bg-[var(--platform-surface)]" />
                  <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <OrderStatusBadge status={text(entry.status) || text(entry.event, "updated")} />
                      <span className="text-xs text-[var(--platform-text-muted)]">
                        {eventAt ? eventAt.slice(0, 19).replace("T", " ") : "—"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--platform-text-secondary)]">{eventLabel}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-[var(--platform-text-muted)]">No timeline events yet.</p>
        )}
      </div>
    </OrderDetailSection>
  );
}
