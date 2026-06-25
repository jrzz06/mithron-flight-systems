import Link from "next/link";
import {
  AdminFormSection,
  AdminSection,
  AdminTableShell,
  OperationalFeedback,
  StatusBadge
} from "@/components/admin/module-panel";
import { formatINR } from "@/lib/utils";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";

type AdminRow = Record<string, unknown>;

type AdminOrdersWorkspaceProps = {
  orders: AdminRow[];
  orderItems: AdminRow[];
  stock: AdminRow[];
  shipments: AdminRow[];
  selectedOrder: AdminRow | null;
  selectedOrderId: string;
  selectedOrderKey: string;
  queue: string;
  query: string;
  orderStatus: string;
  orderMessage: string;
  snapshotStatus: string;
  blockedReason?: string | null;
  confirmAdminOrderAction: (formData: FormData) => Promise<void>;
  rejectAdminOrderAction: (formData: FormData) => Promise<void>;
  assignAdminWarehouseAction: (formData: FormData) => Promise<void>;
  updateAdminOrderLifecycleAction: (formData: FormData) => Promise<void>;
  confirmAdminWarehouseHandoffAction: (formData: FormData) => Promise<void>;
};

const lifecycleStates = [
  "pending",
  "processing",
  "picked",
  "packed",
  "ready_to_dispatch",
  "shipped",
  "delivered",
  "returned",
  "cancelled"
] as const;

const queueDefinitions = [
  { key: "review", label: "Needs action" },
  { key: "confirmed", label: "Confirmed" },
  { key: "fulfillment", label: "In fulfillment" },
  { key: "all", label: "All orders" }
] as const;

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberText(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

function moneyText(value: unknown) {
  const parsed = Number(value ?? 0);
  return formatINR(Number.isFinite(parsed) ? parsed : 0);
}

function publicOrderLabel(order: AdminRow) {
  return text(order.order_number) || text(order.id).slice(0, 8) || "Order";
}

function orderDate(order: AdminRow) {
  const raw = text(order.updated_at) || text(order.created_at);
  if (!raw) return "—";
  return raw.slice(0, 10);
}

function orderMetadata(order: AdminRow) {
  const metadata = order.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
}

function orderPhone(order: AdminRow) {
  return text(orderMetadata(order).customer_phone, "—");
}

function orderChannel(order: AdminRow) {
  const channel = text(order.channel, "checkout");
  return channel === "enquiry" ? "Enquiry" : "Checkout";
}

function orderStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_payment: "Awaiting payment",
    paid: "Paid",
    admin_review: "In review",
    confirmed: "Confirmed",
    assigned: "Assigned",
    processing: "Processing",
    cancelled: "Cancelled"
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function orderMatchesQueue(order: AdminRow, queue: string) {
  const status = text(order.status, "pending");
  const fulfillment = text(order.fulfillment_status, "pending");
  const channel = text(order.channel, "checkout");

  if (queue === "review") {
    return ["paid", "admin_review", "pending_payment"].includes(status)
      || (channel === "enquiry" && ["admin_review", "pending_payment"].includes(status));
  }
  if (queue === "confirmed") return status === "confirmed";
  if (queue === "fulfillment") {
    return ["assigned", "processing", "packed", "dispatched", "in_transit"].includes(status)
      || ["processing", "picked", "packed", "ready_to_dispatch", "shipped"].includes(fulfillment);
  }
  return true;
}

function buildOrdersUrl(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `/admin/orders?${query}` : "/admin/orders";
}

function orderTimeline(order: AdminRow) {
  return Array.isArray(order.timeline) ? order.timeline.slice(-6).reverse() as AdminRow[] : [];
}

function formatAddress(metadata: Record<string, unknown>) {
  const guest = metadata.guest_shipping_address;
  if (guest && typeof guest === "object" && !Array.isArray(guest)) {
    const address = guest as Record<string, unknown>;
    return [
      text(address.line1),
      text(address.city),
      text(address.region),
      text(address.postalCode)
    ].filter(Boolean).join(", ");
  }
  return "";
}

function nextStepForOrder(order: AdminRow) {
  const status = text(order.status, "pending");
  const fulfillment = text(order.fulfillment_status, "pending");

  if (status === "paid") {
    return {
      title: "Review paid order",
      description: "Payment is complete. Check customer details, then move this order into admin review.",
      action: "confirm" as const,
      button: "Move to admin review"
    };
  }
  if (status === "admin_review") {
    return {
      title: "Confirm order",
      description: "Approve the order after verifying contact details, items, and any enquiry notes.",
      action: "confirm" as const,
      button: "Confirm order"
    };
  }
  if (status === "confirmed" && fulfillment === "pending") {
    return {
      title: "Send to warehouse",
      description: "Order is confirmed. Assign it to warehouse so picking and packing can begin.",
      action: "assign" as const,
      button: "Assign to warehouse"
    };
  }
  if (status === "assigned" || fulfillment === "processing") {
    return {
      title: "Track fulfillment",
      description: "Warehouse is working on this order. Update fulfillment status or create a shipment when ready.",
      action: "fulfillment" as const,
      button: ""
    };
  }
  if (status === "pending_payment") {
    return {
      title: "Awaiting customer payment",
      description: "This order is not paid yet. No admin action is required until payment succeeds.",
      action: "none" as const,
      button: ""
    };
  }
  return {
    title: "No action required",
    description: "This order is moving through fulfillment or already completed.",
    action: "none" as const,
    button: ""
  };
}

export function AdminOrdersWorkspace({
  orders,
  orderItems,
  stock,
  shipments,
  selectedOrder,
  selectedOrderId,
  selectedOrderKey,
  queue,
  query,
  orderStatus,
  orderMessage,
  snapshotStatus,
  blockedReason,
  confirmAdminOrderAction,
  rejectAdminOrderAction,
  assignAdminWarehouseAction,
  updateAdminOrderLifecycleAction,
  confirmAdminWarehouseHandoffAction
}: AdminOrdersWorkspaceProps) {
  const queueCounts = queueDefinitions.map((entry) => ({
    ...entry,
    count: orders.filter((order) => orderMatchesQueue(order, entry.key)).length
  }));

  const filteredOrders = orders.filter((order) => {
    const haystack = `${publicOrderLabel(order)} ${text(order.customer_email)} ${orderPhone(order)}`.toLowerCase();
    return orderMatchesQueue(order, queue) && (!query || haystack.includes(query));
  });

  const selectedItems = selectedOrderId
    ? orderItems.filter((item) => text(item.order_id) === selectedOrderId)
    : [];
  const selectedShipments = selectedOrderId
    ? shipments.filter((shipment) => text(shipment.order_id) === selectedOrderId)
    : [];
  const firstItem = selectedItems[0] ?? null;
  const firstStock = firstItem
    ? stock.find((row) => text(row.product_slug) === text(firstItem.product_slug) && text(row.sku) === text(firstItem.sku))
    : null;
  const timeline = selectedOrder ? orderTimeline(selectedOrder) : [];
  const metadata = selectedOrder ? orderMetadata(selectedOrder) : {};
  const shippingAddress = formatAddress(metadata);
  const nextStep = selectedOrder ? nextStepForOrder(selectedOrder) : null;
  const selectedKey = selectedOrderKey || (selectedOrder ? text(selectedOrder.order_number) || selectedOrderId : "");

  function formContextFields() {
    return (
      <>
        <input type="hidden" name="queue" value={queue} />
        {query ? <input type="hidden" name="q" value={query} /> : null}
      </>
    );
  }

  return (
    <div className="grid gap-5">
      <OperationalFeedback
        status={orderStatus}
        message={orderMessage}
        context="Order workflow"
        idle="Select an order on the left, then use the next-step panel on the right."
      />

      <nav
        data-order-status-board
        data-booking-workflow-board
        aria-label="Order queues"
        className="flex flex-wrap gap-2"
      >
        {queueCounts.map((entry) => {
          const active = queue === entry.key;
          return (
            <Link
              key={entry.key}
              href={buildOrdersUrl({ queue: entry.key, order: selectedKey || undefined, q: query || undefined })}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-violet-500/50 bg-violet-500/10 text-violet-100"
                  : "border-slate-800 bg-[#10151d] text-slate-300 hover:border-slate-700 hover:text-slate-100"
              }`}
            >
              {entry.label}
              <span className={`rounded-md px-1.5 py-0.5 text-xs ${active ? "bg-violet-500/20" : "bg-slate-800"}`}>
                {entry.count}
              </span>
            </Link>
          );
        })}
      </nav>

      <form
        method="get"
        data-order-filter-form
        className="grid gap-3 rounded-xl border border-slate-800 bg-[#10151d] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
      >
        <input type="hidden" name="queue" value={queue} />
        {selectedKey ? <input type="hidden" name="order" value={selectedKey} /> : null}
        <label className="grid gap-2 text-sm">
          <span className="text-slate-400">Search by order number, email, or phone</span>
          <input
            name="q"
            defaultValue={query}
            placeholder="ORD-..., buyer@example.com, +91..."
            className="rounded-lg border border-slate-700 bg-[#0b1017] px-3 py-2 text-slate-100 outline-none placeholder:text-slate-600"
          />
        </label>
        <button className="h-10 rounded-lg border border-slate-700 bg-[#151c26] px-4 text-sm font-semibold text-slate-100">
          Search
        </button>
      </form>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <AdminTableShell
          title={`Orders (${filteredOrders.length})`}
          description={blockedReason ?? "Click an order to review details and take action."}
        >
          {filteredOrders.length ? (
            <div className="divide-y divide-slate-800">
              {filteredOrders.slice(0, 40).map((order) => {
                const orderId = text(order.id);
                const orderNumber = publicOrderLabel(order);
                const itemCount = orderItems.filter((item) => text(item.order_id) === orderId).length;
                const isSelected = selectedKey === orderNumber || selectedOrderId === orderId;
                return (
                  <Link
                    key={orderId || orderNumber}
                    href={buildOrdersUrl({ queue, order: orderNumber, q: query || undefined })}
                    className={`block px-4 py-3 transition hover:bg-[#151c26] ${isSelected ? "bg-violet-500/10" : ""}`}
                    aria-current={isSelected ? "true" : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-100">{orderNumber}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{text(order.customer_email, "No email")}</p>
                        <p className="mt-1 text-xs text-slate-600">{orderDate(order)} · {itemCount} item{itemCount === 1 ? "" : "s"}</p>
                      </div>
                      <div className="grid shrink-0 justify-items-end gap-1.5">
                        <StatusBadge status={text(order.status, "pending")} />
                        <span className="text-xs font-medium text-slate-400">
                          {moneyText(order.total)}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">No orders match this queue.</p>
          )}
        </AdminTableShell>

        <section data-order-detail-panel className="grid gap-4">
          {selectedOrder ? (
            <>
              <AdminSection
                eyebrow="Selected order"
                title={publicOrderLabel(selectedOrder)}
                description={`${orderChannel(selectedOrder)} · ${orderStatusLabel(text(selectedOrder.status, "pending"))}`}
                actions={<StatusBadge status={snapshotStatus} />}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-800 bg-[#10151d] p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Customer</p>
                    <p className="mt-2 text-sm font-medium text-slate-100">{text(selectedOrder.customer_email, "No email")}</p>
                    <p className="mt-1 text-sm text-slate-400">Phone: {orderPhone(selectedOrder)}</p>
                    {shippingAddress ? (
                      <p className="mt-2 text-sm leading-6 text-slate-400">{shippingAddress}</p>
                    ) : null}
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#10151d] p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">Payment</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={text(selectedOrder.payment_status, "not_required")} />
                      <StatusBadge status={text(selectedOrder.fulfillment_status, "pending")} />
                    </div>
                    <p className="mt-3 text-lg font-semibold text-slate-100">
                      {moneyText(selectedOrder.total)}
                    </p>
                    {text(metadata.enquiry_message) ? (
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        Enquiry: {text(metadata.enquiry_message).slice(0, 220)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </AdminSection>

              <AdminSection title="Line items" description="Products included in this order.">
                <div data-inventory-allocation className="grid gap-2">
                  {selectedItems.length ? selectedItems.map((item) => {
                    const stockRow = stock.find((row) => text(row.product_slug) === text(item.product_slug) && text(row.sku) === text(item.sku));
                    return (
                      <div
                        key={text(item.id) || `${text(item.product_slug)}-${text(item.sku)}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#10151d] px-3 py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-100">{text(item.product_name, text(item.product_slug, "Product"))}</p>
                          <p className="text-xs text-slate-500">Qty {numberText(item.quantity)} · {moneyText(item.line_total)}</p>
                        </div>
                        <p className="text-xs text-slate-500">Stock {numberText(stockRow?.available_quantity)}</p>
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-slate-500">No order items found.</p>
                  )}
                </div>
              </AdminSection>

              {nextStep ? (
                <AdminFormSection
                  title={nextStep.title}
                  description={nextStep.description}
                >
                  <div className="flex flex-wrap gap-2">
                    {nextStep.action === "confirm" ? (
                      <form action={confirmAdminOrderAction}>
                        <input type="hidden" name="order_id" value={selectedOrderId} />
                        <input type="hidden" name="expected_updated_at" value={text(selectedOrder.updated_at)} />
                        {formContextFields()}
                        <OperationalSubmitButton
                          pendingLabel="Working..."
                          className="h-10 rounded-lg border border-violet-600 bg-violet-600 px-4 text-sm font-semibold text-white"
                        >
                          {nextStep.button}
                        </OperationalSubmitButton>
                      </form>
                    ) : null}
                    {text(selectedOrder.status) === "admin_review" ? (
                      <form action={rejectAdminOrderAction} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="order_id" value={selectedOrderId} />
                        <input type="hidden" name="expected_updated_at" value={text(selectedOrder.updated_at)} />
                        {formContextFields()}
                        <label className="grid gap-1 text-xs text-slate-400">
                          Rejection note
                          <input
                            name="reject_reason"
                            placeholder="Reason shared with customer"
                            className="h-10 min-w-[220px] rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100"
                          />
                        </label>
                        <OperationalSubmitButton
                          pendingLabel="Rejecting..."
                          className="h-10 rounded-lg border border-rose-700 bg-rose-900/40 px-4 text-sm font-semibold text-rose-100"
                        >
                          Reject order
                        </OperationalSubmitButton>
                      </form>
                    ) : null}
                    {nextStep.action === "assign" ? (
                      <form action={assignAdminWarehouseAction}>
                        <input type="hidden" name="order_id" value={selectedOrderId} />
                        <input type="hidden" name="expected_updated_at" value={text(selectedOrder.updated_at)} />
                        {formContextFields()}
                        <OperationalSubmitButton
                          pendingLabel="Assigning..."
                          className="h-10 rounded-lg border border-cyan-600 bg-cyan-600 px-4 text-sm font-semibold text-white"
                        >
                          {nextStep.button}
                        </OperationalSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </AdminFormSection>
              ) : null}

              <AdminSection title="Activity timeline" description="Latest status changes for this order.">
                <div data-order-timeline className="grid gap-2">
                  {timeline.length ? timeline.map((entry, index) => (
                    <div key={`${text(entry.status, "status")}-${index}`} className="rounded-lg border border-slate-800 bg-[#10151d] px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={text(entry.status) || text(entry.event, "updated")} />
                        <span className="text-xs text-slate-500">{text(entry.at).slice(0, 19).replace("T", " ")}</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{text(entry.note) || text(entry.event, "Updated")}</p>
                    </div>
                  )) : (
                    <p className="text-sm text-slate-500">No timeline events yet.</p>
                  )}
                </div>
              </AdminSection>

              {["confirmed", "assigned", "processing", "packed", "dispatched"].includes(text(selectedOrder.status)) ? (
                <AdminFormSection
                  title="Update fulfillment"
                  description="Move the order through warehouse stages when picking, packing, or dispatch progresses."
                >
                  <form action={updateAdminOrderLifecycleAction} data-order-transition-feedback className="grid gap-3">
                    <input type="hidden" name="order_id" value={selectedOrderId} />
                    {formContextFields()}
                    <input type="hidden" name="status" value={text(selectedOrder.status, "confirmed")} />
                    <input type="hidden" name="payment_status" value={text(selectedOrder.payment_status, "not_required")} />
                    <input type="hidden" name="change_summary" value={`Operator status update ${publicOrderLabel(selectedOrder)}`} />
                    <label className="grid gap-2 text-sm text-slate-300">
                      Next fulfillment status
                      <select
                        name="fulfillment_status"
                        defaultValue=""
                        className="rounded-lg border border-slate-700 bg-[#0b1017] px-3 py-2 text-slate-100 outline-none"
                      >
                        <option value="">Choose next status</option>
                        {lifecycleStates
                          .filter((state) => state !== text(selectedOrder.fulfillment_status))
                          .map((state) => (
                            <option key={state} value={state}>{state.replaceAll("_", " ")}</option>
                          ))}
                      </select>
                    </label>
                    <input
                      name="note"
                      placeholder="Optional note for the timeline"
                      className="rounded-lg border border-slate-700 bg-[#0b1017] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                    />
                    <OperationalSubmitButton
                      pendingLabel="Updating..."
                      className="h-10 w-fit rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white"
                    >
                      Save fulfillment update
                    </OperationalSubmitButton>
                  </form>
                </AdminFormSection>
              ) : null}

              {["assigned", "processing", "packed", "dispatched", "confirmed"].includes(text(selectedOrder.status)) ? (
                <AdminFormSection
                  title="Create shipment"
                  description="Send dispatch details to warehouse when the order is ready to ship."
                >
                  <form action={confirmAdminWarehouseHandoffAction} data-shipment-actions data-confirm-warehouse-handoff className="grid gap-3">
                    <input type="hidden" name="order_id" value={selectedOrderId} />
                    {formContextFields()}
                    <input type="hidden" name="warehouse_id" value={text(firstStock?.warehouse_code, "IN-WEST-01")} />
                    <input type="hidden" name="order_item_id" value={text(firstItem?.id)} />
                    <input type="hidden" name="shipment_product_id" value={text(firstItem?.product_slug)} />
                    <input type="hidden" name="shipment_quantity" value={numberText(firstItem?.quantity ?? 1)} />
                    <input type="hidden" name="change_summary" value={`Create shipment handoff ${publicOrderLabel(selectedOrder)}`} />
                    {selectedShipments.length ? (
                      <div className="grid gap-2">
                        {selectedShipments.map((shipment) => (
                          <div key={text(shipment.id)} className="rounded-lg border border-slate-800 bg-[#0b1017] px-3 py-2 text-sm text-slate-400">
                            {text(shipment.shipment_number, "Shipment")} · {text(shipment.shipment_status, "pending")}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        name="carrier_name"
                        placeholder="Carrier name"
                        className="rounded-lg border border-slate-700 bg-[#0b1017] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                      />
                      <input
                        name="tracking_number"
                        placeholder="Tracking number"
                        className="rounded-lg border border-slate-700 bg-[#0b1017] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600"
                      />
                    </div>
                    {firstItem ? (
                      <OperationalSubmitButton
                        pendingLabel="Creating..."
                        className="h-10 w-fit rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white"
                      >
                        Create shipment handoff
                      </OperationalSubmitButton>
                    ) : (
                      <p className="text-sm text-slate-500">Add order items before creating a shipment.</p>
                    )}
                  </form>
                </AdminFormSection>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-[#10151d] p-6 text-sm text-slate-500">
              Select an order from the list to review customer details and take action.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
