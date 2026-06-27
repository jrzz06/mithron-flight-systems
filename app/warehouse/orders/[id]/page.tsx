import { notFound, redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { Breadcrumb } from "@/components/platform/breadcrumb";
import { WarehouseOrderDetail } from "@/components/warehouse/warehouse-order-detail";
import { fulfillmentStepLabel } from "@/lib/warehouse/operational-labels";
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
import {
  advanceWarehouseOrderStepFormAction,
  dispatchWarehouseOrderFormAction
} from "../../actions";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function searchValue(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function feedbackPath(orderId: string, status: "success" | "error", message: string) {
  return `/warehouse/orders/${orderId}?operation_status=${status}&operation_message=${encodeURIComponent(message)}`;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "The order action failed.";
}

async function advanceOrderWithFeedback(formData: FormData) {
  "use server";
  const orderId = String(formData.get("order_id") ?? "");
  try {
    await advanceWarehouseOrderStepFormAction(formData);
  } catch (error) {
    redirect(feedbackPath(orderId, "error", messageFromError(error)));
  }
  redirect(feedbackPath(orderId, "success", "Order updated."));
}

async function dispatchOrderWithFeedback(formData: FormData) {
  "use server";
  const orderId = String(formData.get("order_id") ?? "");
  try {
    await dispatchWarehouseOrderFormAction(formData);
  } catch (error) {
    redirect(feedbackPath(orderId, "error", messageFromError(error)));
  }
  redirect(feedbackPath(orderId, "success", "Order dispatched."));
}

function firstImageFrom(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    return firstImageFrom(record.src ?? record.url ?? record.image);
  }
  return null;
}

export default async function WarehouseOrderDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const [snapshot, policy] = await Promise.all([
    getWarehouseSnapshot({ scope: "orders" }),
    getAdminSettingsPolicy()
  ]);
  const defaultWarehouseCode = policy.defaultWarehouseCode;
  const order = snapshot.data.orders.find((row) => String(row.id ?? "") === id);
  if (!order) notFound();

  const query = searchParams ? await searchParams : {};
  const operationStatus = searchValue(query, "operation_status");
  const operationMessage = searchValue(query, "operation_message");

  const itemsByOrder = snapshot.data.orderItems.filter((item) => String(item.order_id ?? "") === id);
  const stockBySku = new Map(
    snapshot.data.stock.map((row) => [`${String(row.product_slug ?? "")}:${String(row.sku ?? "")}`, row])
  );
  const productsBySlug = new Map(snapshot.data.products.map((product) => [String(product.slug ?? ""), product]));

  const metadata = order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
    ? order.metadata as Record<string, unknown>
    : {};
  const warehouseCode = String(metadata.assigned_warehouse_code ?? defaultWarehouseCode);

  const orderRow: WarehouseOrderRow = {
    orderId: id,
    orderNumber: String(order.order_number ?? id),
    customerEmail: String(order.customer_email ?? "—"),
    orderDate: formatOrderDate(order.created_at),
    itemCount: itemsByOrder.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
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

  const itemRows = itemsByOrder.map((item) => {
    const productSlug = String(item.product_slug ?? "");
    const sku = String(item.sku ?? "");
    const stock = stockBySku.get(`${productSlug}:${sku}`);
    const product = productsBySlug.get(productSlug);
    return {
      id: String(item.id ?? `${productSlug}-${sku}`),
      productName: String(item.product_name ?? product?.name ?? productSlug),
      productSlug,
      sku,
      quantity: Number(item.quantity ?? 0),
      image: firstImageFrom(product?.image) ?? firstImageFrom(product?.hero),
      warehouseLocation: String(stock?.warehouse_code ?? warehouseCode),
      availableStock: Number(stock?.available_quantity ?? stock?.quantity ?? 0)
    };
  });

  const orderTimeline = Array.isArray(order.timeline) ? order.timeline : [];
  const shipmentIds = snapshot.data.shipments
    .filter((shipment) => String(shipment.order_id ?? "") === id)
    .map((shipment) => String(shipment.id ?? ""));
  const shipmentTimeline = snapshot.data.shipmentTimeline
    .filter((event) => shipmentIds.includes(String(event.shipment_id ?? "")));

  const timeline = [
    ...orderTimeline.map((event) => {
      const record = event && typeof event === "object" && !Array.isArray(event) ? event as Record<string, unknown> : {};
      return {
        at: String(record.at ?? record.created_at ?? ""),
        label: fulfillmentStepLabel(String(record.status ?? record.event ?? "update")),
        detail: String(record.note ?? "Order updated"),
        sortKey: String(record.at ?? record.created_at ?? "")
      };
    }),
    ...shipmentTimeline.map((event) => ({
      at: String(event.created_at ?? ""),
      label: fulfillmentStepLabel(String(event.next_status ?? event.event_type ?? "shipment")),
      detail: String(event.notes ?? "Shipment updated"),
      sortKey: String(event.created_at ?? "")
    }))
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  return (
    <>
      <Breadcrumb items={[
        { label: "Orders", href: "/warehouse/orders" },
        { label: orderRow.orderNumber }
      ]} />
    <ControlShell
      eyebrow=""
      title={orderRow.orderNumber}
      description={`Order detail · ${fulfillmentStepLabel(orderRow.fulfillmentStatus)}`}
      actions={[
        { label: "Orders", href: "/warehouse/orders" },
        { label: "Picking", href: "/warehouse/picking" },
        { label: "Packing", href: "/warehouse/packing" },
        { label: "Dispatch", href: "/warehouse/dispatch" }
      ]}
    >
      <OperationalFeedback
        status={operationStatus}
        message={operationMessage}
        context="Order"
        idle="Order action results appear here."
      />
      <WarehouseOrderDetail
        order={order}
        orderRow={orderRow}
        items={itemRows}
        timeline={timeline}
        advanceAction={advanceOrderWithFeedback}
        dispatchAction={dispatchOrderWithFeedback}
      />
    </ControlShell>
    </>
  );
}
