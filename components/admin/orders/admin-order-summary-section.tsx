"use client";

import { customerOrderSourceLabel } from "@/lib/orders/lifecycle";
import { OrderDetailCard, OrderStatusStrip } from "@/components/admin/orders/order-detail-primitives";
import {
  moneyText,
  orderDateTime,
  publicOrderLabel,
  type AdminRow
} from "@/components/admin/orders/order-view-helpers";

type AdminOrderSummarySectionProps = {
  order: AdminRow;
  defaultWarehouseCode: string;
};

export function AdminOrderSummarySection({ order, defaultWarehouseCode }: AdminOrderSummarySectionProps) {
  return (
    <OrderDetailCard title="Order summary" hero>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h2 className="text-2xl font-bold text-[var(--platform-text-primary)]">{publicOrderLabel(order)}</h2>
          <p className="text-sm text-[var(--platform-text-muted)]">
            {customerOrderSourceLabel(order)} · {orderDateTime(order)}
          </p>
        </div>
        <p className="text-2xl font-bold text-[var(--platform-text-primary)]">{moneyText(order.total)}</p>
      </div>
      <div className="mt-5">
        <OrderStatusStrip order={order} defaultWarehouseCode={defaultWarehouseCode} />
      </div>
    </OrderDetailCard>
  );
}
