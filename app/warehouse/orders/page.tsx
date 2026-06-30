import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { WarehouseKpiStrip } from "@/components/warehouse/warehouse-kpi-strip";
import { WarehouseOrderQueueTable } from "@/components/warehouse/warehouse-order-queue-table";
import { ORDER_STEP_FILTER_OPTIONS } from "@/lib/warehouse/operational-labels";
import {
  assignedPicker,
  estimatedDispatchDate,
  formatOrderDate,
  orderPriority,
  paymentStatusLabel,
  shippingMethod,
  type WarehouseOrderRow
} from "@/lib/warehouse/order-helpers";
import { getWarehouseSnapshot } from "@/services/admin";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";
import { getCurrentAuthContext } from "@/services/auth";
import { filterOrdersForWarehouseScope, resolveWarehouseScope } from "@/services/warehouse-scope";
import {
  advanceWarehouseOrderStepFormAction,
  dispatchWarehouseOrderFormAction
} from "../actions";
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
  return error instanceof Error ? error.message : "The order action failed.";
}

async function advanceOrderWithFeedback(formData: FormData) {
  "use server";
  try {
    await advanceWarehouseOrderStepFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", messageFromError(error)));
  }
  redirect(feedbackPath("success", "Order updated."));
}

async function dispatchOrderWithFeedback(formData: FormData) {
  "use server";
  try {
    await dispatchWarehouseOrderFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", messageFromError(error)));
  }
  redirect(feedbackPath("success", "Order dispatched."));
}

function countByStep(orders: Array<Record<string, unknown>>, statuses: string[]) {
  return orders.filter((order) => statuses.includes(String(order.fulfillment_status ?? "pending"))).length;
}

function buildOrderRows(
  orders: Array<Record<string, unknown>>,
  itemsByOrder: Map<string, number>,
  defaultWarehouseCode: string
): WarehouseOrderRow[] {
  return orders.map((order) => {
    const orderId = String(order.id ?? "");
    const metadata = order.metadata;
    const warehouseCode = metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? String((metadata as Record<string, unknown>).assigned_warehouse_code ?? defaultWarehouseCode)
      : defaultWarehouseCode;
    return {
      orderId,
      orderNumber: String(order.order_number ?? orderId),
      customerEmail: String(order.customer_email ?? "—"),
      orderDate: formatOrderDate(order.created_at),
      itemCount: itemsByOrder.get(orderId) ?? 0,
      priority: orderPriority(order),
      shippingMethod: shippingMethod(order),
      paymentStatus: paymentStatusLabel(String(order.payment_status ?? "not_required")),
      currentStep: String(order.fulfillment_status ?? "pending"),
      assignedPicker: assignedPicker(order),
      estimatedDispatch: estimatedDispatchDate(order.created_at),
      fulfillmentStatus: String(order.fulfillment_status ?? "pending"),
      orderStatus: String(order.status ?? "assigned"),
      paymentStatusRaw: String(order.payment_status ?? "not_required"),
      warehouseCode,
      updatedAt: String(order.updated_at ?? "")
    };
  });
}

export default async function WarehouseOrdersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [snapshot, policy, auth] = await Promise.all([
    getWarehouseSnapshot({ scope: "orders" }),
    getAdminSettingsPolicy(),
    getCurrentAuthContext()
  ]);
  const scope = await resolveWarehouseScope({ userId: auth.userId, role: auth.role });
  const defaultWarehouseCode = policy.defaultWarehouseCode;
  const params = searchParams ? await searchParams : {};
  const fulfillmentFilter = searchValue(params, "fulfillment_status");
  const query = searchValue(params, "q").toLowerCase();
  const operationStatus = searchValue(params, "operation_status");
  const operationMessage = searchValue(params, "operation_message");

  const assignedOrders = filterOrdersForWarehouseScope(snapshot.data.orders, scope, defaultWarehouseCode);

  const itemsByOrder = new Map<string, number>();
  for (const item of snapshot.data.orderItems) {
    const orderId = String(item.order_id ?? "");
    if (!orderId) continue;
    itemsByOrder.set(orderId, (itemsByOrder.get(orderId) ?? 0) + Number(item.quantity ?? 0));
  }

  const filteredOrders = assignedOrders.filter((order) => {
    const fulfillmentStatus = String(order.fulfillment_status ?? "");
    const haystack = `${String(order.order_number ?? "")} ${String(order.customer_email ?? "")} ${snapshot.data.orderItems
      .filter((item) => String(item.order_id ?? "") === String(order.id ?? ""))
      .map((item) => String(item.sku ?? ""))
      .join(" ")}`.toLowerCase();
    return (!fulfillmentFilter || fulfillmentStatus === fulfillmentFilter) && (!query || haystack.includes(query));
  });

  const queueRows = buildOrderRows(filteredOrders, itemsByOrder, defaultWarehouseCode);

  return (
    <ControlShell
      eyebrow=""
      title="Orders"
      description="Execution queue for warehouse fulfillment. Advance each order with the action buttons — no manual data entry required."
      actions={[
        { label: "Picking", href: "/warehouse/picking" },
        { label: "Packing", href: "/warehouse/packing" },
        { label: "Dispatch", href: "/warehouse/dispatch" }
      ]}
    >
      <div className="grid gap-6">
        <OperationalFeedback
          status={operationStatus}
          message={operationMessage}
          context="Order"
          idle="Order updates and validation messages appear here."
        />

        <WarehouseKpiStrip
          tiles={[
            { label: "Waiting", value: countByStep(assignedOrders, ["pending"]), href: "/warehouse/orders?fulfillment_status=pending" },
            { label: "Picking", value: countByStep(assignedOrders, ["processing"]), href: "/warehouse/picking" },
            { label: "Packing", value: countByStep(assignedOrders, ["picked"]), href: "/warehouse/packing" },
            { label: "Ready for Dispatch", value: countByStep(assignedOrders, ["packed", "ready_to_dispatch"]) },
            { label: "Dispatched", value: countByStep(assignedOrders, ["shipped", "delivered"]) },
            { label: "Cancelled", value: countByStep(assignedOrders, ["cancelled"]) }
          ]}
        />

        <form className="grid gap-3 rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4 md:grid-cols-[1fr_220px_auto] md:items-end">
          <label className="grid gap-2 text-sm">
            <span className="text-[var(--platform-text-secondary)]">Search</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Order number, customer, or SKU"
              className="rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-[var(--platform-text-primary)] outline-none placeholder:text-[var(--platform-text-muted)]"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-[var(--platform-text-secondary)]">Current Step</span>
            <select
              name="fulfillment_status"
              defaultValue={fulfillmentFilter}
              className="rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-[var(--platform-text-primary)] outline-none"
            >
              {ORDER_STEP_FILTER_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button className="rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-text-primary)]">
            Filter
          </button>
        </form>

        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-[var(--platform-text-primary)]">Order Queue</h2>
          <WarehouseOrderQueueTable
            rows={queueRows}
            advanceAction={advanceOrderWithFeedback}
            dispatchAction={dispatchOrderWithFeedback}
          />
        </section>
      </div>
    </ControlShell>
  );
}
