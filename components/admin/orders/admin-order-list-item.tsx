"use client";

import { OrderProductThumbnail } from "@/components/admin/orders/order-product-thumbnail";
import { OrderStatusBadge } from "@/components/admin/orders/order-status-badge";
import { orderHoverClass } from "@/components/admin/orders/order-detail-primitives";
import { humanStatus } from "@/lib/platform/copy";
import { resolveNextImageSrc } from "@/lib/media/next-image-src";
import {
  assignedWarehouseCode,
  customerName,
  moneyText,
  orderDateParts,
  orderItemsForOrder,
  orderPriorityBadge,
  productSummaryLine,
  publicOrderLabel,
  resolveProductImage,
  text,
  type AdminRow
} from "@/components/admin/orders/order-view-helpers";

type AdminOrderListItemProps = {
  order: AdminRow;
  orderItems: AdminRow[];
  products: AdminRow[];
  defaultWarehouseCode: string;
  selected: boolean;
  isPending: boolean;
  hasShipment: boolean;
  href: string;
  onSelect: () => void;
  onFocus?: () => void;
  tabIndex?: number;
};

function priorityLabel(priority: ReturnType<typeof orderPriorityBadge>) {
  if (priority === "urgent") return { label: "Enquiry", className: "border-amber-500/30 bg-amber-500/10 text-amber-200" };
  if (priority === "action") return { label: "Action", className: "border-violet-500/30 bg-violet-500/10 text-violet-200" };
  if (priority === "payment") return { label: "Unpaid", className: "border-rose-500/30 bg-rose-500/10 text-rose-200" };
  return null;
}

export function AdminOrderListItem({
  order,
  orderItems,
  products,
  defaultWarehouseCode,
  selected,
  isPending,
  hasShipment,
  href,
  onSelect,
  onFocus,
  tabIndex = -1
}: AdminOrderListItemProps) {
  const orderId = text(order.id);
  const orderNumber = publicOrderLabel(order);
  const warehouse = assignedWarehouseCode(order, defaultWarehouseCode);
  const summary = productSummaryLine(orderId, orderItems);
  const items = orderItemsForOrder(orderId, orderItems);
  const firstItem = items[0];
  const thumb = firstItem ? resolveProductImage(products, text(firstItem.product_slug)) : null;
  const thumbSrc = thumb ? resolveNextImageSrc(thumb) : null;
  const priority = priorityLabel(orderPriorityBadge(order));
  const invoiceReady = Boolean(text(order.invoice_url));
  const { date, time } = orderDateParts(order);
  const productQty = firstItem ? Number(firstItem.quantity ?? 1) || 1 : null;
  const paymentLabel = humanStatus(text(order.payment_status, "pending")) || text(order.payment_status, "pending").replaceAll("_", " ");

  return (
    <button
      type="button"
      data-admin-order-row
      aria-current={selected ? "true" : undefined}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onClick={onSelect}
      onAuxClick={(event) => {
        if (event.button === 1 || event.ctrlKey || event.metaKey) {
          event.preventDefault();
          window.open(href, "_blank", "noopener,noreferrer");
        }
      }}
      className={`relative box-border block w-full shrink-0 border-b border-[var(--platform-border)] px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 ${orderHoverClass()} hover:bg-[var(--platform-surface-muted)] ${
        selected
          ? "border-l-[3px] border-l-violet-500 bg-[var(--platform-accent-soft)] pl-[calc(1rem-3px)]"
          : "border-l-[3px] border-l-transparent"
      } ${isPending ? "opacity-60" : ""}`}
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <p className="truncate text-base font-bold leading-snug text-[var(--platform-text-primary)]" title={orderNumber}>
            {orderNumber}
          </p>
          <div className="flex max-w-[46%] flex-col items-end gap-1.5">
            <p className="whitespace-nowrap text-sm font-semibold text-[var(--platform-text-primary)]">
              {moneyText(order.total)}
            </p>
            <OrderStatusBadge status={text(order.status, "pending")} className="max-w-full" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="truncate text-sm font-semibold text-[var(--platform-text-primary)]">{customerName(order)}</p>
          <p className="truncate text-xs text-[var(--platform-text-muted)]">{text(order.customer_email, "No email")}</p>
        </div>

        <div className="flex items-start gap-3">
          <OrderProductThumbnail src={thumbSrc} size="list" className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-sm font-medium leading-snug text-[var(--platform-text-secondary)]">
              {summary.primary}
              {summary.extra > 0 ? ` +${summary.extra} more` : ""}
            </p>
            {productQty ? <p className="mt-1 text-xs text-[var(--platform-text-muted)]">Qty {productQty}</p> : null}
          </div>
        </div>

        <div className="space-y-1.5 border-t border-[var(--platform-border)]/60 pt-2">
          <p className="text-[11px] leading-5 text-[var(--platform-text-muted)]">
            <span>{warehouse}</span>
            <span aria-hidden className="px-1.5">·</span>
            <span>{date}</span>
            <span aria-hidden className="px-1.5">·</span>
            <span>{time}</span>
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] leading-5 text-[var(--platform-text-muted)]">
            <span className="truncate">{paymentLabel}</span>
            {priority ? (
              <span className={`inline-flex h-5 shrink-0 items-center rounded-md border px-2 text-[10px] font-medium ${priority.className}`}>
                {priority.label}
              </span>
            ) : null}
            {invoiceReady ? <span className="shrink-0 text-emerald-300">Invoice</span> : null}
            {hasShipment ? <span className="shrink-0 text-cyan-300">Shipped</span> : null}
            {isPending ? (
              <span className="shrink-0 font-medium uppercase tracking-wide text-[var(--platform-accent)]">Updating…</span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
