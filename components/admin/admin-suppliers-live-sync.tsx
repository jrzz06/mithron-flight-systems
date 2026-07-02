"use client";

import { useControlPlaneLiveSync } from "@/components/control-plane/use-control-plane-live-sync";

const TRIGGER_TABLES = new Set(["mithron_products", "notifications"]);

export function AdminSuppliersLiveSync({ enabled = true }: { enabled?: boolean }) {
  useControlPlaneLiveSync(
    "admin",
    (table) => TRIGGER_TABLES.has(table),
    enabled
  );

  if (!enabled) return null;

  return <div data-admin-suppliers-live-sync className="sr-only" aria-hidden="true" />;
}
