import Link from "next/link";
import { ControlShell } from "@/components/admin/control-shell";
import { DataList, StatusBadge } from "@/components/admin/module-panel";
import { getWarehouseSnapshot } from "@/services/admin";

export const dynamic = "force-dynamic";

function text(value: unknown, fallback = "n/a") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isToday(value: unknown) {
  const raw = text(value, "");
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear()
    && date.getUTCMonth() === now.getUTCMonth()
    && date.getUTCDate() === now.getUTCDate();
}

export default async function WarehouseDashboardPage() {
  const snapshot = await getWarehouseSnapshot({ scope: "dashboard" });
  const pendingOrders = snapshot.data.orders.filter((order) => text(order.fulfillment_status, "pending") === "pending");
  const pickingQueue = snapshot.data.orders.filter((order) => ["pending", "processing"].includes(text(order.fulfillment_status, "pending")));
  const packedReady = snapshot.data.orders.filter((order) => ["packed", "ready_to_dispatch"].includes(text(order.fulfillment_status, "pending")));
  const dispatchedToday = snapshot.data.shipments.filter((shipment) => ["shipped", "in_transit", "delivered"].includes(text(shipment.shipment_status, "pending")) && isToday(shipment.updated_at));
  const delayedShipments = snapshot.data.shipments.filter((shipment) => ["pending", "reserved", "packed", "ready_for_pickup"].includes(text(shipment.shipment_status, "pending")));
  const lowStock = snapshot.data.inventory.filter((row) => ["low_stock", "out_of_stock"].includes(text(row.stock_status, "available")));
  const returns = snapshot.data.shipments.filter((shipment) => ["returned", "damaged", "failed"].includes(text(shipment.shipment_status, "pending")));
  const movementRows = snapshot.data.movements.slice(0, 6).map((movement) => ({
    label: `${text(movement.movement_type, "movement")} | ${text(movement.product_slug, "product")}`,
    value: `${Number(movement.quantity_delta ?? 0) >= 0 ? "+" : ""}${String(movement.quantity_delta ?? 0)}`,
    detail: `${text(movement.sku, "sku")} | ${text(movement.reason_code, "reason")} | ${text(movement.created_at, "no timestamp")}`
  }));

  const widgets = [
    { label: "pending orders", value: pendingOrders.length, href: "/warehouse/orders", status: pendingOrders.length ? "pending" : "clear" },
    { label: "picking queue", value: pickingQueue.length, href: "/warehouse/picking", status: pickingQueue.length ? "processing" : "clear" },
    { label: "packed ready count", value: packedReady.length, href: "/warehouse/packing", status: packedReady.length ? "packed" : "clear" },
    { label: "dispatched today", value: dispatchedToday.length, href: "/warehouse/dispatch", status: "shipped" },
    { label: "delayed shipments", value: delayedShipments.length, href: "/warehouse/dispatch", status: delayedShipments.length ? "warning" : "clear" },
    { label: "low stock alerts", value: lowStock.length, href: "/warehouse/inventory", status: lowStock.length ? "low_stock" : "clear" },
    { label: "warehouse efficiency", value: snapshot.data.shipments.length ? Math.round((dispatchedToday.length / Math.max(1, snapshot.data.shipments.length)) * 100) : 0, href: "/warehouse/activity", status: "live", suffix: "%" },
    { label: "return requests", value: returns.length, href: "/warehouse/returns", status: returns.length ? "returned" : "clear" },
    { label: "inventory movement stats", value: snapshot.data.movements.length, href: "/warehouse/activity", status: "movement" }
  ];

  return (
    <ControlShell
      eyebrow="Warehouse operations"
      title="Dispatch workspace"
      description={snapshot.blockedReason ?? "Task-first warehouse control for picking, packing, dispatch, returns, and stock movement monitoring."}
      metrics={[
        { label: "Orders", value: String(snapshot.data.orders.length) },
        { label: "Shipments", value: String(snapshot.data.shipments.length) },
        { label: "Stock rows", value: String(snapshot.data.stock.length) },
        { label: "Status", value: snapshot.status }
      ]}
      actions={[
        { label: "Picking", href: "/warehouse/picking" },
        { label: "Packing", href: "/warehouse/packing" },
        { label: "Dispatch", href: "/warehouse/dispatch" }
      ]}
    >
      <section data-warehouse-route data-warehouse-live-dashboard data-warehouse-operational-dashboard className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {widgets.map((widget) => (
            <Link
              key={widget.label}
              href={widget.href}
              className="rounded-xl border border-white/[0.06] bg-[#10151d] p-4 shadow-[0_6px_20px_rgba(0,0,0,0.18)] transition duration-150 hover:-translate-y-px hover:border-emerald-400/20"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">{widget.label}</p>
                <StatusBadge status={widget.status} />
              </div>
              <p className="mt-3 font-[var(--type-display)] text-3xl font-semibold text-slate-100">{widget.value}{widget.suffix ?? ""}</p>
            </Link>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_.85fr]">
          <section className="grid gap-3 rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
            <p className="text-sm font-semibold text-slate-100">Low stock queue</p>
            <DataList
              rows={lowStock.slice(0, 8).map((row) => ({
                label: `${text(row.product_slug, "product")} / ${text(row.sku, "sku")}`,
                value: text(row.stock_status, "stock"),
                detail: `qty ${String(row.quantity ?? 0)} | reserved ${String(row.reserved_quantity ?? 0)} | reorder ${String(row.reorder_threshold ?? 0)}`
              })).concat(lowStock.length ? [] : [{ label: "Inventory", value: "Clear", detail: "No low-stock rows in the current warehouse page." }])}
            />
          </section>
          <section className="grid gap-3 rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
            <p className="text-sm font-semibold text-slate-100">Recent movement stats</p>
            <DataList rows={movementRows.length ? movementRows : [{ label: "Movements", value: "0", detail: "No warehouse movement rows are visible." }]} />
          </section>
        </div>
      </section>
    </ControlShell>
  );
}
