import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type EnterpriseRealtimeScope = "admin" | "cms" | "warehouse" | "operations" | "customer" | "supplier";

export type EnterpriseRealtimeTable =
  | "activity_logs"
  | "cms_pages"
  | "cms_sections"
  | "content_revisions"
  | "deployment_requests"
  | "hero_banners"
  | "inventory"
  | "inventory_movements"
  | "media_assets"
  | "notifications"
  | "order_items"
  | "orders"
  | "product_media_assets"
  | "security_events"
  | "shipments"
  | "shipment_items"
  | "shipment_timeline"
  | "staff_tasks"
  | "warehouse_stock"
  | "enquiries"
  | "payments"
  | "customer_addresses";

export type EnterpriseRealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed"
  | "error";

export type EnterpriseRealtimeEvent = {
  table: EnterpriseRealtimeTable;
  eventType: "INSERT" | "UPDATE" | "DELETE" | "*";
  commitTimestamp?: string | null;
  record?: Record<string, unknown> | null;
  oldRecord?: Record<string, unknown> | null;
};

export type EnterpriseRealtimeDiagnostics = {
  scope: EnterpriseRealtimeScope;
  status: EnterpriseRealtimeStatus;
  channelName: string;
  tables: EnterpriseRealtimeTable[];
  subscribedAt: string | null;
  lastEventAt: string | null;
  lastReplayAt: string | null;
  lastError: string | null;
  receivedEvents: number;
  duplicateEvents: number;
  staleEvents: number;
  reconnectAttempts: number;
  subscriptionErrors: number;
  securityAnomalies: number;
};

export type EnterpriseRealtimeScopeConfig = {
  label: string;
  channelPrefix: string;
  tables: EnterpriseRealtimeTable[];
};

export const STOREFRONT_REALTIME_BLOCKLIST = [
  "mithron_products",
  "hero_slides",
  "cart_sessions",
  "checkout_sessions",
  "storefront_sessions",
  "product_reviews"
] as const;

export const ENTERPRISE_REALTIME_SCOPES: Record<EnterpriseRealtimeScope, EnterpriseRealtimeScopeConfig> = {
  admin: {
    label: "Admin activity",
    channelPrefix: "enterprise-admin",
    tables: [
      "notifications",
      "activity_logs",
      "inventory",
      "warehouse_stock",
      "inventory_movements",
      "orders",
      "shipments",
      "shipment_timeline",
      "deployment_requests",
      "staff_tasks",
      "security_events"
    ]
  },
  cms: {
    label: "CMS revisions",
    channelPrefix: "enterprise-cms",
    tables: [
      "content_revisions",
      "notifications",
      "activity_logs"
    ]
  },
  warehouse: {
    label: "Warehouse live sync",
    channelPrefix: "enterprise-warehouse",
    tables: [
      "inventory",
      "warehouse_stock",
      "inventory_movements",
      "orders",
      "order_items",
      "shipments",
      "shipment_items",
      "shipment_timeline",
      "notifications",
      "activity_logs"
    ]
  },
  operations: {
    label: "Operations live sync",
    channelPrefix: "enterprise-operations",
    tables: [
      "deployment_requests",
      "staff_tasks",
      "notifications",
      "activity_logs",
      "shipments",
      "shipment_timeline"
    ]
  },
  customer: {
    label: "Customer live sync",
    channelPrefix: "enterprise-customer",
    tables: ["notifications", "orders", "order_items", "enquiries", "customer_addresses", "payments"]
  },
  supplier: {
    label: "Supplier live sync",
    channelPrefix: "enterprise-supplier",
    tables: ["notifications", "inventory", "activity_logs"]
  }
};

type StoreOptions = {
  scope: EnterpriseRealtimeScope;
  channelName?: string;
  maxEvents?: number;
};

function nowIso() {
  return new Date().toISOString();
}

function recordId(record: Record<string, unknown> | null | undefined) {
  const value = record?.id ?? record?.asset_id ?? record?.media_asset_id ?? record?.order_number ?? record?.shipment_number;
  return typeof value === "string" || typeof value === "number" ? String(value) : JSON.stringify(record ?? {});
}

export function getEnterpriseRealtimeTables(scope: EnterpriseRealtimeScope) {
  return [...ENTERPRISE_REALTIME_SCOPES[scope].tables];
}

export function createEnterpriseRealtimeEventKey(event: EnterpriseRealtimeEvent) {
  return [
    event.table,
    event.eventType,
    event.commitTimestamp ?? "no-commit",
    recordId(event.record),
    recordId(event.oldRecord)
  ].join(":");
}

export function createEnterpriseRealtimeStore({ scope, channelName, maxEvents = 40 }: StoreOptions) {
  const config = ENTERPRISE_REALTIME_SCOPES[scope];
  const events: EnterpriseRealtimeEvent[] = [];
  const eventKeys = new Set<string>();
  const lastCommitByTable = new Map<EnterpriseRealtimeTable, string>();
  const diagnostics: EnterpriseRealtimeDiagnostics = {
    scope,
    status: "idle",
    channelName: channelName ?? `${config.channelPrefix}:client`,
    tables: [...config.tables],
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
  };

  function trimEvents() {
    while (events.length > maxEvents) {
      const removed = events.pop();
      if (removed) eventKeys.delete(createEnterpriseRealtimeEventKey(removed));
    }
  }

  return {
    recordStatus(status: string, error?: string) {
      if (status === "SUBSCRIBED") {
        diagnostics.status = "connected";
        diagnostics.subscribedAt = nowIso();
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        diagnostics.status = "reconnecting";
        diagnostics.reconnectAttempts += 1;
        diagnostics.subscriptionErrors += 1;
        diagnostics.securityAnomalies += 1;
        diagnostics.lastError = error ?? status;
        return;
      }

      if (status === "CLOSED") {
        diagnostics.status = "closed";
        diagnostics.lastError = error ?? diagnostics.lastError;
        if (error) diagnostics.securityAnomalies += 1;
        return;
      }

      diagnostics.status = status === "connecting" ? "connecting" : diagnostics.status;
    },
    recordEvent(event: EnterpriseRealtimeEvent) {
      const key = createEnterpriseRealtimeEventKey(event);
      if (eventKeys.has(key)) {
        diagnostics.duplicateEvents += 1;
        diagnostics.securityAnomalies += 1;
        return false;
      }

      const previousCommit = event.commitTimestamp ? lastCommitByTable.get(event.table) : null;
      if (event.commitTimestamp && previousCommit && event.commitTimestamp < previousCommit) {
        diagnostics.staleEvents += 1;
        diagnostics.securityAnomalies += 1;
      }
      if (event.commitTimestamp) {
        lastCommitByTable.set(event.table, event.commitTimestamp);
      }

      eventKeys.add(key);
      events.unshift(event);
      trimEvents();
      diagnostics.receivedEvents += 1;
      diagnostics.lastEventAt = nowIso();
      return true;
    },
    markReplay() {
      diagnostics.lastReplayAt = nowIso();
    },
    getEvents() {
      return [...events];
    },
    getDiagnostics() {
      return {
        ...diagnostics,
        tables: [...diagnostics.tables]
      };
    }
  };
}

type RealtimeManagerOptions = {
  supabase: SupabaseClient;
  scope: EnterpriseRealtimeScope;
  channelName?: string;
  maxEvents?: number;
  onEvent?: (event: EnterpriseRealtimeEvent, diagnostics: EnterpriseRealtimeDiagnostics) => void;
  onDiagnostics?: (diagnostics: EnterpriseRealtimeDiagnostics) => void;
  onReplayRequired?: (diagnostics: EnterpriseRealtimeDiagnostics) => void;
};

export function createEnterpriseRealtimeManager({
  supabase,
  scope,
  channelName,
  maxEvents,
  onEvent,
  onDiagnostics,
  onReplayRequired
}: RealtimeManagerOptions) {
  const config = ENTERPRISE_REALTIME_SCOPES[scope];
  const resolvedChannelName = channelName ?? `${config.channelPrefix}:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
  const store = createEnterpriseRealtimeStore({ scope, channelName: resolvedChannelName, maxEvents });
  let channel: RealtimeChannel | null = null;

  function emitDiagnostics() {
    onDiagnostics?.(store.getDiagnostics());
  }

  function subscribe() {
    if (channel) return;
    store.recordStatus("connecting");
    emitDiagnostics();

    channel = supabase.channel(resolvedChannelName);
    for (const table of config.tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        const event: EnterpriseRealtimeEvent = {
          table,
          eventType: payload.eventType,
          commitTimestamp: payload.commit_timestamp,
          record: payload.new as Record<string, unknown> | null,
          oldRecord: payload.old as Record<string, unknown> | null
        };
        const accepted = store.recordEvent(event);
        const diagnostics = store.getDiagnostics();
        if (accepted) onEvent?.(event, diagnostics);
        emitDiagnostics();
      });
    }

    channel.subscribe((status, error) => {
      store.recordStatus(status, error instanceof Error ? error.message : undefined);
      const diagnostics = store.getDiagnostics();
      emitDiagnostics();
      if (status === "SUBSCRIBED" && diagnostics.reconnectAttempts > 0) {
        store.markReplay();
        onReplayRequired?.(store.getDiagnostics());
        emitDiagnostics();
      }
    });
  }

  async function unsubscribe() {
    if (!channel) return;
    const currentChannel = channel;
    channel = null;
    await supabase.removeChannel(currentChannel);
    store.recordStatus("CLOSED");
    emitDiagnostics();
  }

  return {
    subscribe,
    unsubscribe,
    getEvents: store.getEvents,
    getDiagnostics: store.getDiagnostics
  };
}
