"use client";

import Link from "next/link";
import {
  AdminFormSection,
  AdminSection,
  AdminTableShell,
  OperationalFeedback,
  StatusBadge
} from "@/components/admin/module-panel";
import { FormField, Input, Select, Textarea } from "@/components/platform";
import { ManualOrderCreatePanel } from "@/components/admin/manual-order-create-panel";
import { AdminOrderActionForm, AdminOrdersOptimisticProvider, AdminOrdersQueueList } from "@/components/admin/admin-orders-optimistic";
import { formatINR } from "@/lib/utils";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import {
  ADMIN_QUEUE_LABELS,
  customerOrderSourceLabel,
  isOrderArchived,
  isOrderDeleted,
  matchesAdminOrderQueue,
  type AdminOrderQueue
} from "@/lib/orders/lifecycle";

type AdminRow = Record<string, unknown>;

type AdminOrdersWorkspaceProps = {
  orders: AdminRow[];
  orderItems: AdminRow[];
  stock: AdminRow[];
  shipments: AdminRow[];
  products: AdminRow[];
  warehouses: Array<{ code: string; name: string }>;
  defaultWarehouseCode: string;
  selectedOrder: AdminRow | null;
  selectedOrderId: string;
  selectedOrderKey: string;
  queue: string;
  query: string;
  orderStatus: string;
  orderMessage: string;
  snapshotStatus: string;
  blockedReason?: string | null;
  createAdminManualOrderAction: (formData: FormData) => Promise<void>;
  confirmAdminOrderAction: (formData: FormData) => Promise<void>;
  rejectAdminOrderAction: (formData: FormData) => Promise<void>;
  cancelAdminOrderAction: (formData: FormData) => Promise<void>;
  deleteAdminOrderAction: (formData: FormData) => Promise<void>;
  archiveAdminOrderAction: (formData: FormData) => Promise<void>;
  restoreAdminOrderAction: (formData: FormData) => Promise<void>;
  permanentDeleteAdminOrderAction: (formData: FormData) => Promise<void>;
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

const queueDefinitions = (Object.keys(ADMIN_QUEUE_LABELS) as AdminOrderQueue[])
  .map((key) => ({ key, label: ADMIN_QUEUE_LABELS[key] }));

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

function assignedWarehouseCode(order: AdminRow, fallback: string) {
  return text(orderMetadata(order).assigned_warehouse_code, fallback);
}

function paymentLabel(order: AdminRow) {
  return text(order.payment_status, text(order.status, "pending")).replaceAll("_", " ");
}

function orderChannel(order: AdminRow) {
  const channel = text(order.channel, "checkout");
  return channel === "enquiry" ? "Enquiry" : "Checkout";
}

function productSummary(orderId: string, orderItems: AdminRow[]) {
  const items = orderItems.filter((item) => text(item.order_id) === orderId).slice(0, 2);
  if (!items.length) return "—";
  return items
    .map((item) => `${text(item.product_name, text(item.product_slug, "Item"))} ×${numberText(item.quantity)}`)
    .join(", ");
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
  return matchesAdminOrderQueue(order, (queue as AdminOrderQueue) || "active");
}

function canCancelOrder(order: AdminRow | null) {
  if (!order) return false;
  const status = text(order.status, "pending");
  const fulfillment = text(order.fulfillment_status, "pending");
  const terminal = ["cancelled", "delivered", "returned"];
  return !terminal.includes(status) && !terminal.includes(fulfillment);
}

function canDeleteOrder(order: AdminRow | null) {
  if (!order || isOrderDeleted(order)) return false;
  const status = text(order.status, "pending");
  const fulfillment = text(order.fulfillment_status, "pending");
  const channel = text(order.channel, "checkout");
  const activeFulfillment = ["processing", "picked", "packed", "ready_to_dispatch", "shipped", "delivered", "assigned"];
  if (activeFulfillment.includes(fulfillment)) return false;
  if (["assigned", "processing", "packed", "dispatched", "delivered", "confirmed"].includes(status)) return false;
  return ["draft", "pending_payment", "admin_review", "cancelled"].includes(status) || channel === "enquiry";
}

function canArchiveOrder(order: AdminRow | null) {
  if (!order || isOrderDeleted(order) || isOrderArchived(order)) return false;
  return !["cancelled", "delivered", "refunded"].includes(text(order.status, "pending"));
}

function canRestoreOrder(order: AdminRow | null) {
  return Boolean(order && (isOrderDeleted(order) || isOrderArchived(order)));
}

function canPermanentlyDeleteOrder(order: AdminRow | null) {
  return Boolean(order && isOrderDeleted(order));
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

import { formatAddressInline, pickAddressFromMetadata } from "@/lib/addresses/format";

function nextStepForOrder(order: AdminRow) {
  const status = text(order.status, "pending");
  const fulfillment = text(order.fulfillment_status, "pending");

  if (status === "paid") {
    return {
      title: "Verify order",
      description: "Payment is complete. Verify customer details, then move this order into admin review.",
      action: "confirm" as const,
      button: "Verify"
    };
  }
  if (status === "admin_review") {
    return {
      title: "Approve order",
      description: "Approve the order after verifying contact details, items, and any enquiry notes.",
      action: "confirm" as const,
      button: "Approve"
    };
  }
  if (status === "confirmed" && fulfillment === "pending") {
    return {
      title: "Send to warehouse",
      description: "Order is verified. Assign it to warehouse so picking and packing can begin.",
      action: "assign" as const,
      button: "Send to Warehouse"
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
  products,
  warehouses,
  defaultWarehouseCode,
  selectedOrder,
  selectedOrderId,
  selectedOrderKey,
  queue,
  query,
  orderStatus,
  orderMessage,
  snapshotStatus,
  blockedReason,
  createAdminManualOrderAction,
  confirmAdminOrderAction,
  rejectAdminOrderAction,
  cancelAdminOrderAction,
  deleteAdminOrderAction,
  archiveAdminOrderAction,
  restoreAdminOrderAction,
  permanentDeleteAdminOrderAction,
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
  const timeline = selectedOrder ? orderTimeline(selectedOrder) : [];
  const metadata = selectedOrder ? orderMetadata(selectedOrder) : {};
  const shippingAddress = formatAddressInline(pickAddressFromMetadata(metadata, "shipping"));
  const billingAddress = formatAddressInline(pickAddressFromMetadata(metadata, "billing"));
  const billingSameAsShipping = metadata.billing_same_as_shipping !== false;
  const nextStep = selectedOrder ? nextStepForOrder(selectedOrder) : null;
  const selectedKey = selectedOrderKey || (selectedOrder ? text(selectedOrder.order_number) || selectedOrderId : "");

  const catalogProducts = products.map((product) => ({
    slug: text(product.slug),
    name: text(product.name, text(product.slug)),
    price: Number(product.price ?? 0) || 0,
    chargeTax: product.charge_tax !== false,
    taxRate: product.tax_rate != null ? Number(product.tax_rate) : null,
    taxIncluded: Boolean(product.tax_included),
    taxGroup: text(product.tax_group) || null
  })).filter((product) => product.slug);

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
                  : "border-[var(--platform-border)] bg-[var(--platform-surface-muted)] text-[var(--platform-text-secondary)] hover:border-[var(--platform-border-strong)] hover:text-[var(--platform-text-primary)]"
              }`}
            >
              {entry.label}
              <span className={`rounded-md px-1.5 py-0.5 text-xs ${active ? "bg-violet-500/20" : "bg-[var(--platform-surface-muted)]"}`}>
                {entry.count}
              </span>
            </Link>
          );
        })}
      </nav>

      <form
        method="get"
        data-order-filter-form
        className="grid gap-3 rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"
      >
        <input type="hidden" name="queue" value={queue} />
        {selectedKey ? <input type="hidden" name="order" value={selectedKey} /> : null}
        <FormField label="Search by order number, email, or phone" htmlFor="admin-order-search">
          <Input
            id="admin-order-search"
            name="q"
            defaultValue={query}
            placeholder="ORD-..., buyer@example.com, +91..."
          />
        </FormField>
        <button className="platform-btn-secondary h-10 rounded-lg px-4 text-sm font-semibold">
          Search
        </button>
      </form>

      <div id="create-order">
        <ManualOrderCreatePanel
          products={catalogProducts}
          defaultWarehouseCode={defaultWarehouseCode}
          createAction={createAdminManualOrderAction}
        />
      </div>

      <AdminOrdersOptimisticProvider orders={filteredOrders}>
        {(optimisticOrders) => (
      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
        <AdminTableShell
          title={`Orders (${filteredOrders.length})`}
          description={blockedReason ?? undefined}
        >
          <AdminOrdersQueueList
            orders={optimisticOrders}
            orderItems={orderItems}
            selectedKey={selectedKey}
            selectedOrderId={selectedOrderId}
            queue={queue}
            query={query}
            publicOrderLabel={publicOrderLabel}
            productSummary={productSummary}
            orderDate={orderDate}
            paymentLabel={paymentLabel}
            assignedWarehouseCode={assignedWarehouseCode}
            defaultWarehouseCode={defaultWarehouseCode}
            buildOrdersUrl={buildOrdersUrl}
          />
        </AdminTableShell>

        <section data-order-detail-panel className="grid gap-4">
          {selectedOrder ? (
            <>
              <AdminSection
                eyebrow="Selected order"
                title={publicOrderLabel(selectedOrder)}
                description={`${customerOrderSourceLabel(selectedOrder)} · ${orderStatusLabel(text(selectedOrder.status, "pending"))}`}
                actions={<StatusBadge status={snapshotStatus} />}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--platform-text-muted)]">Customer</p>
                    <p className="mt-2 text-sm font-medium text-[var(--platform-text-primary)]">{text(metadata.customer_full_name) || text(selectedOrder.customer_email, "No email")}</p>
                    {text(selectedOrder.customer_email) ? (
                      <Link
                        href={`/admin/users?q=${encodeURIComponent(text(selectedOrder.customer_email))}`}
                        className="mt-1 inline-block text-sm text-violet-300 hover:underline"
                      >
                        {text(selectedOrder.customer_email)}
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">No email</p>
                    )}
                    <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">Phone: {orderPhone(selectedOrder)}</p>
                    {text(metadata.customer_company) ? (
                      <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">Company: {text(metadata.customer_company)}</p>
                    ) : null}
                    {shippingAddress ? (
                      <div className="mt-2 space-y-2 text-sm leading-6 text-[var(--platform-text-secondary)]">
                        <p>
                          <span className="font-medium text-[var(--platform-text-primary)]">Shipping: </span>
                          {shippingAddress}
                        </p>
                        {billingAddress ? (
                          <p>
                            <span className="font-medium text-[var(--platform-text-primary)]">Billing: </span>
                            {billingAddress}
                            {billingSameAsShipping ? " (same as shipping)" : ""}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--platform-text-muted)]">Order source</p>
                    <p className="mt-2 text-sm font-medium text-[var(--platform-text-primary)]">
                      {customerOrderSourceLabel(selectedOrder)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--platform-text-muted)]">
                      Channel: {orderChannel(selectedOrder)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-3">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--platform-text-muted)]">Payment</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={text(selectedOrder.payment_status, "not_required")} />
                      <StatusBadge status={text(selectedOrder.fulfillment_status, "pending")} />
                    </div>
                    <p className="mt-3 text-lg font-semibold text-[var(--platform-text-primary)]">
                      {moneyText(selectedOrder.total)}
                    </p>
                    {text(selectedOrder.payment_status) === "succeeded" && text(selectedOrder.invoice_url) ? (
                      <Link
                        href={`/admin/orders/invoice/${encodeURIComponent(selectedOrderId)}`}
                        className="mt-3 inline-flex rounded-full border border-[var(--platform-border-strong)] px-2.5 py-1 text-xs font-medium text-violet-300 hover:border-violet-400/40 hover:underline"
                      >
                        View invoice
                      </Link>
                    ) : null}
                    {assignedWarehouseCode(selectedOrder, defaultWarehouseCode) ? (
                      <Link
                        href="/warehouse/orders"
                        className="mt-3 inline-flex rounded-full border border-[var(--platform-border-strong)] px-2.5 py-1 text-xs font-medium text-violet-300 hover:border-violet-400/40 hover:underline"
                      >
                        Warehouse: {assignedWarehouseCode(selectedOrder, defaultWarehouseCode)}
                      </Link>
                    ) : null}
                    {text(metadata.enquiry_message) ? (
                      <p className="mt-3 text-sm leading-6 text-[var(--platform-text-secondary)]">
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
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 py-2.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-[var(--platform-text-primary)]">
                            {text(item.product_slug) ? (
                              <Link
                                href={`/admin/products?product_slug=${encodeURIComponent(text(item.product_slug))}`}
                                className="hover:text-violet-300 hover:underline"
                              >
                                {text(item.product_name, text(item.product_slug, "Product"))}
                              </Link>
                            ) : (
                              text(item.product_name, "Product")
                            )}
                          </p>
                          <p className="text-xs text-[var(--platform-text-muted)]">Qty {numberText(item.quantity)} · {moneyText(item.line_total)}</p>
                        </div>
                        <p className="text-xs text-[var(--platform-text-muted)]">Stock {numberText(stockRow?.available_quantity)}</p>
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-[var(--platform-text-muted)]">No order items found.</p>
                  )}
                </div>
              </AdminSection>

              {nextStep ? (
                <AdminFormSection
                  title={nextStep.title}
                  description={nextStep.description}
                >
                  <div className="flex flex-wrap items-end gap-3">
                    {nextStep.action === "confirm" ? (
                      <AdminOrderActionForm orderId={selectedOrderId} action={confirmAdminOrderAction} nextStatus="confirmed" className="shrink-0">
                        <input type="hidden" name="order_id" value={selectedOrderId} />
                        <input type="hidden" name="expected_updated_at" value={text(selectedOrder.updated_at)} />
                        {formContextFields()}
                        <OperationalSubmitButton
                          pendingLabel="Working..."
                          className="h-10 rounded-lg border border-violet-600 bg-violet-600 px-4 text-sm font-semibold text-white"
                        >
                          {nextStep.button}
                        </OperationalSubmitButton>
                      </AdminOrderActionForm>
                    ) : null}
                    {text(selectedOrder.status) === "admin_review" ? (
                      <AdminOrderActionForm orderId={selectedOrderId} action={rejectAdminOrderAction} nextStatus="cancelled" className="flex min-w-0 flex-1 flex-wrap items-end gap-2 sm:flex-nowrap">
                        <input type="hidden" name="order_id" value={selectedOrderId} />
                        <input type="hidden" name="expected_updated_at" value={text(selectedOrder.updated_at)} />
                        {formContextFields()}
                        <label className="grid min-w-[220px] flex-1 gap-1 text-xs text-[var(--platform-text-secondary)]">
                          Rejection note
                          <input
                            name="reject_reason"
                            placeholder="Reason shared with customer"
                            className="h-10 w-full rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)]"
                          />
                        </label>
                        <OperationalSubmitButton
                          pendingLabel="Rejecting..."
                          className="h-10 shrink-0 rounded-lg border border-rose-700 bg-rose-900/40 px-4 text-sm font-semibold text-rose-100"
                        >
                          Reject order
                        </OperationalSubmitButton>
                      </AdminOrderActionForm>
                    ) : null}
                    {canCancelOrder(selectedOrder) && text(selectedOrder.status) !== "admin_review" ? (
                      <AdminOrderActionForm orderId={selectedOrderId} action={cancelAdminOrderAction} nextStatus="cancelled" className="flex min-w-0 flex-1 flex-wrap items-end gap-2 sm:flex-nowrap">
                        <input type="hidden" name="order_id" value={selectedOrderId} />
                        <input type="hidden" name="expected_updated_at" value={text(selectedOrder.updated_at)} />
                        {formContextFields()}
                        <label className="grid min-w-[220px] flex-1 gap-1 text-xs text-[var(--platform-text-secondary)]">
                          Cancellation reason
                          <input
                            name="cancel_reason"
                            required
                            placeholder="Reason shared with customer"
                            className="h-10 w-full rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)]"
                          />
                        </label>
                        <OperationalSubmitButton
                          pendingLabel="Cancelling..."
                          className="h-10 shrink-0 rounded-lg border border-rose-700 bg-rose-900/40 px-4 text-sm font-semibold text-rose-100"
                        >
                          Cancel order
                        </OperationalSubmitButton>
                      </AdminOrderActionForm>
                    ) : null}
                    {nextStep.action === "assign" ? (
                      <AdminOrderActionForm orderId={selectedOrderId} action={assignAdminWarehouseAction} nextStatus="assigned" className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="order_id" value={selectedOrderId} />
                        <input type="hidden" name="expected_updated_at" value={text(selectedOrder.updated_at)} />
                        {formContextFields()}
                        <label className="grid gap-1 text-xs text-[var(--platform-text-secondary)]">
                          Warehouse
                          <select
                            name="warehouse_code"
                            defaultValue={(() => {
                              const metadata = selectedOrder.metadata;
                              const assigned = metadata && typeof metadata === "object" && !Array.isArray(metadata)
                                ? String((metadata as AdminRow).assigned_warehouse_code ?? "")
                                : "";
                              return assigned || defaultWarehouseCode;
                            })()}
                            className="h-10 min-w-[220px] rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)]"
                          >
                            {warehouses.map((warehouse) => (
                              <option key={warehouse.code} value={warehouse.code}>
                                {warehouse.name} ({warehouse.code})
                              </option>
                            ))}
                          </select>
                        </label>
                        <OperationalSubmitButton
                          pendingLabel="Assigning..."
                          className="h-10 rounded-lg border border-cyan-600 bg-cyan-600 px-4 text-sm font-semibold text-white"
                        >
                          {nextStep.button}
                        </OperationalSubmitButton>
                      </AdminOrderActionForm>
                    ) : null}
                  </div>
                </AdminFormSection>
              ) : null}

              <AdminSection title="Activity timeline">
                <div data-order-timeline className="grid gap-2">
                  {timeline.length ? timeline.map((entry, index) => {
                    const eventLabel = text(entry.note) || text(entry.event, text(entry.summary, "Updated"));
                    const eventAt = text(entry.at);
                    const dateKey = eventAt ? eventAt.slice(0, 10) : "unknown";
                    const prevDate = index > 0 ? text(timeline[index - 1]?.at).slice(0, 10) : "";
                    const showDate = dateKey !== prevDate;
                    return (
                      <div key={`${text(entry.status, "status")}-${index}`}>
                        {showDate ? (
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">{dateKey}</p>
                        ) : null}
                        <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 py-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={text(entry.status) || text(entry.event, "updated")} />
                            <span className="text-xs text-[var(--platform-text-muted)]">{eventAt.slice(11, 16) || "—"}</span>
                          </div>
                          <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">{eventLabel}</p>
                        </div>
                      </div>
                    );
                  }) : (
                    <p className="text-sm text-[var(--platform-text-muted)]">No timeline events yet.</p>
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
                    <label className="grid gap-2 text-sm text-[var(--platform-text-secondary)]">
                      Next fulfillment status
                      <select
                        name="fulfillment_status"
                        defaultValue=""
                        className="rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 py-2 text-[var(--platform-text-primary)] outline-none"
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
                      className="rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 py-2 text-sm text-[var(--platform-text-primary)] outline-none placeholder:text-[var(--platform-text-muted)]"
                    />
                    <OperationalSubmitButton
                      pendingLabel="Updating..."
                      className="platform-btn-primary platform-btn-md"
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
                    <label className="grid gap-2 text-sm text-[var(--platform-text-secondary)]">
                      Fulfillment warehouse
                      <select
                        name="warehouse_id"
                        defaultValue={assignedWarehouseCode(selectedOrder, defaultWarehouseCode)}
                        className="rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 py-2 text-[var(--platform-text-primary)] outline-none"
                      >
                        {warehouses.map((warehouse) => (
                          <option key={warehouse.code} value={warehouse.code}>
                            {warehouse.name} ({warehouse.code})
                          </option>
                        ))}
                      </select>
                    </label>
                    <input type="hidden" name="order_item_id" value={text(firstItem?.id)} />
                    <input type="hidden" name="shipment_product_id" value={text(firstItem?.product_slug)} />
                    <input type="hidden" name="shipment_quantity" value={numberText(firstItem?.quantity ?? 1)} />
                    <input type="hidden" name="change_summary" value={`Create shipment handoff ${publicOrderLabel(selectedOrder)}`} />
                    {selectedShipments.length ? (
                      <div className="grid gap-2">
                        {selectedShipments.map((shipment) => (
                          <div key={text(shipment.id)} className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-sm text-[var(--platform-text-secondary)]">
                            {text(shipment.shipment_number, "Shipment")} · {text(shipment.shipment_status, "pending")}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        name="carrier_name"
                        placeholder="Carrier name"
                        className="rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 py-2 text-sm text-[var(--platform-text-primary)] outline-none placeholder:text-[var(--platform-text-muted)]"
                      />
                      <input
                        name="tracking_number"
                        placeholder="Tracking number"
                        className="rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 py-2 text-sm text-[var(--platform-text-primary)] outline-none placeholder:text-[var(--platform-text-muted)]"
                      />
                    </div>
                    {firstItem ? (
                      <OperationalSubmitButton
                        pendingLabel="Creating..."
                        className="platform-btn-primary platform-btn-md"
                      >
                        Create shipment handoff
                      </OperationalSubmitButton>
                    ) : (
                      <p className="text-sm text-[var(--platform-text-muted)]">Add order items before creating a shipment.</p>
                    )}
                  </form>
                </AdminFormSection>
              ) : null}

              {canArchiveOrder(selectedOrder) ? (
                <AdminFormSection
                  title="Archive order"
                  description="Hide this order from active queues while keeping it for audit."
                >
                  <form action={archiveAdminOrderAction} className="grid gap-3 md:max-w-xl">
                    <input type="hidden" name="order_id" value={selectedOrderId} />
                    {formContextFields()}
                    <label className="grid gap-2 text-sm text-[var(--platform-text-secondary)]">
                      Archive note
                      <textarea
                        name="archive_reason"
                        rows={2}
                        placeholder="Optional reason"
                        className="rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 py-2 text-[var(--platform-text-primary)] outline-none placeholder:text-[var(--platform-text-muted)]"
                      />
                    </label>
                    <OperationalSubmitButton
                      pendingLabel="Archiving..."
                      className="h-10 w-fit rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface-muted)] px-4 text-sm font-semibold text-[var(--platform-text-primary)]"
                    >
                      Archive order
                    </OperationalSubmitButton>
                  </form>
                </AdminFormSection>
              ) : null}

              {canRestoreOrder(selectedOrder) ? (
                <AdminFormSection
                  title="Restore order"
                  description="Return this order from trash or archive to active queues."
                >
                  <form action={restoreAdminOrderAction}>
                    <input type="hidden" name="order_id" value={selectedOrderId} />
                    {formContextFields()}
                    <OperationalSubmitButton
                      pendingLabel="Restoring..."
                      className="h-10 w-fit rounded-lg border border-emerald-700 bg-emerald-950/40 px-4 text-sm font-semibold text-emerald-100"
                    >
                      Restore order
                    </OperationalSubmitButton>
                  </form>
                </AdminFormSection>
              ) : null}

              {canDeleteOrder(selectedOrder) ? (
                <AdminFormSection
                  title="Move to trash"
                  description="Soft-delete this order. It can be restored from the Trash queue."
                >
                  <form action={deleteAdminOrderAction} className="grid gap-3 md:max-w-xl">
                    <input type="hidden" name="order_id" value={selectedOrderId} />
                    {formContextFields()}
                    <label className="grid gap-2 text-sm text-[var(--platform-text-secondary)]">
                      Deletion reason
                      <textarea
                        name="delete_reason"
                        required
                        rows={2}
                        placeholder="Why is this order being moved to trash?"
                        className="rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 py-2 text-[var(--platform-text-primary)] outline-none placeholder:text-[var(--platform-text-muted)]"
                      />
                    </label>
                    <OperationalSubmitButton
                      pendingLabel="Deleting..."
                      confirmMessage={`Move order ${publicOrderLabel(selectedOrder)} to trash?`}
                      className="h-10 w-fit rounded-lg border border-rose-700 bg-rose-950/40 px-4 text-sm font-semibold text-rose-100"
                    >
                      Move to trash
                    </OperationalSubmitButton>
                  </form>
                </AdminFormSection>
              ) : null}

              {canPermanentlyDeleteOrder(selectedOrder) ? (
                <AdminFormSection
                  title="Permanent delete"
                  description="Permanently remove this order from trash. This cannot be undone."
                >
                  <form action={permanentDeleteAdminOrderAction} className="grid gap-3 md:max-w-xl">
                    <input type="hidden" name="order_id" value={selectedOrderId} />
                    {formContextFields()}
                    <label className="grid gap-2 text-sm text-[var(--platform-text-secondary)]">
                      Deletion reason
                      <textarea
                        name="delete_reason"
                        required
                        rows={2}
                        placeholder="Why is this order being permanently deleted?"
                        className="rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface)] px-3 py-2 text-[var(--platform-text-primary)] outline-none placeholder:text-[var(--platform-text-muted)]"
                      />
                    </label>
                    <OperationalSubmitButton
                      pendingLabel="Deleting..."
                      confirmMessage={`Permanently delete order ${publicOrderLabel(selectedOrder)}? This cannot be undone.`}
                      className="h-10 w-fit rounded-lg border border-rose-700 bg-rose-950/40 px-4 text-sm font-semibold text-rose-100"
                    >
                      Permanent delete
                    </OperationalSubmitButton>
                  </form>
                </AdminFormSection>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-6 text-sm text-[var(--platform-text-muted)]">
              Select an order from the list to review customer details and take action.
            </div>
          )}
        </section>
      </div>
        )}
      </AdminOrdersOptimisticProvider>
    </div>
  );
}
