import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENTERPRISE_REALTIME_SCOPES,
  STOREFRONT_REALTIME_BLOCKLIST,
  createEnterpriseRealtimeStore,
  getEnterpriseRealtimeTables,
  type EnterpriseRealtimeEvent
} from "@/services/enterprise-realtime";

function readWorkspaceFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("enterprise realtime reliability", () => {
  it("defines one canonical operational realtime scope map without storefront realtime tables", () => {
    expect(getEnterpriseRealtimeTables("warehouse")).toEqual(
      expect.arrayContaining([
        "inventory",
        "warehouse_stock",
        "inventory_movements",
        "shipments",
        "shipment_items",
        "shipment_timeline",
        "notifications",
        "activity_logs"
      ])
    );
    expect(getEnterpriseRealtimeTables("operations")).toEqual(
      expect.arrayContaining(["deployment_requests", "staff_tasks", "notifications", "activity_logs"])
    );
    expect(getEnterpriseRealtimeTables("cms")).toEqual(
      expect.arrayContaining(["content_revisions", "notifications", "activity_logs"])
    );
    expect(getEnterpriseRealtimeTables("cms")).not.toEqual(
      expect.arrayContaining(["hero_banners", "homepage_sections", "media_assets", "product_media_assets"])
    );
    expect(getEnterpriseRealtimeTables("admin")).toEqual(
      expect.arrayContaining(["notifications", "activity_logs", "inventory", "warehouse_stock", "orders", "inventory_movements", "shipments", "deployment_requests"])
    );

    const allOperationalTables = new Set<string>(Object.values(ENTERPRISE_REALTIME_SCOPES).flatMap((scope) => scope.tables));
    for (const blockedTable of STOREFRONT_REALTIME_BLOCKLIST) {
      expect(allOperationalTables.has(blockedTable)).toBe(false);
    }
  });

  it("deduplicates events, bounds the event buffer, and tracks reconnect diagnostics", () => {
    const store = createEnterpriseRealtimeStore({ scope: "warehouse", maxEvents: 2 });
    const firstEvent: EnterpriseRealtimeEvent = {
      table: "inventory_movements",
      eventType: "INSERT",
      commitTimestamp: "2026-05-24T10:00:00.000Z",
      record: { id: "movement-1", notes: "first" }
    };

    store.recordStatus("SUBSCRIBED");
    store.recordEvent(firstEvent);
    store.recordEvent(firstEvent);
    store.recordEvent({
      table: "shipments",
      eventType: "UPDATE",
      commitTimestamp: "2026-05-24T10:00:01.000Z",
      record: { id: "shipment-1", notes: "second" }
    });
    store.recordEvent({
      table: "notifications",
      eventType: "INSERT",
      commitTimestamp: "2026-05-24T10:00:02.000Z",
      record: { id: "notification-1", title: "third" }
    });
    store.recordStatus("CHANNEL_ERROR", "network reset");
    store.recordStatus("SUBSCRIBED");

    const diagnostics = store.getDiagnostics();
    expect(store.getEvents()).toHaveLength(2);
    expect(store.getEvents().map((event) => event.table)).toEqual(["notifications", "shipments"]);
    expect(diagnostics.duplicateEvents).toBe(1);
    expect(diagnostics.reconnectAttempts).toBe(1);
    expect(diagnostics.status).toBe("connected");
    expect(diagnostics.lastError).toBe("network reset");
  });

  it("adds protected diagnostics UI only to admin, CMS, warehouse, and operations surfaces", () => {
    const panelPath = join(process.cwd(), "components/admin/enterprise-realtime-panel.tsx");
    expect(existsSync(panelPath)).toBe(true);

    const panel = readFileSync(panelPath, "utf8");
    const hook = readWorkspaceFile("hooks/use-enterprise-realtime.ts");
    const warehousePage = readWorkspaceFile("app/warehouse/page.tsx");
    const operationsPage = readWorkspaceFile("app/operations/page.tsx");
    const cmsPage = readWorkspaceFile("app/admin/cms/page.tsx");
    const storefrontPage = readWorkspaceFile("app/(storefront)/page.tsx");

    expect(panel).toContain("data-enterprise-realtime-panel");
    expect(hook).not.toContain("router.refresh");
    expect(hook).toContain("refreshOnEvent");
    expect(warehousePage).not.toContain("EnterpriseRealtimePanel");
    expect(operationsPage).not.toContain("EnterpriseRealtimePanel");
    expect(operationsPage).toContain("data-operations-route");
    expect(cmsPage).not.toContain("EnterpriseRealtimePanel");
    expect(storefrontPage).not.toContain("EnterpriseRealtimePanel");
    expect(storefrontPage).not.toContain("useEnterpriseRealtime");
  });

  it("keeps realtime publication expansion additive, operational, and verifier-backed", () => {
    const migration = readWorkspaceFile("supabase/migrations/20260524000800_enterprise_realtime_reliability.sql");
    const verifier = readWorkspaceFile("tools/verify-enterprise-remote-workflows.mjs");

    for (const table of [
      "inventory",
      "warehouse_stock",
      "inventory_movements",
      "orders",
      "order_items",
      "shipments",
      "shipment_items",
      "shipment_timeline",
      "deployment_requests",
      "staff_tasks",
      "notifications",
      "activity_logs",
      "content_revisions"
    ]) {
      expect(migration).toContain(table);
    }

    expect(migration).toContain("replica identity full");
    expect(migration).toContain("alter publication supabase_realtime add table");
    expect(verifier).toContain("verifyRealtimeReliability");
    expect(verifier).toContain("verifyRealtimeIsolation");
    expect(verifier).toContain("reconnectRecovery");
    expect(verifier).toContain("settleMs");
    expect(verifier).toContain("maxAttempts");
  });
});
