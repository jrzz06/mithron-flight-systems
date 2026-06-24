import { ControlShell } from "@/components/admin/control-shell";
import { DataList, OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { formatINR } from "@/lib/utils";
import { getWarehouseSnapshot } from "@/services/admin";
import { createWarehouseOrderFormAction, updateWarehouseOrderLifecycleFormAction } from "@/app/warehouse/actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function feedbackPath(status: "success" | "error", message: string) {
  return `/operations/orders?operation_status=${status}&operation_message=${encodeURIComponent(message)}`;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "The operations order action failed.";
}

async function createOperationsOrderWithFeedback(formData: FormData) {
  "use server";
  try {
    await createWarehouseOrderFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", messageFromError(error)));
  }
  redirect(feedbackPath("success", "Operations order persisted and queue refreshed."));
}

async function updateOperationsOrderLifecycleWithFeedback(formData: FormData) {
  "use server";
  try {
    await updateWarehouseOrderLifecycleFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", messageFromError(error)));
  }
  redirect(feedbackPath("success", "Operations order lifecycle persisted."));
}

export default async function OperationsOrdersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getWarehouseSnapshot({ scope: "orders" });
  const params = searchParams ? await searchParams : {};
  const fulfillmentFilter = searchValue(params, "fulfillment_status");
  const query = searchValue(params, "q").toLowerCase();
  const operationStatus = searchValue(params, "operation_status");
  const operationMessage = searchValue(params, "operation_message");
  const lifecycleStates = ["pending", "processing", "packed", "shipped", "delivered", "cancelled", "returned"];
  const lifecycleCounts = lifecycleStates.map((state) => ({
    state,
    count: snapshot.data.orders.filter((order) => String(order.fulfillment_status ?? "pending") === state).length
  }));
  const filteredOrders = snapshot.data.orders.filter((order) => {
    const fulfillmentStatus = String(order.fulfillment_status ?? "");
    const haystack = `${String(order.order_number ?? "")} ${String(order.customer_email ?? "")} ${String(order.id ?? "")}`.toLowerCase();
    return (!fulfillmentFilter || fulfillmentStatus === fulfillmentFilter) && (!query || haystack.includes(query));
  });
  const orderRows = filteredOrders.slice(0, 12).map((order) => {
    const timeline = Array.isArray(order.timeline) ? order.timeline.length : 0;
    return {
      label: String(order.order_number ?? order.id ?? "order"),
      value: String(order.fulfillment_status ?? order.status ?? "draft"),
      detail: `${String(order.customer_email ?? "No customer")} | total ${formatINR(Number(order.total ?? 0))} | timeline ${timeline}`
    };
  });
  const itemRows = snapshot.data.orderItems.slice(0, 12).map((item) => ({
    label: `${String(item.product_slug ?? "product")}:${String(item.sku ?? "sku")}`,
    value: String(item.quantity ?? 0),
    detail: `${String(item.product_name ?? "Product")} | order ${String(item.order_id ?? "unknown")} | line ${formatINR(Number(item.line_total ?? 0))}`
  }));

  return (
    <ControlShell
      scope="operations"
      eyebrow="Operations orders"
      title="Fulfillment oversight."
      description={snapshot.blockedReason ?? "Operations can process order lifecycle states through the operations route boundary without rendering the admin shell."}
      metrics={[
        { label: "Orders", value: String(snapshot.data.orders.length) },
        { label: "Order items", value: String(snapshot.data.orderItems.length) },
        { label: "Status", value: snapshot.status }
      ]}
      actions={[
        { label: "Operations", href: "/operations" },
        { label: "Deployments", href: "/operations/deployments" },
        { label: "Tasks", href: "/operations/tasks" },
        { label: "Notifications", href: "/operations/notifications" }
      ]}
    >
      <div className="grid gap-8">
        <div data-operations-order-feedback>
          <OperationalFeedback
            status={operationStatus}
            message={operationMessage}
            context="Operations orders"
            idle="Order lifecycle updates, invalid transitions, and retry status appear here."
          />
        </div>

        <section className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Fulfillment lifecycle</p>
          <div className="grid gap-2 md:grid-cols-4">
            {lifecycleCounts.map((entry) => (
              <div key={entry.state} className="rounded-xl border border-white/10 bg-black/18 p-3">
                <StatusBadge status={entry.state} />
                <p className="mt-3 font-[var(--type-display)] text-2xl font-semibold text-white">{entry.count}</p>
              </div>
            ))}
          </div>
        </section>

        <form data-order-filter-form className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:grid-cols-[1fr_220px_auto] md:items-end">
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Search orders</span>
            <input name="q" defaultValue={query} placeholder="Order number, customer, or id" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Fulfillment</span>
            <select name="fulfillment_status" defaultValue={fulfillmentFilter} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none">
              <option value="">all</option>
              <option value="pending">pending</option>
              <option value="processing">processing</option>
              <option value="packed">packed</option>
              <option value="shipped">shipped</option>
              <option value="delivered">delivered</option>
              <option value="cancelled">cancelled</option>
              <option value="returned">returned</option>
            </select>
          </label>
          <button className="rounded-xl border border-white/10 bg-white/[0.065] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/78">Filter</button>
        </form>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="grid gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Orders</p>
            <DataList rows={orderRows.length ? orderRows : [{ label: "orders", value: "0", detail: "No persisted order rows yet." }]} />
          </section>
          <section className="grid gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Order items</p>
            <DataList rows={itemRows.length ? itemRows : [{ label: "order_items", value: "0", detail: "No persisted order item rows yet." }]} />
          </section>
        </div>

        <form action={createOperationsOrderWithFeedback} data-order-management-table="orders" data-order-items-table="order_items" className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Customer email</span>
              <input name="customer_email" defaultValue="" placeholder="ops@example.com" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Region</span>
              <input name="region" defaultValue="" placeholder="IN-WEST" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Mission profile</span>
              <input name="mission_profile" defaultValue="" placeholder="agriculture" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Fulfillment status</span>
              <select name="fulfillment_status" defaultValue="pending" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none">
                <option value="pending">pending</option>
                <option value="processing">processing</option>
                <option value="packed">packed</option>
                <option value="shipped">shipped</option>
                <option value="delivered">delivered</option>
                <option value="cancelled">cancelled</option>
                <option value="returned">returned</option>
              </select>
            </label>
          </div>
          <input name="status" type="hidden" value="confirmed" />
          <input name="payment_status" type="hidden" value="not_required" />
          <input name="currency" type="hidden" value="INR" />
          <input name="warehouse_code" type="hidden" value="IN-WEST-01" />
          <input name="metadata" type="hidden" value="{}" />
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Order items</span>
            <textarea name="order_items" defaultValue="[]" rows={5} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 font-mono text-xs text-white outline-none" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Note</span>
            <input name="note" defaultValue="" placeholder="Operations order capture" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Change summary</span>
            <input name="change_summary" defaultValue="" placeholder="Create operations order" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <OperationalSubmitButton pendingLabel="Creating order">
            Create order
          </OperationalSubmitButton>
        </form>

        <form action={updateOperationsOrderLifecycleWithFeedback} data-order-lifecycle-form className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Order ID</span>
              <input name="order_id" defaultValue="" placeholder="uuid" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Fulfillment status</span>
              <select name="fulfillment_status" defaultValue="" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none">
                <option value="">leave unchanged</option>
                <option value="processing">processing</option>
                <option value="packed">packed</option>
                <option value="shipped">shipped</option>
                <option value="delivered">delivered</option>
                <option value="cancelled">cancelled</option>
                <option value="returned">returned</option>
              </select>
            </label>
          </div>
          <input name="status" type="hidden" value="active" />
          <input name="payment_status" type="hidden" value="not_required" />
          <input name="warehouse_code" type="hidden" value="IN-WEST-01" />
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Shipment tracking</span>
            <textarea name="shipment_tracking" defaultValue="{}" rows={4} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 font-mono text-xs text-white outline-none" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Lifecycle note</span>
            <input name="note" defaultValue="" placeholder="Packed for field dispatch" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Change summary</span>
            <input name="change_summary" defaultValue="" placeholder="Update operations order lifecycle" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <OperationalSubmitButton pendingLabel="Updating lifecycle">
            Update lifecycle
          </OperationalSubmitButton>
        </form>
      </div>
    </ControlShell>
  );
}
