import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { getWarehouseSnapshot } from "@/services/admin";
import { updateWarehouseOrderLifecycleFormAction } from "../actions";

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
  return `/warehouse/picking?operation_status=${status}&operation_message=${encodeURIComponent(message.slice(0, 220))}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Picking action failed.";
}

async function updatePickingStatus(formData: FormData) {
  "use server";
  try {
    await updateWarehouseOrderLifecycleFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", errorMessage(error)));
  }
  redirect(feedbackPath("success", "Picking status saved with timeline history."));
}

export default async function PickingQueuePage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getWarehouseSnapshot({ scope: "picking" });
  const params = searchParams ? await searchParams : {};
  const page = Math.max(1, Number.parseInt(value(params, "page"), 10) || 1);
  const operationStatus = value(params, "operation_status");
  const operationMessage = value(params, "operation_message");
  const stockBySku = new Map(snapshot.data.stock.map((row) => [`${text(row.product_slug, "")}:${text(row.sku, "")}`, row]));
  const itemsByOrder = new Map<string, Array<Record<string, unknown>>>();
  for (const item of snapshot.data.orderItems) {
    const orderId = text(item.order_id, "");
    if (!orderId) continue;
    itemsByOrder.set(orderId, [...(itemsByOrder.get(orderId) ?? []), item]);
  }
  const queue = snapshot.data.orders.filter((order) => ["pending", "processing"].includes(text(order.fulfillment_status, "pending")));
  const pageSize = 24;
  const rows = queue.slice((page - 1) * pageSize, page * pageSize);

  return (
    <ControlShell
      eyebrow="Picking queue"
      title="Pick orders"
      description={snapshot.blockedReason ?? "Scan-ready order picking that updates the real order lifecycle and preserves timeline history."}
      metrics={[
        { label: "Queue", value: String(queue.length) },
        { label: "Items", value: String(snapshot.data.orderItems.length) },
        { label: "Page", value: String(page) }
      ]}
      actions={[
        { label: "Orders", href: "/warehouse/orders" },
        { label: "Packing", href: "/warehouse/packing" },
        { label: "Inventory", href: "/warehouse/inventory" }
      ]}
    >
      <section data-picking-queue data-barcode-ready className="grid gap-4">
        <OperationalFeedback status={operationStatus} message={operationMessage} context="Picking" idle="Picking updates and validation errors appear here." />

        <div className="sticky top-3 z-20 grid gap-3 rounded-xl border border-white/[0.06] bg-[#10151d]/95 p-3 backdrop-blur-sm md:grid-cols-[minmax(0,1fr)_180px]">
          <input name="scan" aria-label="Scan SKU or order" className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100 outline-none focus:border-emerald-400/70" />
          <span className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/10 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200">Barcode ready</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#10151d]">
          <table className="min-w-[960px] w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-[#182235] text-xs uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Bin</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {rows.length ? rows.map((order) => {
                const orderId = text(order.id, "");
                const status = text(order.fulfillment_status, "pending");
                const orderItems = itemsByOrder.get(orderId) ?? [];
                const firstItem = orderItems[0] ?? {};
                const sku = text(firstItem.sku, "sku");
                const productSlug = text(firstItem.product_slug, "product");
                const stock = stockBySku.get(`${productSlug}:${sku}`);
                const nextStatus = status === "pending" ? "processing" : "picked";
                return (
                  <tr key={orderId} className="content-visibility-auto align-top [contain-intrinsic-size:76px] [content-visibility:auto]">
                    <td className="px-4 py-4 font-semibold text-slate-100">{text(order.order_number, orderId)}</td>
                    <td className="px-4 py-4 font-mono text-xs text-slate-300">{sku}</td>
                    <td className="px-4 py-4 text-slate-300">{text(firstItem.product_name, productSlug)}</td>
                    <td className="px-4 py-4 text-slate-100">{String(firstItem.quantity ?? 0)}</td>
                    <td className="px-4 py-4 text-slate-400">{text(stock?.warehouse_code, "Unassigned")}</td>
                    <td className="px-4 py-4 text-amber-200">{status === "pending" ? "New" : "Active"}</td>
                    <td className="px-4 py-4"><StatusBadge status={status} /></td>
                    <td className="px-4 py-4">
                      <form action={updatePickingStatus} className="flex justify-end">
                        <input name="order_id" type="hidden" value={orderId} />
                        <input name="status" type="hidden" value={text(order.status, "assigned")} />
                        <input name="payment_status" type="hidden" value={text(order.payment_status, "not_required")} />
                        {status === "pending" ? (
                          <input name="fulfillment_status" type="hidden" value="processing" />
                        ) : (
                          <input name="fulfillment_status" type="hidden" value="picked" />
                        )}
                        <input name="warehouse_code" type="hidden" value={text(stock?.warehouse_code, "IN-WEST-01")} />
                        <input name="note" type="hidden" value={`${nextStatus} from picking queue`} />
                        <input name="change_summary" type="hidden" value={`Warehouse picking ${nextStatus} ${text(order.order_number, orderId)}`} />
                        <OperationalSubmitButton pendingLabel="Saving" className="inline-flex min-h-9 items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100">
                          {nextStatus === "processing" ? "Start picking" : "Mark picked"}
                        </OperationalSubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No orders are waiting for picking.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </ControlShell>
  );
}
