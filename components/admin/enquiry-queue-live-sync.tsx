"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/client";
import { createEnterpriseRealtimeManager } from "@/services/enterprise-realtime";

export function EnquiryQueueLiveSync({ enabled = true }: { enabled?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return undefined;
    const supabase = createClient();
    const manager = createEnterpriseRealtimeManager({
      supabase,
      scope: "admin",
      onEvent: (event) => {
        if (event.table === "enquiries" || event.table === "orders" || event.table === "notifications") {
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

  return <div data-enquiry-live-sync className="sr-only" aria-hidden="true" />;
}
