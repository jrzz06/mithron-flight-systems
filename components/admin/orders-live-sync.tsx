"use client";

import { useControlPlaneLiveSync } from "@/components/control-plane/use-control-plane-live-sync";

const ORDERS_TABLES = new Set([
  "orders",
  "order_items",
  "inventory",
  "contact_requests",
  "notifications"
]);

export function OrdersLiveSync({ enabled = true }: { enabled?: boolean }) {
  useControlPlaneLiveSync(
    "admin",
    (table) => ORDERS_TABLES.has(table),
    enabled
  );

  if (!enabled) return null;

  return <div data-orders-live-sync className="sr-only" aria-hidden="true" />;
}
