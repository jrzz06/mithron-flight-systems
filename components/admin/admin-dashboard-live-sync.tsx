"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/client";
import { createEnterpriseRealtimeManager } from "@/services/enterprise-realtime";

export function AdminDashboardLiveSync({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return undefined;
    const supabase = createClient();
    const manager = createEnterpriseRealtimeManager({
      supabase,
      scope: "admin",
      onEvent: (event) => {
        if (["orders", "inventory", "mithron_products", "enquiries", "notifications", "activity_logs"].includes(event.table)) {
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

  return <div data-admin-dashboard-live-sync className="sr-only" aria-hidden="true" />;
}
