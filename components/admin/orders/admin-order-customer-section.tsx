"use client";

import Link from "next/link";
import { OrderDetailSection, OrderField, OrderFieldGrid } from "@/components/admin/orders/order-detail-primitives";
import {
  buildOrdersUrl,
  customerName,
  orderMetadata,
  orderPhone,
  priorOrdersForCustomer,
  publicOrderLabel,
  text,
  type AdminRow
} from "@/components/admin/orders/order-view-helpers";

type AdminOrderCustomerSectionProps = {
  order: AdminRow;
  allOrders: AdminRow[];
  queue: string;
  filtersQuery: string;
  onSelectOrder?: (orderNumber: string) => void;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function AdminOrderCustomerSection({
  order,
  allOrders,
  queue,
  filtersQuery,
  onSelectOrder
}: AdminOrderCustomerSectionProps) {
  const metadata = orderMetadata(order);
  const name = customerName(order);
  const prior = priorOrdersForCustomer(order, allOrders);

  return (
    <OrderDetailSection title="Customer">
      <div className="flex gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-500/15 text-sm font-semibold text-violet-200">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-base font-semibold text-[var(--platform-text-primary)]">{name}</p>
          {text(order.customer_email) ? (
            <Link
              href={`/admin/users?q=${encodeURIComponent(text(order.customer_email))}`}
              className="text-sm text-violet-300 hover:underline"
            >
              {text(order.customer_email)}
            </Link>
          ) : (
            <p className="text-sm text-[var(--platform-text-muted)]">No email</p>
          )}
        </div>
      </div>
      <div className="mt-4">
        <OrderFieldGrid columns={2}>
          <OrderField label="Phone" value={orderPhone(order) || "—"} />
          {text(metadata.customer_company) ? (
            <OrderField label="Company" value={text(metadata.customer_company)} />
          ) : null}
        </OrderFieldGrid>
      </div>
      {text(metadata.customer_note) || text(metadata.enquiry_message) ? (
        <div className="mt-4 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4 text-sm leading-relaxed text-[var(--platform-text-secondary)]">
          {text(metadata.customer_note) ? <p>Note: {text(metadata.customer_note)}</p> : null}
          {text(metadata.enquiry_message) ? <p className="mt-2">Enquiry: {text(metadata.enquiry_message)}</p> : null}
        </div>
      ) : null}
      {prior.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">
            Previous orders ({prior.length})
          </p>
          <ul className="mt-2 space-y-1.5">
            {prior.map((priorOrder) => {
              const label = publicOrderLabel(priorOrder);
              const href = buildOrdersUrl({
                queue,
                order: label,
                q: filtersQuery || undefined
              });
              return (
                <li key={text(priorOrder.id)}>
                  {onSelectOrder ? (
                    <button
                      type="button"
                      onClick={() => onSelectOrder(label)}
                      className="text-sm text-violet-300 hover:underline"
                    >
                      {label} · {text(priorOrder.status)}
                    </button>
                  ) : (
                    <Link href={href} className="text-sm text-violet-300 hover:underline">
                      {label} · {text(priorOrder.status)}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </OrderDetailSection>
  );
}
