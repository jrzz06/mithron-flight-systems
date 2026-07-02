"use client";

import { useControlPlaneLiveSync } from "@/components/control-plane/use-control-plane-live-sync";

const ADMIN_DASHBOARD_TABLES = new Set([
  "orders",
  "inventory",
  "mithron_products",
  "enquiries",
  "notifications",
  "activity_logs"
]);

export function AdminDashboardLiveSync({ enabled = true }: { enabled?: boolean }) {
  useControlPlaneLiveSync(
    "admin",
    (table) => ADMIN_DASHBOARD_TABLES.has(table),
    enabled
  );

  if (!enabled) return null;

  return <div data-admin-dashboard-live-sync className="sr-only" aria-hidden="true" />;
}
