import { ControlShell } from "@/components/admin/control-shell";
import { DataList, OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { formatINR } from "@/lib/utils";
import { getWarehouseSnapshot } from "@/services/admin";
import { createWarehouseOrderFormAction, updateWarehouseOrderLifecycleFormAction } from "../actions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function feedbackPath(status: "success" | "error", message: string) {
  return `/warehouse/orders?operation_status=${status}&operation_message=${encodeURIComponent(message)}`;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "The warehouse order action failed.";
}

async function createWarehouseOrderWithFeedback(formData: FormData) {
  "use server";
  try {
    await createWarehouseOrderFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", messageFromError(error)));
  }
  redirect(feedbackPath("success", "Warehouse order persisted and fulfillment queue refreshed."));
}

async function updateWarehouseOrderLifecycleWithFeedback(formData: FormData) {
  "use server";
  try {
    await updateWarehouseOrderLifecycleFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", messageFromError(error)));
  }
  redirect(feedbackPath("success", "Order lifecycle update persisted with audit history."));
}

export default async function WarehouseOrdersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getWarehouseSnapshot({ scope: "orders" });
  const params = searchParams ? await searchParams : {};
  const fulfillmentFilter = searchValue(params, "fulfillment_status");
  const query = searchValue(params, "q").toLowerCase();
  const operationStatus = searchValue(params, "operation_status");
  const operationMessage = searchValue(params, "operation_message");
  const stockByProduct = new Set(snapshot.data.stock.map((row) => String(row.product_slug ?? "")).filter(Boolean));
  const productOptions = snapshot.data.products.map((product) => ({
    slug: String(product.slug ?? ""),
    name: String(product.name ?? product.slug ?? "Product"),
    stockReady: stockByProduct.has(String(product.slug ?? ""))
  })).filter((product) => product.slug);
  const lifecycleStates = ["pending", "processing", "picked", "packed", "ready_to_dispatch", "shipped", "delivered", "returned", "cancelled"];
  const lifecycleCounts = lifecycleStates.map((state) => ({
    state,
    count: snapshot.data.orders.filter((order) => String(order.fulfillment_status ?? "pending") === state).length
  }));
  const filteredOrders = snapshot.data.orders.filter((order) => {
    const fulfillmentStatus = String(order.fulfillment_status ?? "");
    const haystack = `${String(order.order_number ?? "")} ${String(order.customer_email ?? "")} ${String(order.id ?? "")}`.toLowerCase();
    return (!fulfillmentFilter || fulfillmentStatus === fulfillmentFilter) && (!query || haystack.includes(query));
  });

  function orderMetadata(order: Record<string, unknown>) {
    const metadata = order.metadata;
    return metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata as Record<string, unknown>
      : {};
  }

  function formatGuestAddress(metadata: Record<string, unknown>) {
    const guest = metadata.guest_shipping_address;
    if (!guest || typeof guest !== "object" || Array.isArray(guest)) return "";
    const address = guest as Record<string, unknown>;
    return [
      address.line1,
      address.line2,
      [address.city, address.region, address.postalCode].filter(Boolean).join(", "),
      address.country
    ].filter((part) => typeof part === "string" && part.trim()).join("\n");
  }

  const handoffOrders = filteredOrders.filter((order) => {
    const status = String(order.status ?? "");
    const fulfillment = String(order.fulfillment_status ?? "");
    return ["assigned", "confirmed", "processing"].includes(status) || ["processing", "pending"].includes(fulfillment);
  }).slice(0, 8);
  const orderRows = filteredOrders.slice(0, 12).map((order) => ({
    label: String(order.order_number ?? order.id ?? "order"),
    value: String(order.fulfillment_status ?? order.status ?? "draft"),
    detail: `${String(order.customer_email ?? "No customer")} | total ${formatINR(Number(order.total ?? 0))}`
  }));
  const itemRows = snapshot.data.orderItems.slice(0, 12).map((item) => ({
    label: `${String(item.product_slug ?? "product")}:${String(item.sku ?? "sku")}`,
    value: String(item.quantity ?? 0),
    detail: `${String(item.product_name ?? "Product")} | order ${String(item.order_id ?? "unknown")}`
  }));
  const fulfillmentTimelineRows = filteredOrders.flatMap((order) => {
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];
    return timeline.map((event, index) => {
      const record = event && typeof event === "object" && !Array.isArray(event) ? event as Record<string, unknown> : {};
      return {
        label: String(record.event ?? record.status ?? "fulfillment.event"),
        value: String(record.status ?? order.fulfillment_status ?? "pending"),
        detail: `${String(record.at ?? record.created_at ?? order.updated_at ?? "n/a")} | actor ${String(record.actorId ?? record.actor_id ?? "system")} | order ${String(order.order_number ?? order.id ?? "order")} | ${String(record.note ?? "No note")}`,
        sortKey: String(record.at ?? record.created_at ?? order.updated_at ?? index)
      };
    });
  }).sort((a, b) => b.sortKey.localeCompare(a.sortKey)).slice(0, 10);

  return (
    <ControlShell
      eyebrow="Warehouse orders"
      title="Fulfillment queue."
      description={snapshot.blockedReason ?? "Warehouse role access is limited to order readiness, committed stock, fulfillment state, and logistics coordination."}
      metrics={[
        { label: "Orders", value: String(snapshot.data.orders.length) },
        { label: "Access", value: "WAREHOUSE" },
        { label: "Status", value: snapshot.status }
      ]}
      actions={[
        { label: "Inventory", href: "/warehouse/inventory" },
        { label: "Picking", href: "/warehouse/picking" },
        { label: "Packing", href: "/warehouse/packing" },
        { label: "Dispatch", href: "/warehouse/dispatch" }
      ]}
    >
      <div className="grid gap-8">
        <div data-warehouse-order-feedback>
          <OperationalFeedback
            status={operationStatus}
            message={operationMessage}
            context="Warehouse order"
            idle="Create, lifecycle, and fulfillment errors will appear here with retry-safe status."
          />
        </div>

        <section data-warehouse-order-lifecycle className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Lifecycle state</p>
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
              <option value="picked">picked</option>
              <option value="packed">packed</option>
              <option value="ready_to_dispatch">ready_to_dispatch</option>
              <option value="shipped">shipped</option>
              <option value="delivered">delivered</option>
              <option value="returned">returned</option>
              <option value="cancelled">cancelled</option>
            </select>
          </label>
          <button className="rounded-xl border border-white/10 bg-white/[0.065] px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-white/78">Filter</button>
        </form>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="grid gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Orders</p>
            <DataList rows={orderRows.length ? orderRows : [{ label: "orders", value: "0", detail: "No order rows yet." }]} />
          </section>
          <section className="grid gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Order items</p>
            <DataList rows={itemRows.length ? itemRows : [{ label: "order_items", value: "0", detail: "No order item rows yet." }]} />
          </section>
        </div>

        {handoffOrders.length ? (
          <section data-warehouse-order-handoff className="grid gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Fulfillment handoff details</p>
            <div className="grid gap-3">
              {handoffOrders.map((order) => {
                const orderId = String(order.id ?? "");
                const metadata = orderMetadata(order);
                const items = snapshot.data.orderItems.filter((item) => String(item.order_id ?? "") === orderId);
                const address = formatGuestAddress(metadata);
                return (
                  <article key={orderId} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white">{String(order.order_number ?? orderId)}</p>
                      <StatusBadge status={String(order.fulfillment_status ?? order.status ?? "pending")} />
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-white/75 sm:grid-cols-2">
                      <p>Email: {String(order.customer_email ?? "—")}</p>
                      <p>Phone: {String(metadata.customer_phone ?? "—")}</p>
                      <p>Channel: {String(order.channel ?? "checkout")}</p>
                      <p>Total: {formatINR(Number(order.total ?? 0))}</p>
                    </div>
                    {address ? (
                      <p className="mt-3 whitespace-pre-line text-sm text-white/65">Ship to:\n{address}</p>
                    ) : null}
                    {typeof metadata.enquiry_message === "string" && metadata.enquiry_message.trim() ? (
                      <p className="mt-3 text-sm text-white/65">Notes: {metadata.enquiry_message}</p>
                    ) : null}
                    <ul className="mt-3 grid gap-1 text-sm text-white/70">
                      {items.map((item) => (
                        <li key={String(item.id)}>
                          {String(item.product_name ?? item.product_slug)} × {String(item.quantity ?? 1)}
                          {item.sku ? ` · SKU ${String(item.sku)}` : ""}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <section data-fulfillment-timeline className="grid gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Fulfillment timeline</p>
          <DataList
            rows={fulfillmentTimelineRows.length
              ? fulfillmentTimelineRows.map(({ label, value, detail }) => ({ label, value, detail }))
              : [{ label: "order.timeline", value: "0", detail: "No fulfillment timeline entries found for the current order filter." }]}
          />
        </section>

        <form action={createWarehouseOrderWithFeedback} data-order-management-table="orders" data-order-items-table="order_items" className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
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
                <option value="picked">picked</option>
                <option value="packed">packed</option>
                <option value="ready_to_dispatch">ready_to_dispatch</option>
                <option value="shipped">shipped</option>
                <option value="delivered">delivered</option>
                <option value="returned">returned</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
          </div>
          <input name="status" type="hidden" value="confirmed" />
          <input name="payment_status" type="hidden" value="not_required" />
          <input name="currency" type="hidden" value="INR" />
          <input name="warehouse_code" type="hidden" value="IN-WEST-01" />
          <input name="metadata" type="hidden" value="" />
          <div data-order-product-picker className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,1fr)_140px_180px]">
            <label className="grid gap-2 text-sm">
              <span className="text-slate-700">Product</span>
              {productOptions.length ? (
                <select name="order_item_product_slug" defaultValue="" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none">
                  <option value="">Select product</option>
                  {productOptions.map((product) => (
                    <option key={product.slug} value={product.slug}>
                      {product.name}{product.stockReady ? "" : " - Stock row missing"}
                    </option>
                  ))}
                </select>
              ) : (
                <input name="order_item_product_slug" placeholder="Product reference" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none placeholder:text-slate-400" />
              )}
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-slate-700">Quantity</span>
              <input name="order_item_quantity" defaultValue="1" inputMode="numeric" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-slate-700">SKU</span>
              <input name="order_item_sku" defaultValue="" placeholder="Required for shipment" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-950 outline-none placeholder:text-slate-400" />
            </label>
          </div>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Note</span>
            <input name="note" defaultValue="" placeholder="Warehouse order capture" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Change summary</span>
            <input name="change_summary" defaultValue="" placeholder="Create warehouse order" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <OperationalSubmitButton pendingLabel="Creating order">
            Create order
          </OperationalSubmitButton>
        </form>

        <form action={updateWarehouseOrderLifecycleWithFeedback} data-order-lifecycle-form className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
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
                <option value="picked">picked</option>
                <option value="packed">packed</option>
                <option value="ready_to_dispatch">ready_to_dispatch</option>
                <option value="shipped">shipped</option>
                <option value="delivered">delivered</option>
                <option value="returned">returned</option>
                <option value="cancelled">cancelled</option>
              </select>
            </label>
          </div>
          <input name="warehouse_code" type="hidden" value="IN-WEST-01" />
          <div className="grid gap-4 md:grid-cols-3">
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Tracking number</span>
              <input name="tracking_number" defaultValue="" placeholder="optional" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Carrier</span>
              <input name="carrier" defaultValue="" placeholder="optional" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Tracking URL</span>
              <input name="tracking_url" defaultValue="" placeholder="optional" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
            </label>
          </div>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Lifecycle note</span>
            <input name="note" defaultValue="" placeholder="Packed for field dispatch" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Change summary</span>
            <input name="change_summary" defaultValue="" placeholder="Update warehouse order lifecycle" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <OperationalSubmitButton pendingLabel="Updating lifecycle">
            Update lifecycle
          </OperationalSubmitButton>
        </form>
      </div>
    </ControlShell>
  );
}
