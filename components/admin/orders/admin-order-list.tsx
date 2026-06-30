"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { AdminTableShell } from "@/components/admin/module-panel";
import { AdminOrderListItem } from "@/components/admin/orders/admin-order-list-item";
import { publicOrderLabel, text, type AdminRow } from "@/components/admin/orders/order-view-helpers";

type AdminOrderListProps = {
  orders: AdminRow[];
  orderItems: AdminRow[];
  products: AdminRow[];
  shipments: AdminRow[];
  defaultWarehouseCode: string;
  selectedKey: string;
  selectedOrderId: string;
  buildOrderHref: (orderNumber: string) => string;
  onSelectOrder: (orderNumber: string) => void;
  blockedReason?: string | null;
  focusedIndex: number;
  onFocusIndex: (index: number) => void;
};

export function AdminOrderList({
  orders,
  orderItems,
  products,
  shipments,
  defaultWarehouseCode,
  selectedKey,
  selectedOrderId,
  buildOrderHref,
  onSelectOrder,
  blockedReason,
  focusedIndex,
  onFocusIndex
}: AdminOrderListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const listScrollTopRef = useRef(0);

  useEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    const onScroll = () => {
      listScrollTopRef.current = parent.scrollTop;
    };
    parent.addEventListener("scroll", onScroll, { passive: true });
    return () => parent.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const parent = parentRef.current;
    if (!parent) return;
    parent.scrollTop = listScrollTopRef.current;
  }, [selectedKey, selectedOrderId]);

  return (
    <AdminTableShell
      title={`Orders (${orders.length})`}
      description={blockedReason ?? undefined}
      className="flex h-full min-h-0 flex-col [&>div:last-child]:flex [&>div:last-child]:min-h-0 [&>div:last-child]:flex-1 [&>div:last-child]:flex-col"
    >
      {!orders.length ? (
        <p className="px-3 py-4 text-sm text-[var(--platform-text-muted)]">No orders match this queue.</p>
      ) : (
        <div
          ref={parentRef}
          data-admin-orders-list
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        >
          <div className="flex flex-col">
            {orders.map((order, index) => {
              const orderId = text(order.id);
              const orderNumber = publicOrderLabel(order);
              const isSelected = selectedKey === orderNumber || selectedOrderId === orderId;
              const hasShipment = shipments.some((s) => text(s.order_id) === orderId);

              return (
                <AdminOrderListItem
                  key={orderId || orderNumber}
                  order={order}
                  orderItems={orderItems}
                  products={products}
                  defaultWarehouseCode={defaultWarehouseCode}
                  selected={isSelected}
                  isPending={Boolean(order._optimistic_pending)}
                  hasShipment={hasShipment}
                  href={buildOrderHref(orderNumber)}
                  onSelect={() => onSelectOrder(orderNumber)}
                  tabIndex={focusedIndex === index ? 0 : -1}
                  onFocus={() => onFocusIndex(index)}
                />
              );
            })}
          </div>
        </div>
      )}
    </AdminTableShell>
  );
}
