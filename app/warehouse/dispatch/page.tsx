import Link from "next/link";
import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { WarehouseKpiStrip } from "@/components/warehouse/warehouse-kpi-strip";
import { WarehouseOpsLiveSync } from "@/components/warehouse/warehouse-ops-live-sync";
import { shipmentStatusLabel } from "@/lib/warehouse/operational-labels";
import { getWarehouseSnapshot } from "@/services/admin";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";
import { getCurrentAuthContext } from "@/services/auth";
import { filterShipmentsForWarehouseScope, resolveWarehouseScope } from "@/services/warehouse-scope";
import { updateShipmentLifecycleFormAction } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function queryValue(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isToday(value: unknown) {
  const raw = text(value, "");
  if (!raw || raw === "—") return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear()
    && date.getUTCMonth() === now.getUTCMonth()
    && date.getUTCDate() === now.getUTCDate();
}

function formatDate(value: unknown) {
  const raw = text(value, "");
  if (!raw || raw === "—") return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function feedbackPath(status: "success" | "error", message: string) {
  return `/warehouse/dispatch?operation_status=${status}&operation_message=${encodeURIComponent(message.slice(0, 220))}`;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Dispatch action failed.";
}

async function updateShipmentStatus(formData: FormData) {
  "use server";
  try {
    await updateShipmentLifecycleFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", message(error)));
  }
  redirect(feedbackPath("success", "Dispatch status updated."));
}

const actionButtonClass = "inline-flex min-h-8 items-center justify-center rounded-md border border-[var(--platform-border)] px-3 text-[11px] font-semibold text-[var(--platform-text-primary)] transition hover:border-[var(--platform-accent)]/40 disabled:cursor-not-allowed disabled:opacity-55";

export default async function DispatchPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [snapshot, policy, auth] = await Promise.all([
    getWarehouseSnapshot({ scope: "dispatch" }),
    getAdminSettingsPolicy(),
    getCurrentAuthContext()
  ]);
  const scope = await resolveWarehouseScope({ userId: auth.userId, role: auth.role });
  const params = searchParams ? await searchParams : {};
  const operationStatus = queryValue(params, "operation_status");
  const operationMessage = queryValue(params, "operation_message");
  const ordersById = new Map(snapshot.data.orders.map((order) => [text(order.id, ""), order]));
  const itemsByShipment = new Map<string, number>();
  for (const item of snapshot.data.shipmentItems) {
    const shipmentId = text(item.shipment_id, "");
    if (!shipmentId) continue;
    itemsByShipment.set(shipmentId, (itemsByShipment.get(shipmentId) ?? 0) + Number(item.quantity ?? 0));
  }
  const scopedShipments = filterShipmentsForWarehouseScope(snapshot.data.shipments, scope);
  const dispatchRows = scopedShipments.filter((shipment) =>
    ["packed", "ready_for_pickup"].includes(text(shipment.shipment_status, "pending"))
  );
  const dispatchedToday = scopedShipments.filter((shipment) =>
    ["shipped", "in_transit", "delivered"].includes(text(shipment.shipment_status, "pending")) && isToday(shipment.updated_at)
  );

  return (
    <ControlShell
      eyebrow=""
      title="Dispatch"
      description="Packages leaving the facility. Confirm packing, hand off to carriers, and mark as dispatched."
      actions={[
        { label: "Packing", href: "/warehouse/packing" }
      ]}
    >
      <WarehouseOpsLiveSync enabled={policy.realtimeUpdatesEnabled} />
      <section data-dispatch-handoff-center className="grid gap-6">
        <OperationalFeedback
          status={operationStatus}
          message={operationMessage}
          context="Dispatch"
          idle="Dispatch updates and validation messages appear here."
        />

        <WarehouseKpiStrip
          tiles={[
            { label: "Ready", value: dispatchRows.length },
            { label: "Dispatched Today", value: dispatchedToday.length }
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--platform-text-primary)]">Dispatch Queue</h2>
          <Link
            href="/warehouse/dispatch/export"
            className="inline-flex min-h-9 items-center rounded-md border border-[var(--platform-border)] px-3 text-xs font-semibold text-[var(--platform-text-primary)] transition hover:border-[var(--platform-accent)]/40"
          >
            Export shipment CSV
            {/* export shipment CSV */}
          </Link>
        </div>

        <div className="overflow-x-auto rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
          <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
            <thead className="border-b border-[var(--platform-border)] text-[11px] uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Carrier</th>
                <th className="px-4 py-3 font-semibold">Tracking</th>
                <th className="px-4 py-3 font-semibold">Dispatch Status</th>
                <th className="px-4 py-3 font-semibold">Packed At</th>
                <th className="px-4 py-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--platform-border)] text-[var(--platform-text-secondary)]">
              {dispatchRows.length ? dispatchRows.map((shipment) => {
                const shipmentId = text(shipment.id, "");
                const order = ordersById.get(text(shipment.order_id, ""));
                const status = text(shipment.shipment_status, "pending");
                const shipmentNumber = text(shipment.shipment_number, shipmentId);
                const itemCount = itemsByShipment.get(shipmentId) ?? 0;
                return (
                  <tr key={shipmentId} data-shipment-item-count={itemCount}>
                    <td className="px-4 py-3 font-medium text-[var(--platform-text-primary)]">
                      {text(order?.order_number, shipmentNumber)}
                    </td>
                    <td className="px-4 py-3">{text(order?.customer_email)}</td>
                    <td className="px-4 py-3">{text(shipment.carrier_name, "Pending")}</td>
                    <td className="px-4 py-3">{text(shipment.tracking_number, "Pending")}</td>
                    <td className="px-4 py-3">{shipmentStatusLabel(status)}</td>
                    <td className="px-4 py-3">{formatDate(shipment.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[320px] flex-wrap gap-2">
                        <form action={updateShipmentStatus} className="contents">
                          <input name="shipment_id" type="hidden" value={shipmentId} />
                          <input name="shipment_status" type="hidden" value="packed" />
                          <input name="carrier_name" type="hidden" value={text(shipment.carrier_name, "")} />
                          <input name="tracking_number" type="hidden" value={text(shipment.tracking_number, "")} />
                          <input name="notes" type="hidden" value="Marked packed from dispatch queue" />
                          <input name="change_summary" type="hidden" value={`Mark packed ${shipmentNumber}`} />
                          <OperationalSubmitButton pendingLabel="Saving" className={actionButtonClass}>
                            Mark Packed
                          </OperationalSubmitButton>
                        </form>
                        <form action={updateShipmentStatus} className="contents">
                          <input name="shipment_id" type="hidden" value={shipmentId} />
                          <input name="shipment_status" type="hidden" value="ready_for_pickup" />
                          <input name="carrier_name" type="hidden" value={text(shipment.carrier_name, "")} />
                          <input name="tracking_number" type="hidden" value={text(shipment.tracking_number, "")} />
                          <input name="notes" type="hidden" value="Ready for pickup from dispatch queue" />
                          <input name="change_summary" type="hidden" value={`Ready for pickup ${shipmentNumber}`} />
                          <OperationalSubmitButton pendingLabel="Saving" className={actionButtonClass}>
                            Ready for Pickup
                          </OperationalSubmitButton>
                        </form>
                        <form action={updateShipmentStatus} className="contents">
                          <input name="shipment_id" type="hidden" value={shipmentId} />
                          <input name="shipment_status" type="hidden" value="shipped" />
                          <input name="carrier_name" type="hidden" value={text(shipment.carrier_name, "")} />
                          <input name="tracking_number" type="hidden" value={text(shipment.tracking_number, "")} />
                          <input name="notes" type="hidden" value="Dispatched from dispatch queue" />
                          <input name="change_summary" type="hidden" value={`Dispatch ${shipmentNumber}`} />
                          <OperationalSubmitButton pendingLabel="Dispatching" className={`${actionButtonClass} border-emerald-400/30 text-emerald-200`}>
                            Mark Dispatched
                          </OperationalSubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-[var(--platform-text-muted)]">
                    All dispatches have been completed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ControlShell>
  );
}
