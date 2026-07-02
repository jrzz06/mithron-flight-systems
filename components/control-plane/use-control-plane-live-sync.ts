"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/client";
import { revalidateControlPlaneRealtime } from "@/lib/control-plane/revalidate-realtime";
import { createEnterpriseRealtimeManager, type EnterpriseRealtimeScope } from "@/services/enterprise-realtime";

const DEBOUNCE_MS = 500;

export function useControlPlaneLiveSync(
  scope: EnterpriseRealtimeScope,
  shouldRefresh: (table: string) => boolean,
  enabled = true
) {
  const router = useRouter();
  const pendingTablesRef = useRef(new Set<string>());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    const tables = [...pendingTablesRef.current];
    pendingTablesRef.current.clear();
    flushTimerRef.current = null;
    if (!tables.length) return;

    void Promise.all(tables.map((table) => revalidateControlPlaneRealtime(table))).finally(() => {
      router.refresh();
    });
  }, [router]);

  const scheduleRefresh = useCallback((table: string) => {
    pendingTablesRef.current.add(table);
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    if (!enabled) return undefined;

    const supabase = createClient();
    const manager = createEnterpriseRealtimeManager({
      supabase,
      scope,
      onEvent: (event) => {
        if (shouldRefresh(event.table)) {
          scheduleRefresh(event.table);
        }
      },
      onDiagnostics: () => undefined,
      onReplayRequired: () => scheduleRefresh("orders")
    });

    manager.subscribe();
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      void manager.unsubscribe();
    };
  }, [enabled, flush, scheduleRefresh, scope, shouldRefresh]);
}
