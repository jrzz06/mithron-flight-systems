"use client";

import { useControlPlaneLiveSync } from "@/components/control-plane/use-control-plane-live-sync";

const TRIGGER_TABLES = new Set(["orders", "order_items", "shipments", "shipment_timeline"]);

export function WarehouseOpsLiveSync({ enabled = true }: { enabled?: boolean }) {
  useControlPlaneLiveSync(
    "warehouse",
    (table) => TRIGGER_TABLES.has(table),
    enabled
  );

  if (!enabled) return null;

  return <div data-warehouse-ops-live-sync className="sr-only" aria-hidden="true" />;
}
