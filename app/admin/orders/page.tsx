import { redirect } from "next/navigation";
import { AdminOrdersWorkspace } from "@/components/admin/admin-orders-workspace-loader";
import { OrdersLiveSync } from "@/components/admin/orders-live-sync";
import { ModulePanel } from "@/components/admin/module-panel";
import { matchesAdminOrderQueue, type AdminOrderQueue } from "@/lib/orders/lifecycle";
import {
  archiveAdminOrderFormAction,
  assignOrderToWarehouseFormAction,
  cancelAdminOrderFormAction,
  confirmPaidOrderFormAction,
  createAdminManualOrderFormAction,
  deleteAdminOrderFormAction,
  permanentDeleteAdminOrderFormAction,
  rejectAdminOrderFormAction,
  restoreAdminOrderFormAction
} from "@/app/admin/orders/actions";
import { createShipmentFormAction, updateWarehouseOrderLifecycleFormAction } from "@/app/warehouse/actions";
import { getWarehouseSnapshot } from "@/services/admin";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";
import { listActiveWarehouses } from "@/services/warehouses";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type AdminRow = Record<string, unknown>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function orderActionMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function redirectWithOrderFeedback(
  orderKey: string,
  status: "success" | "error",
  message: string,
  queue: string,
  query: string
) {
  const params = new URLSearchParams();
  if (orderKey) params.set("order", orderKey);
  if (queue) params.set("queue", queue);
  if (query) params.set("q", query);
  params.set("order_status", status);
  params.set("order_message", message);
  redirect(`/admin/orders?${params.toString()}`);
}

async function updateAdminOrderLifecycleAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("order_id") ?? "").trim();
  const queue = String(formData.get("queue") ?? "review");
  const query = String(formData.get("q") ?? "");
  try {
    await updateWarehouseOrderLifecycleFormAction(formData);
  } catch (error) {
    redirectWithOrderFeedback(orderId, "error", orderActionMessage(error).slice(0, 240), queue, query);
  }
  redirectWithOrderFeedback(orderId, "success", "Fulfillment status updated.", queue, query);
}

async function assignAdminWarehouseAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("order_id") ?? "").trim();
  const queue = String(formData.get("queue") ?? "review");
  const query = String(formData.get("q") ?? "");
  try {
    await assignOrderToWarehouseFormAction(formData);
  } catch (error) {
    redirectWithOrderFeedback(orderId, "error", orderActionMessage(error).slice(0, 240), queue, query);
  }
  redirectWithOrderFeedback(orderId, "success", "Order assigned to warehouse.", queue, query);
}

async function rejectAdminOrderAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("order_id") ?? "").trim();
  const queue = String(formData.get("queue") ?? "review");
  const query = String(formData.get("q") ?? "");
  try {
    await rejectAdminOrderFormAction(formData);
  } catch (error) {
    redirectWithOrderFeedback(orderId, "error", orderActionMessage(error).slice(0, 240), queue, query);
  }
  redirectWithOrderFeedback(orderId, "success", "Order rejected.", queue, query);
}

async function cancelAdminOrderAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("order_id") ?? "").trim();
  const queue = String(formData.get("queue") ?? "review");
  const query = String(formData.get("q") ?? "");
  try {
    await cancelAdminOrderFormAction(formData);
  } catch (error) {
    redirectWithOrderFeedback(orderId, "error", orderActionMessage(error).slice(0, 240), queue, query);
  }
  redirectWithOrderFeedback(orderId, "success", "Order cancelled.", queue, query);
}

async function deleteAdminOrderAction(formData: FormData) {
  "use server";
  const queue = String(formData.get("queue") ?? "review");
  const query = String(formData.get("q") ?? "");
  try {
    await deleteAdminOrderFormAction(formData);
  } catch (error) {
    redirectWithOrderFeedback("", "error", orderActionMessage(error).slice(0, 240), queue, query);
  }
  const params = new URLSearchParams();
  if (queue) params.set("queue", queue);
  if (query) params.set("q", query);
  params.set("order_status", "success");
  params.set("order_message", "Order moved to trash.");
  redirect(`/admin/orders?${params.toString()}`);
}

async function archiveAdminOrderAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("order_id") ?? "").trim();
  const queue = String(formData.get("queue") ?? "active");
  const query = String(formData.get("q") ?? "");
  try {
    await archiveAdminOrderFormAction(formData);
  } catch (error) {
    redirectWithOrderFeedback(orderId, "error", orderActionMessage(error).slice(0, 240), queue, query);
  }
  redirectWithOrderFeedback(orderId, "success", "Order archived.", queue, query);
}

async function restoreAdminOrderAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("order_id") ?? "").trim();
  const queue = String(formData.get("queue") ?? "active");
  const query = String(formData.get("q") ?? "");
  try {
    await restoreAdminOrderFormAction(formData);
  } catch (error) {
    redirectWithOrderFeedback(orderId, "error", orderActionMessage(error).slice(0, 240), queue, query);
  }
  redirectWithOrderFeedback(orderId, "success", "Order restored.", queue, query);
}

async function permanentDeleteAdminOrderAction(formData: FormData) {
  "use server";
  const queue = String(formData.get("queue") ?? "trash");
  const query = String(formData.get("q") ?? "");
  try {
    await permanentDeleteAdminOrderFormAction(formData);
  } catch (error) {
    redirectWithOrderFeedback("", "error", orderActionMessage(error).slice(0, 240), queue, query);
  }
  const params = new URLSearchParams();
  if (queue) params.set("queue", queue);
  if (query) params.set("q", query);
  params.set("order_status", "success");
  params.set("order_message", "Order permanently deleted.");
  redirect(`/admin/orders?${params.toString()}`);
}

async function createAdminManualOrderAction(formData: FormData) {
  "use server";
  try {
    await createAdminManualOrderFormAction(formData);
  } catch (error) {
    const message = orderActionMessage(error).slice(0, 240);
    const params = new URLSearchParams({
      queue: "confirmed",
      order_status: "error",
      order_message: message
    });
    redirect(`/admin/orders?${params.toString()}`);
  }
}

async function confirmAdminOrderAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("order_id") ?? "").trim();
  const queue = String(formData.get("queue") ?? "review");
  const query = String(formData.get("q") ?? "");
  try {
    await confirmPaidOrderFormAction(formData);
  } catch (error) {
    redirectWithOrderFeedback(orderId, "error", orderActionMessage(error).slice(0, 240), queue, query);
  }
  redirectWithOrderFeedback(orderId, "success", "Order updated successfully.", queue, query);
}

async function confirmAdminWarehouseHandoffAction(formData: FormData) {
  "use server";
  const orderId = String(formData.get("order_id") ?? "").trim();
  const queue = String(formData.get("queue") ?? "review");
  const query = String(formData.get("q") ?? "");
  try {
    await createShipmentFormAction(formData);
  } catch (error) {
    redirectWithOrderFeedback(orderId, "error", orderActionMessage(error).slice(0, 240), queue, query);
  }
  redirectWithOrderFeedback(orderId, "success", "Shipment handoff created.", queue, query);
}

function countNeedsAction(orders: AdminRow[]) {
  return orders.filter((order) => matchesAdminOrderQueue(order, "pending_verification")).length;
}

function resolveQueue(queue: string): AdminOrderQueue {
  const legacyMap: Record<string, AdminOrderQueue> = {
    review: "pending_verification",
    confirmed: "verified",
    fulfillment: "warehouse"
  };
  const normalized = legacyMap[queue] ?? queue;
  const allowed: AdminOrderQueue[] = [
    "active",
    "pending_verification",
    "verified",
    "warehouse",
    "completed",
    "cancelled",
    "archived",
    "trash",
    "all"
  ];
  return allowed.includes(normalized as AdminOrderQueue) ? normalized as AdminOrderQueue : "active";
}

export default async function AdminOrdersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [snapshot, warehouses, policy] = await Promise.all([
    getWarehouseSnapshot({ scope: "orders", ordersFilter: "all" }),
    listActiveWarehouses(),
    getAdminSettingsPolicy()
  ]);
  const params = searchParams ? await searchParams : {};
  const queue = resolveQueue(searchValue(params, "queue") || "active");
  const selectedKey = searchValue(params, "order");
  const orderStatus = searchValue(params, "order_status");
  const orderMessage = searchValue(params, "order_message");
  const query = searchValue(params, "q").toLowerCase();

  const queueOrders = snapshot.data.orders.filter((order) => matchesAdminOrderQueue(order, queue));
  const selectedOrder = queueOrders.find(
    (order) => text(order.order_number) === selectedKey || text(order.id) === selectedKey
  ) ?? snapshot.data.orders.find(
    (order) => text(order.order_number) === selectedKey || text(order.id) === selectedKey
  ) ?? null;
  const selectedOrderId = selectedOrder ? text(selectedOrder.id) : "";
  const selectedOrderKey = selectedOrder ? text(selectedOrder.order_number) || selectedOrderId : selectedKey;

  const needsActionCount = countNeedsAction(snapshot.data.orders);

  return (
    <ModulePanel
      eyebrow="Order operations"
      title="Orders"
      description="Review, verify, fulfill, and manage orders at speed."
      status={snapshot.status}
      metrics={[
        { label: "Needs action", value: String(needsActionCount), status: needsActionCount ? "warning" : "clear" },
        { label: "In view", value: String(queueOrders.length) }
      ]}
    >
      <OrdersLiveSync enabled={policy.realtimeUpdatesEnabled} />
      <AdminOrdersWorkspace
        orders={snapshot.data.orders}
        orderItems={snapshot.data.orderItems}
        stock={snapshot.data.stock}
        shipments={snapshot.data.shipments}
        products={snapshot.data.products}
        warehouses={warehouses}
        defaultWarehouseCode={policy.defaultWarehouseCode}
        selectedOrder={selectedOrder}
        selectedOrderId={selectedOrderId}
        selectedOrderKey={selectedOrderKey}
        queue={queue}
        query={query}
        orderStatus={orderStatus}
        orderMessage={orderMessage}
        snapshotStatus={snapshot.status}
        blockedReason={snapshot.blockedReason}
        createAdminManualOrderAction={createAdminManualOrderAction}
        confirmAdminOrderAction={confirmAdminOrderAction}
        rejectAdminOrderAction={rejectAdminOrderAction}
        cancelAdminOrderAction={cancelAdminOrderAction}
        deleteAdminOrderAction={deleteAdminOrderAction}
        archiveAdminOrderAction={archiveAdminOrderAction}
        restoreAdminOrderAction={restoreAdminOrderAction}
        permanentDeleteAdminOrderAction={permanentDeleteAdminOrderAction}
        assignAdminWarehouseAction={assignAdminWarehouseAction}
        updateAdminOrderLifecycleAction={updateAdminOrderLifecycleAction}
        confirmAdminWarehouseHandoffAction={confirmAdminWarehouseHandoffAction}
      />
    </ModulePanel>
  );
}
