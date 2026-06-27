import Link from "next/link";
import { ControlShell } from "@/components/admin/control-shell";
import { WarehouseOpsLiveSync } from "@/components/warehouse/warehouse-ops-live-sync";
import { shipmentStatusLabel } from "@/lib/warehouse/operational-labels";
import { getWarehouseSnapshot } from "@/services/admin";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";
import { getCurrentAuthContext } from "@/services/auth";
import { filterShipmentsForWarehouseScope, resolveWarehouseScope } from "@/services/warehouse-scope";
import { connectivityMessage } from "@/lib/platform/copy";

export const dynamic = "force-dynamic";

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDate(value: unknown) {
  const raw = text(value, "");
  if (!raw || raw === "—") return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function WarehouseShipmentsPage() {
  const [snapshot, policy, auth] = await Promise.all([
    getWarehouseSnapshot({ scope: "dispatch" }),
    getAdminSettingsPolicy(),
    getCurrentAuthContext()
  ]);
  const scope = await resolveWarehouseScope({ userId: auth.userId, role: auth.role });
  const shipments = filterShipmentsForWarehouseScope(snapshot.data.shipments, scope);
  const ordersById = new Map(snapshot.data.orders.map((order) => [text(order.id, ""), order]));

  return (
    <ControlShell
      eyebrow="Fulfillment"
      title="Shipments"
      description={connectivityMessage(snapshot.blockedReason) || "Shipment records linked to warehouse orders and dispatch handoff."}
      actions={[
        { label: "Dispatch", href: "/warehouse/dispatch" },
        { label: "Orders", href: "/warehouse/orders" }
      ]}
    >
      <WarehouseOpsLiveSync enabled={policy.realtimeUpdatesEnabled} />
      <div className="overflow-x-auto rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
        <table className="min-w-[960px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--platform-border)] text-[11px] uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Shipment</th>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Carrier</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--platform-border)] text-[var(--platform-text-secondary)]">
            {shipments.length ? shipments.map((shipment) => {
              const shipmentId = text(shipment.id, "");
              const order = ordersById.get(text(shipment.order_id, ""));
              return (
                <tr key={shipmentId}>
                  <td className="px-4 py-3 font-medium text-[var(--platform-text-primary)]">{text(shipment.shipment_number, shipmentId)}</td>
                  <td className="px-4 py-3">{text(order?.order_number, text(shipment.order_id))}</td>
                  <td className="px-4 py-3">{shipmentStatusLabel(text(shipment.shipment_status, "pending"))}</td>
                  <td className="px-4 py-3">{text(shipment.carrier_name, "Pending")}</td>
                  <td className="px-4 py-3">{formatDate(shipment.updated_at)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/warehouse/shipments/${encodeURIComponent(shipmentId)}`} className="text-xs font-semibold text-[var(--platform-accent)] hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--platform-text-muted)]">
                  No shipments are available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ControlShell>
  );
}
