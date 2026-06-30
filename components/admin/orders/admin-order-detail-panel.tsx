"use client";

import { ClipboardList } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotionPreference } from "@/hooks/use-reduced-motion";
import { orderContentSwapClass, orderPanelEnterClass } from "@/components/admin/orders/order-detail-primitives";

type AdminOrderDetailPanelProps = {
  orderId: string;
  children: ReactNode;
};

export function AdminOrderDetailPanel({ orderId, children }: AdminOrderDetailPanelProps) {
  const reducedMotion = useReducedMotionPreference();
  const [visible, setVisible] = useState(reducedMotion);
  const previousOrderId = useRef(orderId);

  useEffect(() => {
    if (reducedMotion) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);

  useEffect(() => {
    if (previousOrderId.current !== orderId) {
      previousOrderId.current = orderId;
    }
  }, [orderId]);

  return (
    <div
      data-admin-order-detail-panel
      className={`min-h-[560px] ${orderPanelEnterClass(reducedMotion, reducedMotion || visible)}`}
    >
      <div key={orderId} className={orderContentSwapClass(reducedMotion)}>
        {children}
      </div>
    </div>
  );
}

export function AdminOrderDetailEmpty() {
  return (
    <div
      data-order-detail-panel
      className="flex min-h-[560px] flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[var(--platform-border)] bg-[var(--platform-surface-muted)]/30 px-8 py-12 text-center"
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--platform-surface-muted)] text-[var(--platform-text-muted)]">
        <ClipboardList className="h-7 w-7" aria-hidden />
      </div>
      <div>
        <p className="text-sm font-semibold text-[var(--platform-text-primary)]">Select an order</p>
        <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
          Choose an order from the queue to review payment, fulfillment, and customer details.
        </p>
      </div>
    </div>
  );
}
