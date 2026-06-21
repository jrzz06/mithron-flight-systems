import { ControlShell } from "@/components/admin/control-shell";
import { DataList } from "@/components/admin/module-panel";
import { getWarehouseSnapshot } from "@/services/admin";

export const dynamic = "force-dynamic";

function text(input: unknown, fallback = "n/a") {
  return typeof input === "string" && input.trim() ? input.trim() : fallback;
}

function numberValue(input: unknown) {
  const parsed = Number(input ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function WarehouseSettingsPage() {
  const snapshot = await getWarehouseSnapshot({ scope: "settings" });
  const warehouseCodes = Array.from(new Set(snapshot.data.stock.map((row) => text(row.warehouse_code, "")).filter(Boolean))).sort();
  const carrierNames = Array.from(new Set(snapshot.data.shipments.map((row) => text(row.carrier_name, "")).filter(Boolean))).sort();
  const thresholds = snapshot.data.inventory
    .filter((row) => numberValue(row.reorder_threshold) > 0)
    .slice(0, 12)
    .map((row) => ({
      label: `${text(row.product_slug, "product")} / ${text(row.sku, "sku")}`,
      value: String(row.reorder_threshold ?? 0),
      detail: `quantity ${String(row.quantity ?? 0)} | status ${text(row.stock_status, "available")}`
    }));

  return (
    <ControlShell
      eyebrow="Warehouse settings"
      title="Operational defaults"
      description={snapshot.blockedReason ?? "Warehouse settings are derived from real warehouse rows until a dedicated warehouse configuration table is added."}
      metrics={[
        { label: "Warehouse codes", value: String(warehouseCodes.length) },
        { label: "Carriers", value: String(carrierNames.length) },
        { label: "Thresholds", value: String(thresholds.length) }
      ]}
      actions={[
        { label: "Inventory", href: "/warehouse/inventory" },
        { label: "Transfers", href: "/warehouse/transfers" },
        { label: "Activity", href: "/warehouse/activity" }
      ]}
    >
      <section data-warehouse-settings className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
          <p className="text-sm font-semibold text-slate-100">Warehouse codes</p>
          <div className="mt-3 grid gap-2">
            {warehouseCodes.length ? warehouseCodes.map((code) => (
              <div key={code} className="rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 py-2 text-sm text-slate-300">{code}</div>
            )) : (
              <p className="text-sm text-slate-500">No warehouse stock rows define a warehouse code.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
          <p className="text-sm font-semibold text-slate-100">Shipping defaults</p>
          <div className="mt-3 grid gap-2">
            {carrierNames.length ? carrierNames.map((carrier) => (
              <div key={carrier} className="rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 py-2 text-sm text-slate-300">{carrier}</div>
            )) : (
              <p className="text-sm text-slate-500">No courier names are available from shipment rows.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
          <p className="text-sm font-semibold text-slate-100">Packing slip template</p>
          <p className="mt-3 text-sm text-slate-400">Uses order number, order items, shipment number, warehouse code, courier, and tracking number from live order and shipment rows.</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
          <p className="text-sm font-semibold text-slate-100">Printer and barcode settings</p>
          <p className="mt-3 text-sm text-slate-400">Barcode-ready fields use order number, SKU, shipment number, and warehouse code. Printer persistence is not configured in the current data model.</p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#10151d] p-4 lg:col-span-2">
          <p className="mb-3 text-sm font-semibold text-slate-100">Low-stock thresholds</p>
          <DataList rows={thresholds.length ? thresholds : [{ label: "Thresholds", value: "0", detail: "No product-level reorder thresholds are configured in inventory rows." }]} />
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#10151d] p-4 lg:col-span-2">
          <p className="text-sm font-semibold text-slate-100">Notification preferences</p>
          <p className="mt-3 text-sm text-slate-400">Warehouse alerts are emitted by shipment and inventory server actions through the existing notifications and activity log tables.</p>
        </div>
      </section>
    </ControlShell>
  );
}
