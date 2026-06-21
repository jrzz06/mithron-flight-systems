import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { getWarehouseSnapshot } from "@/services/admin";
import { updateShipmentLifecycleFormAction } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

function text(input: unknown, fallback = "n/a") {
  return typeof input === "string" && input.trim() ? input.trim() : fallback;
}

function feedbackPath(status: "success" | "error", message: string) {
  return `/warehouse/returns?operation_status=${status}&operation_message=${encodeURIComponent(message.slice(0, 220))}`;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Return action failed.";
}

async function updateReturnStatus(formData: FormData) {
  "use server";
  try {
    await updateShipmentLifecycleFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", errorText(error)));
  }
  redirect(feedbackPath("success", "Return inspection update saved."));
}

export default async function ReturnsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getWarehouseSnapshot({ scope: "returns" });
  const params = searchParams ? await searchParams : {};
  const operationStatus = value(params, "operation_status");
  const operationMessage = value(params, "operation_message");
  const returnRows = snapshot.data.shipments.filter((shipment) => ["delivered", "failed", "returned", "damaged", "in_transit", "shipped"].includes(text(shipment.shipment_status, "pending")));

  return (
    <ControlShell
      eyebrow="Returns"
      title="Return inspection"
      description={snapshot.blockedReason ?? "Return actions update shipment lifecycle rows and use the existing stock restoration path for approved returns."}
      metrics={[
        { label: "Inspectable", value: String(returnRows.length) },
        { label: "Returned", value: String(snapshot.data.shipments.filter((shipment) => text(shipment.shipment_status) === "returned").length) },
        { label: "Damaged", value: String(snapshot.data.shipments.filter((shipment) => text(shipment.shipment_status) === "damaged").length) }
      ]}
      actions={[
        { label: "Dispatch", href: "/warehouse/dispatch" },
        { label: "Inventory", href: "/warehouse/inventory" },
        { label: "Activity", href: "/warehouse/activity" }
      ]}
    >
      <section data-returns-workflow className="grid gap-4">
        <OperationalFeedback status={operationStatus} message={operationMessage} context="Returns" idle="Inspection decisions and lifecycle validation messages appear here." />
        <div className="grid gap-3">
          {returnRows.length ? returnRows.slice(0, 32).map((shipment) => {
            const shipmentId = text(shipment.id, "");
            return (
              <article key={shipmentId} className="rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{text(shipment.shipment_number, shipmentId)}</p>
                    <p className="mt-1 text-xs text-slate-500">Order {text(shipment.order_id)} | {text(shipment.carrier_name, "Carrier pending")}</p>
                  </div>
                  <StatusBadge status={text(shipment.shipment_status, "pending")} />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <form action={updateReturnStatus} className="grid gap-2 rounded-lg border border-white/[0.06] bg-[#0b1017] p-3">
                    <input name="shipment_id" type="hidden" value={shipmentId} />
                    <input name="shipment_status" type="hidden" value="returned" />
                    <input name="carrier_name" type="hidden" value={text(shipment.carrier_name, "")} />
                    <input name="tracking_number" type="hidden" value={text(shipment.tracking_number, "")} />
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Inspect return and restock note
                      <input name="notes" defaultValue="" className="h-9 rounded-lg border border-white/[0.06] bg-[#10151d] px-3 text-sm text-slate-100" />
                    </label>
                    <input name="change_summary" type="hidden" value={`Approve return ${text(shipment.shipment_number, shipmentId)}`} />
                    <OperationalSubmitButton pendingLabel="Approving" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100">
                      Restock item
                    </OperationalSubmitButton>
                  </form>
                  <form action={updateReturnStatus} className="grid gap-2 rounded-lg border border-white/[0.06] bg-[#0b1017] p-3">
                    <input name="shipment_id" type="hidden" value={shipmentId} />
                    <input name="shipment_status" type="hidden" value="damaged" />
                    <input name="carrier_name" type="hidden" value={text(shipment.carrier_name, "")} />
                    <input name="tracking_number" type="hidden" value={text(shipment.tracking_number, "")} />
                    <label className="grid gap-1 text-xs font-medium text-slate-500">
                      Damage or rejection note
                      <input name="notes" defaultValue="" className="h-9 rounded-lg border border-white/[0.06] bg-[#10151d] px-3 text-sm text-slate-100" />
                    </label>
                    <input name="change_summary" type="hidden" value={`Mark damaged ${text(shipment.shipment_number, shipmentId)}`} />
                    <OperationalSubmitButton pendingLabel="Saving" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 text-xs font-semibold text-rose-100">
                      Mark damaged
                    </OperationalSubmitButton>
                  </form>
                </div>
              </article>
            );
          }) : (
            <div className="rounded-xl border border-white/[0.06] bg-[#10151d] px-4 py-10 text-center text-sm text-slate-500">No return or exception shipments are visible.</div>
          )}
        </div>
      </section>
    </ControlShell>
  );
}
