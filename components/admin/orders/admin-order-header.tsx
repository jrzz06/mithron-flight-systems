"use client";

import { StatusBadge } from "@/components/admin/module-panel";
import {
  customerOrderSourceLabel
} from "@/lib/orders/lifecycle";
import {
  moneyText,
  orderDateTime,
  orderStatusLabel,
  publicOrderLabel,
  text,
  type AdminRow
} from "@/components/admin/orders/order-view-helpers";

type AdminOrderHeaderProps = {
  order: AdminRow;
  snapshotStatus: string;
};

export function AdminOrderHeader({ order, snapshotStatus }: AdminOrderHeaderProps) {
  const hasInvoice = Boolean(text(order.invoice_url));
  const invoiceStatus = hasInvoice ? "generated" : text(order.payment_status) === "succeeded" ? "pending" : "not_required";

  return (
    <header className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--platform-text-muted)]">Order</p>
          <h2 className="text-lg font-semibold text-[var(--platform-text-primary)]">{publicOrderLabel(order)}</h2>
          <p className="mt-0.5 text-xs text-[var(--platform-text-muted)]">
            {customerOrderSourceLabel(order)} · {orderDateTime(order)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-[var(--platform-text-primary)]">{moneyText(order.total)}</p>
          <StatusBadge status={snapshotStatus} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusBadge status={text(order.status, "pending")} />
        <StatusBadge status={text(order.payment_status, "not_required")} />
        <StatusBadge status={text(order.fulfillment_status, "pending")} />
        <span className="rounded-md border border-[var(--platform-border)] px-2 py-0.5 text-[11px] text-[var(--platform-text-secondary)]">
          Invoice: {invoiceStatus.replaceAll("_", " ")}
        </span>
        <span className="rounded-md border border-[var(--platform-border)] px-2 py-0.5 text-[11px] text-[var(--platform-text-secondary)]">
          {orderStatusLabel(text(order.status, "pending"))}
        </span>
      </div>
    </header>
  );
}
