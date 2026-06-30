"use client";

import { useState, type ReactNode } from "react";
import { OrderStatusBadge } from "@/components/admin/orders/order-status-badge";
import {
  assignedWarehouseCode,
  orderPriorityBadge,
  text,
  type AdminRow
} from "@/components/admin/orders/order-view-helpers";

export function orderPanelEnterClass(reducedMotion: boolean, visible: boolean) {
  if (reducedMotion) return "opacity-100";
  return visible
    ? "translate-x-0 opacity-100 transition-all duration-[220ms] ease-out"
    : "translate-x-2 opacity-0 transition-all duration-[220ms] ease-out";
}

export function orderContentSwapClass(reducedMotion: boolean) {
  return reducedMotion ? "" : "transition-opacity duration-[220ms] ease-out";
}

export function orderHoverClass() {
  return "transition-colors duration-150";
}

type OrderDetailShellProps = {
  children: ReactNode;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

export function OrderDetailShell({ children, scrollRef }: OrderDetailShellProps) {
  return (
    <div
      data-order-detail-panel
      className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface)] shadow-sm"
    >
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 xl:px-6"
        style={{ maxHeight: "calc(100vh - 10rem)" }}
      >
        <div className="grid gap-5">{children}</div>
      </div>
    </div>
  );
}

type OrderDetailCardProps = {
  title: string;
  children: ReactNode;
  className?: string;
  hero?: boolean;
  dataAttribute?: string;
};

export function OrderDetailCard({
  title,
  children,
  className = "",
  hero = false,
  dataAttribute
}: OrderDetailCardProps) {
  return (
    <section
      {...(dataAttribute ? { [dataAttribute]: true } : {})}
      className={`rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface)] shadow-sm ${
        hero ? "p-6 xl:p-8" : "p-6"
      } ${className}`}
    >
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type OrderDetailSectionProps = {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
  dataAttribute?: string;
};

export function OrderDetailSection({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  className = "",
  dataAttribute
}: OrderDetailSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <OrderDetailCard title={title} className={className} dataAttribute={dataAttribute}>
        {children}
      </OrderDetailCard>
    );
  }

  return (
    <section
      {...(dataAttribute ? { [dataAttribute]: true } : {})}
      className={`rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface)] p-6 shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">
          {title}
        </h3>
        <span className="text-xs text-[var(--platform-text-muted)]">{open ? "−" : "+"}</span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-[220ms] ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

export function OrderFieldGrid({ children, columns = 1 }: { children: ReactNode; columns?: 1 | 2 }) {
  return (
    <dl className={`grid gap-3 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>{children}</dl>
  );
}

export function OrderField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(96px,36%)_1fr] items-baseline gap-x-3 gap-y-1">
      <dt className="text-xs text-[var(--platform-text-muted)]">{label}</dt>
      <dd className="text-sm font-medium text-[var(--platform-text-primary)]">{value}</dd>
    </div>
  );
}

function priorityLabel(priority: ReturnType<typeof orderPriorityBadge>) {
  if (priority === "urgent") return { label: "Enquiry", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" };
  if (priority === "action") return { label: "Action", className: "border-violet-500/30 bg-violet-500/10 text-violet-200" };
  if (priority === "payment") return { label: "Unpaid", className: "border-rose-500/30 bg-rose-500/10 text-rose-200" };
  return null;
}

type OrderStatusStripProps = {
  order: AdminRow;
  defaultWarehouseCode: string;
};

export function OrderStatusStrip({ order, defaultWarehouseCode }: OrderStatusStripProps) {
  const hasInvoice = Boolean(text(order.invoice_url));
  const invoiceStatus = hasInvoice ? "generated" : text(order.payment_status) === "succeeded" ? "pending" : "not_required";
  const warehouse = assignedWarehouseCode(order, defaultWarehouseCode);
  const priority = priorityLabel(orderPriorityBadge(order));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <OrderStatusBadge status={text(order.status, "pending")} />
      <OrderStatusBadge status={text(order.payment_status, "not_required")} />
      <OrderStatusBadge status={text(order.fulfillment_status, "pending")} />
      <span className="inline-flex h-6 items-center rounded-md border border-[var(--platform-border)] px-2.5 text-xs text-[var(--platform-text-secondary)]">
        Invoice: {invoiceStatus.replaceAll("_", " ")}
      </span>
      <span className="inline-flex h-6 items-center rounded-md border border-[var(--platform-border)] px-2.5 text-xs text-[var(--platform-text-secondary)]">
        WH {warehouse}
      </span>
      {priority ? (
        <span className={`inline-flex h-6 items-center rounded-md border px-2.5 text-xs font-medium ${priority.className}`}>
          {priority.label}
        </span>
      ) : null}
    </div>
  );
}

export function OrderStockBadge({
  available,
  className = ""
}: {
  available: number;
  className?: string;
}) {
  if (available <= 0) {
    return (
      <span className={`inline-flex h-6 items-center rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 text-xs font-medium text-rose-200 ${className}`}>
        Out of stock
      </span>
    );
  }
  if (available <= 5) {
    return (
      <span className={`inline-flex h-6 items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs font-medium text-amber-200 ${className}`}>
        Low stock
      </span>
    );
  }
  return (
    <span className={`inline-flex h-6 items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-200 ${className}`}>
      In stock
    </span>
  );
}

export function ActionGroup({
  title,
  children,
  danger = false
}: {
  title: string;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`grid gap-3 ${danger ? "rounded-lg border border-rose-500/20 bg-rose-950/10 p-4" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">{title}</p>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}
