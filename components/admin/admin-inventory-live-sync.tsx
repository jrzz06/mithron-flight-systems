"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/client";
import { createEnterpriseRealtimeManager } from "@/services/enterprise-realtime";

const TRIGGER_TABLES = new Set(["inventory", "warehouse_stock", "inventory_movements"]);

export function AdminInventoryLiveSync({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return undefined;
    const supabase = createClient();
    const manager = createEnterpriseRealtimeManager({
      supabase,
      scope: "admin",
      onEvent: (event) => {
        if (TRIGGER_TABLES.has(event.table)) {
          router.refresh();
        }
      },
      onDiagnostics: () => undefined,
      onReplayRequired: () => router.refresh()
    });

    manager.subscribe();
    return () => {
      void manager.unsubscribe();
    };
  }, [enabled, router]);

  if (!enabled) return null;

  return <div data-admin-inventory-live-sync className="sr-only" aria-hidden="true" />;
}
