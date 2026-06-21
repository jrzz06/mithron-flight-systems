import { ControlShell } from "@/components/admin/control-shell";
import { DataList, StatusBadge } from "@/components/admin/module-panel";
import { getWarehouseSnapshot } from "@/services/admin";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

function text(input: unknown, fallback = "n/a") {
  return typeof input === "string" && input.trim() ? input.trim() : fallback;
}

function metadataValue(row: Record<string, unknown>, key: string) {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export default async function WarehouseActivityPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getWarehouseSnapshot({ scope: "activity" });
  const params = searchParams ? await searchParams : {};
  const actionType = value(params, "action");
  const user = value(params, "user");
  const order = value(params, "order");
  const activityLogs = snapshot.data.activityLogs.filter((row) => {
    const matchesAction = actionType ? text(row.action, "").includes(actionType) : true;
    const matchesUser = user ? text(row.actor_id, "").includes(user) : true;
    const matchesOrder = order ? text(row.entity_id, "").includes(order) || metadataValue(row, "order_id").includes(order) : true;
    return matchesAction && matchesUser && matchesOrder;
  });
  const timelineRows = [
    ...activityLogs.map((row) => ({
      label: text(row.action, "activity"),
      value: text(row.severity, "info"),
      detail: `${text(row.entity_table, "entity")} ${text(row.entity_id, "id")} | actor ${text(row.actor_id, "system")} | ${text(row.created_at, "no timestamp")}`
    })),
    ...snapshot.data.shipmentTimeline.slice(0, 20).map((row) => ({
      label: text(row.event_type, "shipment event"),
      value: text(row.next_status, "status"),
      detail: `shipment ${text(row.shipment_id, "id")} | actor ${text(row.actor_user_id, "system")} | ${text(row.created_at, "no timestamp")}`
    }))
  ].slice(0, 40);
  const packedCount = activityLogs.filter((row) => text(row.action, "").includes("packed") || metadataValue(row, "fulfillment_status") === "packed").length;
  const shippedCount = activityLogs.filter((row) => text(row.action, "").includes("shipped") || metadataValue(row, "shipment_status") === "shipped").length;

  return (
    <ControlShell
      eyebrow="Warehouse activity"
      title="Audit timeline"
      description={snapshot.blockedReason ?? "Warehouse activity combines immutable stock movements, shipment timeline rows, and activity log records."}
      metrics={[
        { label: "Activity", value: String(snapshot.data.activityLogs.length) },
        { label: "Packed", value: String(packedCount) },
        { label: "Shipped", value: String(shippedCount) },
        { label: "Movements", value: String(snapshot.data.movements.length) }
      ]}
      actions={[
        { label: "Picking", href: "/warehouse/picking" },
        { label: "Dispatch", href: "/warehouse/dispatch" },
        { label: "Transfers", href: "/warehouse/transfers" }
      ]}
    >
      <section data-warehouse-activity-timeline className="grid gap-4">
        <form className="sticky top-3 z-20 grid gap-3 rounded-xl border border-white/[0.06] bg-[#10151d]/95 p-3 backdrop-blur-sm md:grid-cols-4">
          <input name="action" defaultValue={actionType} aria-label="Action type" className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100" />
          <input name="user" defaultValue={user} aria-label="User" className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100" />
          <input name="order" defaultValue={order} aria-label="Order" className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100" />
          <button className="h-10 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm font-semibold text-slate-100">Filter</button>
        </form>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
          <DataList rows={timelineRows.length ? timelineRows : [{ label: "Warehouse activity", value: "0", detail: "No warehouse activity rows match the current filters." }]} />
          <aside className="grid content-start gap-3 rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
            <p className="text-sm font-semibold text-slate-100">Action types</p>
            {["warehouse", "shipment", "orders", "inventory"].map((type) => (
              <div key={type} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 py-2">
                <span className="text-sm text-slate-300">{type}</span>
                <StatusBadge status={type} />
              </div>
            ))}
          </aside>
        </div>
      </section>
    </ControlShell>
  );
}
