"use client";

import { useControlPlaneLiveSync } from "@/components/control-plane/use-control-plane-live-sync";

const TRIGGER_TABLES = new Set(["inventory", "warehouse_stock", "inventory_movements"]);

export function AdminInventoryLiveSync({ enabled = true }: { enabled?: boolean }) {
  useControlPlaneLiveSync(
    "admin",
    (table) => TRIGGER_TABLES.has(table),
    enabled
  );

  if (!enabled) return null;

  return <div data-admin-inventory-live-sync className="sr-only" aria-hidden="true" />;
}
