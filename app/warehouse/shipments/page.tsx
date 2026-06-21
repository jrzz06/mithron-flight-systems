import Link from "next/link";
import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { DataList, OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { getWarehouseSnapshot } from "@/services/admin";
import { updateShipmentLifecycleFormAction } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function asText(value: unknown, fallback = "n/a") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function badgeClass(status: string) {
  if (status === "delivered") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (status === "failed" || status === "returned" || status === "cancelled" || status === "damaged") return "border-rose-300/25 bg-rose-300/10 text-rose-100";
  if (status === "shipped" || status === "in_transit") return "border-sky-300/25 bg-sky-300/10 text-sky-100";
  return "border-amber-300/25 bg-amber-300/10 text-amber-100";
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

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function feedbackPath(status: "success" | "error", message: string) {
  return `/warehouse/shipments?operation_status=${status}&operation_message=${encodeURIComponent(message)}`;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "Shipment action failed.";
}

async function updateShipmentStatusShortcut(formData: FormData) {
  "use server";
  try {
    await updateShipmentLifecycleFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", messageFromError(error)));
  }
  redirect(feedbackPath("success", "Shipment status persisted and timeline refreshed."));
}

export default async function WarehouseShipmentsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getWarehouseSnapshot({ scope: "dispatch" });
  const params = searchParams ? await searchParams : {};
  const operationStatus = searchValue(params, "operation_status");
  const operationMessage = searchValue(params, "operation_message");
  const shipmentStates = ["pending", "reserved", "packed", "ready_for_pickup", "shipped", "in_transit", "delivered", "failed", "returned", "cancelled"];
  const progressRows = shipmentStates.map((state) => ({
    state,
    count: snapshot.data.shipments.filter((shipment) => String(shipment.shipment_status ?? "pending") === state).length
  }));
  const timelineRows = snapshot.data.shipmentTimeline.slice(0, 8).map((event) => ({
    label: String(event.event_type ?? "shipment event"),
    value: String(event.next_status ?? event.previous_status ?? "state"),
    detail: `${formatDate(event.created_at)} | shipment ${asText(event.shipment_id, "n/a")} | actor ${asText(event.actor_user_id, "system")}`
  }));

  return (
    <div data-warehouse-shipments-route>
      <ControlShell
      eyebrow="Warehouse shipments"
      title="Shipment control."
      description={snapshot.blockedReason ?? "Shipment persistence connects orders, packed quantities, movement ledger rows, tracking state, and immutable warehouse timeline events."}
      metrics={[
        { label: "Shipments", value: String(snapshot.data.shipments.length) },
        { label: "Shipment items", value: String(snapshot.data.shipmentItems.length) },
        { label: "Timeline", value: String(snapshot.data.shipmentTimeline.length) },
        { label: "Status", value: snapshot.status }
      ]}
      actions={[
        { label: "Inventory", href: "/warehouse/inventory" },
        { label: "Shipments", href: "/warehouse/shipments" },
        { label: "Stock Movements", href: "/warehouse/movements" }
      ]}
      >
      <div className="grid gap-8">
        <OperationalFeedback
          status={operationStatus}
          message={operationMessage}
          context="Shipment"
          idle="Packed, shipped, handoff, and exception state updates appear here."
        />

        <section data-shipment-progress-board className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Shipment progression</p>
          <div className="grid gap-2 md:grid-cols-5">
            {progressRows.map((row) => (
              <div key={row.state} className="rounded-xl border border-white/10 bg-black/18 p-3">
                <StatusBadge status={row.state} />
                <p className="mt-3 font-[var(--type-display)] text-2xl font-semibold text-white">{row.count}</p>
              </div>
            ))}
          </div>
        </section>

        <section data-shipment-timeline-snippets className="grid gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Recent shipment timeline</p>
          <DataList rows={timelineRows.length ? timelineRows : [{ label: "shipment_timeline", value: "0", detail: "No shipment timeline rows yet." }]} />
        </section>

        <div data-shipment-status-actions className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025]">
        <table data-shipments-table className="min-w-[960px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.16em] text-white/45">
            <tr>
              <th className="px-4 py-3 font-semibold">Shipment</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Warehouse</th>
              <th className="px-4 py-3 font-semibold">Tracking</th>
              <th className="px-4 py-3 font-semibold">Updated</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
              <th className="px-4 py-3 font-semibold">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-white/70">
            {snapshot.data.shipments.length ? snapshot.data.shipments.map((shipment) => {
              const status = asText(shipment.shipment_status, "pending");
              const id = asText(shipment.id, "");
              return (
                <tr key={id || asText(shipment.shipment_number, "shipment")}>
                  <td className="px-4 py-4 text-white">{asText(shipment.shipment_number, "shipment")}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(status)}`}>{status}</span>
                  </td>
                  <td className="px-4 py-4">{asText(shipment.order_id)}</td>
                  <td className="px-4 py-4">{asText(shipment.warehouse_id)}</td>
                  <td className="px-4 py-4">
                    <span className="block text-white/75">{asText(shipment.carrier_name)}</span>
                    <span className="block text-xs text-white/45">{asText(shipment.tracking_number)}</span>
                  </td>
                  <td className="px-4 py-4">{formatDate(shipment.updated_at)}</td>
                  <td className="px-4 py-4">
                    <div className="grid min-w-[360px] gap-2 md:grid-cols-3">
                      {[
                        { label: "mark packed", status: "packed" },
                        { label: "mark shipped", status: "shipped" },
                        { label: "ready pickup", status: "ready_for_pickup" }
                      ].map((action) => (
                        <form key={`${id}-${action.status}`} action={updateShipmentStatusShortcut} className="contents">
                          <input name="shipment_id" type="hidden" value={id} />
                          <input name="shipment_status" type="hidden" value={action.status} />
                          <input name="carrier_name" type="hidden" value={asText(shipment.carrier_name, "")} />
                          <input name="tracking_number" type="hidden" value={asText(shipment.tracking_number, "")} />
                          <input name="notes" type="hidden" value={`${action.label} from shipment table`} />
                          <input name="change_summary" type="hidden" value={`${action.label} ${asText(shipment.shipment_number, "shipment")}`} />
                          <OperationalSubmitButton
                            pendingLabel="Updating"
                            className="inline-flex min-h-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.055] px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/72 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-55"
                          >
                            {action.label}
                          </OperationalSubmitButton>
                        </form>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {id ? (
                      <Link href={`/warehouse/shipments/${id}`} className="inline-flex min-h-9 items-center rounded-full border border-white/10 px-3 text-xs font-semibold text-white/75 transition hover:border-white/30 hover:text-white">
                        Open
                      </Link>
                    ) : "n/a"}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-white/50">No shipment rows yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      </ControlShell>
    </div>
  );
}
