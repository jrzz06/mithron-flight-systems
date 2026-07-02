"use client";

import { useControlPlaneLiveSync } from "@/components/control-plane/use-control-plane-live-sync";

const WAREHOUSE_DASHBOARD_TABLES = new Set([
  "orders",
  "order_items",
  "inventory",
  "warehouse_stock",
  "shipments",
  "notifications",
  "activity_logs"
]);

export function WarehouseDashboardLiveSync({ enabled = true }: { enabled?: boolean }) {
  useControlPlaneLiveSync(
    "warehouse",
    (table) => WAREHOUSE_DASHBOARD_TABLES.has(table),
    enabled
  );

  if (!enabled) return null;

  return <div data-warehouse-dashboard-live-sync className="sr-only" aria-hidden="true" />;
}
