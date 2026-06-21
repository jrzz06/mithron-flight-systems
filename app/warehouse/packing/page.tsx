import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { getWarehouseSnapshot } from "@/services/admin";
import { createShipmentFormAction, updateWarehouseOrderLifecycleFormAction } from "../actions";

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
  return `/warehouse/packing?operation_status=${status}&operation_message=${encodeURIComponent(message.slice(0, 220))}`;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Packing action failed.";
}

async function markPacked(formData: FormData) {
  "use server";
  try {
    await updateWarehouseOrderLifecycleFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", message(error)));
  }
  redirect(feedbackPath("success", "Order marked packed with timeline history."));
}

async function createPackingShipment(formData: FormData) {
  "use server";
  try {
    await createShipmentFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", message(error)));
  }
  redirect(feedbackPath("success", "Shipment created from packing station."));
}

export default async function PackingStationPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getWarehouseSnapshot({ scope: "packing" });
  const params = searchParams ? await searchParams : {};
  const operationStatus = queryValue(params, "operation_status");
  const operationMessage = queryValue(params, "operation_message");
  const itemsByOrder = new Map<string, Array<Record<string, unknown>>>();
  for (const item of snapshot.data.orderItems) {
    const orderId = text(item.order_id, "");
    if (!orderId) continue;
    itemsByOrder.set(orderId, [...(itemsByOrder.get(orderId) ?? []), item]);
  }
  const pickedOrders = snapshot.data.orders.filter((order) => text(order.fulfillment_status, "pending") === "picked").slice(0, 30);
  const readyShipments = snapshot.data.shipments.filter((shipment) => ["pending", "reserved", "packed"].includes(text(shipment.shipment_status, "pending")));

  return (
    <ControlShell
      eyebrow="Packing station"
      title="Verify and pack"
      description={snapshot.blockedReason ?? "Packing uses existing order items and shipment creation so stock, shipment items, and audit history remain connected."}
      metrics={[
        { label: "Picked", value: String(pickedOrders.length) },
        { label: "Open shipments", value: String(readyShipments.length) },
        { label: "Items", value: String(snapshot.data.orderItems.length) }
      ]}
      actions={[
        { label: "Picking", href: "/warehouse/picking" },
        { label: "Dispatch", href: "/warehouse/dispatch" },
        { label: "Returns", href: "/warehouse/returns" }
      ]}
    >
      <section data-packing-station className="grid gap-4">
        <OperationalFeedback status={operationStatus} message={operationMessage} context="Packing" idle="Packing, shipment creation, and validation messages appear here." />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-3">
            {pickedOrders.length ? pickedOrders.map((order) => {
              const orderId = text(order.id, "");
              const orderItems = itemsByOrder.get(orderId) ?? [];
              const firstItem = orderItems[0] ?? {};
              return (
                <article key={orderId} className="content-visibility-auto rounded-xl border border-white/[0.06] bg-[#10151d] p-4 [contain-intrinsic-size:260px] [content-visibility:auto]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{text(order.order_number, orderId)}</p>
                      <p className="mt-1 text-xs text-slate-500">{text(order.customer_email, "No customer email")}</p>
                    </div>
                    <StatusBadge status={text(order.fulfillment_status, "picked")} />
                  </div>

                  <div data-packing-checklist className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
                    <span className="rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 py-2">Items verified: {orderItems.length}</span>
                    <span className="rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 py-2">Slip ready</span>
                    <span className="rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 py-2">Proof note required</span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <form action={markPacked} className="grid gap-2 rounded-lg border border-white/[0.06] bg-[#0b1017] p-3">
                      <input name="order_id" type="hidden" value={orderId} />
                      <input name="status" type="hidden" value={text(order.status, "assigned")} />
                      <input name="payment_status" type="hidden" value={text(order.payment_status, "not_required")} />
                      <input name="fulfillment_status" type="hidden" value="packed" />
                      <input name="warehouse_code" type="hidden" value="IN-WEST-01" />
                      <input name="note" type="hidden" value="Packed at warehouse station" />
                      <input name="change_summary" type="hidden" value={`Pack ${text(order.order_number, orderId)}`} />
                      <OperationalSubmitButton pendingLabel="Saving" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100">
                        Mark packed
                      </OperationalSubmitButton>
                    </form>

                    <form action={createPackingShipment} className="grid gap-2 rounded-lg border border-white/[0.06] bg-[#0b1017] p-3">
                      <input name="order_id" type="hidden" value={orderId} />
                      <input name="warehouse_id" type="hidden" value="IN-WEST-01" />
                      <input name="order_item_id" type="hidden" value={text(firstItem.id, "")} />
                      <input name="shipment_product_id" type="hidden" value={text(firstItem.product_slug, "")} />
                      <input name="shipment_quantity" type="hidden" value={String(firstItem.quantity ?? 1)} />
                      <label className="grid gap-1 text-xs font-medium text-slate-500">
                        Courier
                        <input name="carrier_name" defaultValue="Mithron Field" className="h-9 rounded-lg border border-white/[0.06] bg-[#10151d] px-3 text-sm text-slate-100" />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-slate-500">
                        Tracking
                        <input name="tracking_number" defaultValue="" className="h-9 rounded-lg border border-white/[0.06] bg-[#10151d] px-3 text-sm text-slate-100" />
                      </label>
                      <label className="grid gap-1 text-xs font-medium text-slate-500">
                        Package dimensions, weight, packing notes
                        <input name="notes" defaultValue="" className="h-9 rounded-lg border border-white/[0.06] bg-[#10151d] px-3 text-sm text-slate-100" />
                      </label>
                      <input name="change_summary" type="hidden" value={`Create packing shipment ${text(order.order_number, orderId)}`} />
                      <OperationalSubmitButton pendingLabel="Creating" className="inline-flex min-h-9 items-center justify-center rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 text-xs font-semibold text-sky-100">
                        Generate shipment
                      </OperationalSubmitButton>
                    </form>
                  </div>
                </article>
              );
            }) : (
              <div className="rounded-xl border border-white/[0.06] bg-[#10151d] px-4 py-10 text-center text-sm text-slate-500">No picked orders are ready for packing.</div>
            )}
          </div>

          <aside className="grid content-start gap-3 rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
            <p className="text-sm font-semibold text-slate-100">Packing slip queue</p>
            {readyShipments.slice(0, 8).map((shipment) => (
              <div key={text(shipment.id, text(shipment.shipment_number, "shipment"))} className="rounded-lg border border-white/[0.06] bg-[#0b1017] p-3 text-sm text-slate-300">
                <p className="font-semibold text-slate-100">{text(shipment.shipment_number, "Shipment")}</p>
                <p className="mt-1 text-xs text-slate-500">{text(shipment.shipment_status, "pending")} | {text(shipment.tracking_number, "tracking pending")}</p>
              </div>
            ))}
            {!readyShipments.length ? <p className="text-sm text-slate-500">No packing slip rows are ready.</p> : null}
          </aside>
        </div>
      </section>
    </ControlShell>
  );
}
