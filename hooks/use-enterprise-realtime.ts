"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/client";
import {
  createEnterpriseRealtimeManager,
  type EnterpriseRealtimeDiagnostics,
  type EnterpriseRealtimeEvent,
  type EnterpriseRealtimeScope
} from "@/services/enterprise-realtime";

const defaultDiagnostics = (scope: EnterpriseRealtimeScope): EnterpriseRealtimeDiagnostics => ({
  scope,
  status: "idle",
  channelName: `enterprise-${scope}:pending`,
  tables: [],
  subscribedAt: null,
  lastEventAt: null,
  lastReplayAt: null,
  lastError: null,
  receivedEvents: 0,
  duplicateEvents: 0,
  staleEvents: 0,
  reconnectAttempts: 0,
  subscriptionErrors: 0,
  securityAnomalies: 0
});

export function useEnterpriseRealtime(scope: EnterpriseRealtimeScope, options: { refreshOnEvent?: boolean } = {}) {
  const refreshOnEvent = options.refreshOnEvent ?? false;
  const [supabase] = useState(() => createClient());
  const [events, setEvents] = useState<EnterpriseRealtimeEvent[]>([]);
  const [diagnostics, setDiagnostics] = useState<EnterpriseRealtimeDiagnostics>(() => defaultDiagnostics(scope));
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    function scheduleRefresh() {
      if (!refreshOnEvent) return;
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        startTransition(() => {
          setDiagnostics((current) => ({
            ...current,
            lastReplayAt: new Date().toISOString()
          }));
        });
      }, 650);
    }

    const manager = createEnterpriseRealtimeManager({
      supabase,
      scope,
      onEvent: () => {
        setEvents(manager.getEvents());
        scheduleRefresh();
      },
      onDiagnostics: setDiagnostics,
      onReplayRequired: () => {
        scheduleRefresh();
      }
    });

    manager.subscribe();

    return () => {
      if (refreshTimer.current) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      void manager.unsubscribe();
    };
  }, [refreshOnEvent, scope, supabase]);

  return { events, diagnostics };
}
