import Link from "next/link";
import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { getWarehouseSnapshot } from "@/services/admin";
import { updateShipmentLifecycleFormAction } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function queryValue(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

function text(value: unknown, fallback = "n/a") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function feedbackPath(status: "success" | "error", message: string) {
  return `/warehouse/dispatch?operation_status=${status}&operation_message=${encodeURIComponent(message.slice(0, 220))}`;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Dispatch action failed.";
}

async function markDispatched(formData: FormData) {
  "use server";
  try {
    await updateShipmentLifecycleFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", message(error)));
  }
  redirect(feedbackPath("success", "Shipment dispatch saved and timeline refreshed."));
}

export default async function DispatchPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getWarehouseSnapshot({ scope: "dispatch" });
  const params = searchParams ? await searchParams : {};
  const operationStatus = queryValue(params, "operation_status");
  const operationMessage = queryValue(params, "operation_message");
  const dispatchRows = snapshot.data.shipments.filter((shipment) => ["packed", "ready_for_pickup"].includes(text(shipment.shipment_status, "pending")));

  return (
    <ControlShell
      eyebrow="Dispatch"
      title="Shipment handoff"
      description={snapshot.blockedReason ?? "Dispatch updates shipment rows, tracking details, shipment timeline, order fulfillment, and warehouse activity logs."}
      metrics={[
        { label: "Ready", value: String(dispatchRows.length) },
        { label: "Shipments", value: String(snapshot.data.shipments.length) },
        { label: "Timeline", value: String(snapshot.data.shipmentTimeline.length) }
      ]}
      actions={[
        { label: "Packing", href: "/warehouse/packing" },
        { label: "Returns", href: "/warehouse/returns" },
        { label: "Activity", href: "/warehouse/activity" }
      ]}
    >
      <section data-dispatch-handoff-center className="grid gap-4">
        <OperationalFeedback status={operationStatus} message={operationMessage} context="Dispatch" idle="Courier handoff updates and shipment errors appear here." />
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#10151d] p-3">
          <p className="text-sm font-semibold text-slate-100">Manifest queue</p>
          <Link href="/warehouse/dispatch/export" className="inline-flex min-h-9 items-center rounded-lg border border-white/[0.08] px-3 text-xs font-semibold text-slate-200 hover:bg-white/[0.04]">
            export shipment CSV
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#10151d]">
          <table className="min-w-[980px] w-full border-collapse text-left text-sm">
            <thead className="bg-[#182235] text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Shipment</th>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Warehouse</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Courier</th>
                <th className="px-4 py-3">Tracking number</th>
                <th className="px-4 py-3">Dispatch date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {dispatchRows.length ? dispatchRows.map((shipment) => {
                const shipmentId = text(shipment.id, "");
                return (
                  <tr key={shipmentId} className="content-visibility-auto [contain-intrinsic-size:80px] [content-visibility:auto]">
                    <td className="px-4 py-4 font-semibold text-slate-100">{text(shipment.shipment_number, shipmentId)}</td>
                    <td className="px-4 py-4 text-slate-400">{text(shipment.order_id)}</td>
                    <td className="px-4 py-4 text-slate-300">{text(shipment.warehouse_id, "IN-WEST-01")}</td>
                    <td className="px-4 py-4"><StatusBadge status={text(shipment.shipment_status, "packed")} /></td>
                    <td className="px-4 py-4 text-slate-300">{text(shipment.carrier_name, "Carrier pending")}</td>
                    <td className="px-4 py-4 text-slate-300">{text(shipment.tracking_number, "Tracking pending")}</td>
                    <td className="px-4 py-4 text-slate-500">{text(shipment.updated_at, "No date")}</td>
                    <td className="px-4 py-4">
                      <form action={markDispatched} className="ml-auto grid max-w-[320px] gap-2">
                        <input name="shipment_id" type="hidden" value={shipmentId} />
                        <input name="shipment_status" type="hidden" value="shipped" />
                        <input name="warehouse_code" type="hidden" value={text(shipment.warehouse_id, "IN-WEST-01")} />
                        <input name="dispatch_date" type="hidden" value={new Date().toISOString()} />
                        <input name="carrier_name" defaultValue={text(shipment.carrier_name, "")} aria-label="Courier" className="h-9 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100" />
                        <input name="tracking_number" defaultValue={text(shipment.tracking_number, "")} aria-label="Tracking number" className="h-9 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100" />
                        <input name="notes" type="hidden" value="Dispatched from warehouse handoff center" />
                        <input name="change_summary" type="hidden" value={`Dispatch ${text(shipment.shipment_number, shipmentId)}`} />
                        <OperationalSubmitButton pendingLabel="Dispatching" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100">
                          Mark shipped
                        </OperationalSubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No shipments are ready for dispatch.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ControlShell>
  );
}
