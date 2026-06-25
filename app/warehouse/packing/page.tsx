import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { WarehousePackingOrderCard } from "@/components/warehouse/warehouse-packing-order-card";
import { getWarehouseSnapshot } from "@/services/admin";
import { getWarehouseConfiguration } from "@/services/warehouse-config";
import { listActiveWarehouses } from "@/services/warehouses";
import { completeWarehousePackingFormAction } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function queryValue(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

function text(value: unknown, fallback = "n/a") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function orderMetadata(order: Record<string, unknown>) {
  const metadata = order.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
}

function feedbackPath(status: "success" | "error", message: string) {
  return `/warehouse/packing?operation_status=${status}&operation_message=${encodeURIComponent(message.slice(0, 220))}`;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Packing action failed.";
}

async function completePackingWithFeedback(formData: FormData) {
  "use server";
  try {
    const result = await completeWarehousePackingFormAction(formData);
    redirect(feedbackPath("success", `Packed ${result.itemCount} line item(s). Shipment ${result.shipmentNumber} queued for dispatch.`));
  } catch (error) {
    redirect(feedbackPath("error", message(error)));
  }
}

export default async function PackingStationPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [snapshot, warehouses, warehouseConfig] = await Promise.all([
    getWarehouseSnapshot({ scope: "packing" }),
    listActiveWarehouses(),
    getWarehouseConfiguration()
  ]);
  const defaultWarehouseCode = warehouseConfig.defaultWarehouseCode;
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
  const dispatchQueue = snapshot.data.shipments.filter((shipment) => ["packed", "ready_for_pickup"].includes(text(shipment.shipment_status, "pending")));

  return (
    <ControlShell
      eyebrow="Packing"
      title="Verify and pack"
      description={snapshot.blockedReason ?? "Verify every line item, then create a packed shipment for dispatch."}
      actions={[
        { label: "Picking", href: "/warehouse/picking" },
        { label: "Dispatch", href: "/warehouse/dispatch" }
      ]}
    >
      <section data-packing-station className="grid gap-4">
        <OperationalFeedback status={operationStatus} message={operationMessage} context="Packing" idle="Packing, shipment creation, and validation messages appear here." />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-3">
            {pickedOrders.length ? pickedOrders.map((order) => {
              const orderId = text(order.id, "");
              const orderItems = itemsByOrder.get(orderId) ?? [];
              const assignedWarehouse = text(orderMetadata(order).assigned_warehouse_code, defaultWarehouseCode);
              return (
                <WarehousePackingOrderCard
                  key={orderId}
                  orderId={orderId}
                  orderNumber={text(order.order_number, orderId)}
                  warehouseCode={assignedWarehouse}
                  defaultWarehouseCode={defaultWarehouseCode}
                  defaultCarrier={warehouseConfig.defaultCarrier}
                  warehouses={warehouses}
                  completeAction={completePackingWithFeedback}
                  items={orderItems.map((item) => ({
                    id: text(item.id, ""),
                    sku: text(item.sku, "sku"),
                    productSlug: text(item.product_slug, "product"),
                    productName: text(item.product_name, text(item.product_slug, "product")),
                    quantity: Number(item.quantity ?? 1)
                  })).filter((item) => item.id)}
                />
              );
            }) : (
              <div className="rounded-xl border border-white/[0.06] bg-[#10151d] px-4 py-10 text-center text-sm text-slate-500">No picked orders are ready for packing.</div>
            )}
          </div>

          <aside className="grid content-start gap-3 rounded-xl border border-white/[0.06] bg-[#10151d] p-4">
            <p className="text-sm font-semibold text-slate-100">Dispatch queue preview</p>
            {dispatchQueue.slice(0, 8).map((shipment) => (
              <div key={text(shipment.id, text(shipment.shipment_number, "shipment"))} className="rounded-lg border border-white/[0.06] bg-[#0b1017] p-3 text-sm text-slate-300">
                <p className="font-semibold text-slate-100">{text(shipment.shipment_number, "Shipment")}</p>
                <p className="mt-1 text-xs text-slate-500">{text(shipment.shipment_status, "packed")} | {text(shipment.tracking_number, "tracking pending")}</p>
              </div>
            ))}
            {!dispatchQueue.length ? <p className="text-sm text-slate-500">Completed packs appear here once shipments are created as packed.</p> : null}
          </aside>
        </div>
      </section>
    </ControlShell>
  );
}
