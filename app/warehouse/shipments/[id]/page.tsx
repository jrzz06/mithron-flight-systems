import { notFound, redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { DataList, OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { getWarehouseSnapshot } from "@/services/admin";
import { connectivityMessage } from "@/lib/platform/copy";
import { updateShipmentLifecycleFormAction } from "../../actions";

export const dynamic = "force-dynamic";

type ShipmentDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function asText(value: unknown, fallback = "n/a") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatDate(value: unknown) {
  const raw = asText(value, "");
  if (!raw) return "n/a";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(date);
}

function searchValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function feedbackPath(shipmentId: string, status: "success" | "error", message: string) {
  return `/warehouse/shipments/${shipmentId}?operation_status=${status}&operation_message=${encodeURIComponent(message)}`;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Shipment detail update failed.";
}

async function updateShipmentDetailWithFeedback(formData: FormData) {
  "use server";
  const shipmentId = String(formData.get("shipment_id") ?? "").trim();
  try {
    await updateShipmentLifecycleFormAction(formData);
  } catch (error) {
    redirect(feedbackPath(shipmentId, "error", messageFromError(error)));
  }
  redirect(feedbackPath(shipmentId, "success", "Shipment detail persisted and timeline refreshed."));
}

export default async function ShipmentDetailPage({ params, searchParams }: ShipmentDetailPageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const snapshot = await getWarehouseSnapshot({ scope: "dispatch" });
  const shipment = snapshot.data.shipments.find((row) => asText(row.id, "") === id);
  if (!shipment) notFound();

  const items = snapshot.data.shipmentItems.filter((row) => asText(row.shipment_id, "") === id);
  const timeline = snapshot.data.shipmentTimeline
    .filter((row) => asText(row.shipment_id, "") === id)
    .sort((a, b) => Date.parse(asText(b.created_at, "1970-01-01")) - Date.parse(asText(a.created_at, "1970-01-01")));
  const operationStatus = searchValue(query, "operation_status");
  const operationMessage = searchValue(query, "operation_message");
  const shipmentStages = ["pending", "reserved", "packed", "ready_for_pickup", "shipped", "in_transit", "delivered"];
  const currentStage = asText(shipment.shipment_status, "pending");
  const linkedOrder = snapshot.data.orders.find((row) => asText(row.id, "") === asText(shipment.order_id, ""));
  const linkedOrderNumber = asText(linkedOrder?.order_number, "");

  return (
    <div data-shipment-detail-route>
      <ControlShell
      eyebrow="Shipment detail"
      title={asText(shipment.shipment_number, "Shipment")}
      description={connectivityMessage(snapshot.blockedReason) || `${asText(shipment.shipment_status, "pending")}${linkedOrderNumber ? ` | Order ${linkedOrderNumber}` : ""}`}
      metrics={[
        { label: "Items", value: String(items.length) },
        { label: "Timeline", value: String(timeline.length) },
        { label: "Status", value: asText(shipment.shipment_status, "pending") }
      ]}
      actions={[
        { label: "Inventory", href: "/warehouse/inventory" },
        { label: "Shipments", href: "/warehouse/shipments" },
        { label: "Stock Movements", href: "/warehouse/movements" }
      ]}
      >
      <div data-shipment-action-feedback className="mb-8">
        <OperationalFeedback
          status={operationStatus}
          message={operationMessage}
          context="Shipment detail"
          idle="Shipment status, carrier, tracking, and timeline update results appear here."
        />
      </div>

      <section data-shipment-progress-meter className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Shipment progress</p>
        <div className="grid gap-2 md:grid-cols-7">
          {shipmentStages.map((stage) => {
            const reached = shipmentStages.indexOf(stage) <= Math.max(0, shipmentStages.indexOf(currentStage));
            return (
              <div key={stage} className="rounded-xl border border-white/10 bg-black/18 p-3">
                <StatusBadge status={reached ? stage : "pending"} />
                <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/40">{stage}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <section className="grid gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Tracking metadata</p>
          <DataList rows={[
            { label: "shipment_status", value: asText(shipment.shipment_status, "pending"), detail: `updated ${formatDate(shipment.updated_at)}` },
            { label: "carrier", value: asText(shipment.carrier_name), detail: `tracking ${asText(shipment.tracking_number)}` },
            { label: "timestamps", value: asText(shipment.shipped_at, "not shipped"), detail: `delivered ${asText(shipment.delivered_at)} | failed ${asText(shipment.failed_at)} | returned ${asText(shipment.returned_at)}` }
          ]} />
        </section>
        <section className="grid gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Shipment items</p>
          <DataList rows={items.length ? items.map((item) => ({
            label: `${asText(item.product_id, "product")}:${asText(item.variant_id, "product-level")}`,
            value: String(item.quantity ?? 0),
            detail: `order item ${asText(item.order_item_id)}`
          })) : [{ label: "shipment_items", value: "0", detail: "No shipment item rows." }]} />
        </section>
      </div>

      <form action={updateShipmentDetailWithFeedback} data-shipment-update-form className="mt-8 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
        <input name="shipment_id" type="hidden" value={id} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Shipment status</span>
            <select name="shipment_status" defaultValue={asText(shipment.shipment_status, "pending")} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none">
              <option value="reserved">reserved</option>
              <option value="packed">packed</option>
              <option value="ready_for_pickup">ready_for_pickup</option>
              <option value="shipped">shipped</option>
              <option value="in_transit">in_transit</option>
              <option value="delivered">delivered</option>
              <option value="failed">failed</option>
              <option value="returned">returned</option>
              <option value="damaged">damaged</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Carrier</span>
            <input name="carrier_name" defaultValue={asText(shipment.carrier_name, "")} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Tracking number</span>
            <input name="tracking_number" defaultValue={asText(shipment.tracking_number, "")} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Change summary</span>
            <input name="change_summary" defaultValue="" placeholder="Update shipment status" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
        </div>
        <label className="grid gap-2 text-sm">
          <span className="text-white/70">Notes</span>
          <input name="notes" defaultValue="" placeholder="Shipment lifecycle note" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
        </label>
        <OperationalSubmitButton pendingLabel="Updating shipment">
          Update shipment
        </OperationalSubmitButton>
      </form>

      <section className="mt-8 grid gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Shipment timeline</p>
        <div data-shipment-timeline className="grid gap-3">
          {timeline.length ? timeline.map((event) => (
            <div key={asText(event.id, `${asText(event.event_type)}-${asText(event.created_at)}`)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{asText(event.event_type)}</p>
                <p className="text-xs text-white/45">{formatDate(event.created_at)}</p>
              </div>
              <p className="mt-2 text-sm text-white/60">{asText(event.previous_status, "start")} {"->"} {asText(event.next_status)}</p>
              <p className="mt-1 text-sm text-white/45">{asText(event.notes)}</p>
            </div>
          )) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-white/50">No timeline rows yet.</div>
          )}
        </div>
      </section>
      </ControlShell>
    </div>
  );
}
