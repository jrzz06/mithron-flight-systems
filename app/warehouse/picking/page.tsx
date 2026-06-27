import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { WarehousePickingTable, type PickingLineRow } from "@/components/warehouse/warehouse-picking-table";
import { WarehousePickingBarcodePanel } from "@/components/warehouse/warehouse-picking-barcode-panel";
import { WarehouseOpsLiveSync } from "@/components/warehouse/warehouse-ops-live-sync";
import { getWarehouseSnapshot } from "@/services/admin";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";
import { getCurrentAuthContext } from "@/services/auth";
import { filterOrdersForWarehouseScope, filterStockForWarehouseScope, resolveWarehouseScope } from "@/services/warehouse-scope";
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

function orderMetadata(order: Record<string, unknown>) {
  const metadata = order.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
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
  const [snapshot, policy, auth] = await Promise.all([
    getWarehouseSnapshot({ scope: "picking" }),
    getAdminSettingsPolicy(),
    getCurrentAuthContext()
  ]);
  const scope = await resolveWarehouseScope({ userId: auth.userId, role: auth.role });
  const defaultWarehouseCode = policy.defaultWarehouseCode;
  const params = searchParams ? await searchParams : {};
  const operationStatus = value(params, "operation_status");
  const operationMessage = value(params, "operation_message");
  const stockBySku = new Map(
    filterStockForWarehouseScope(snapshot.data.stock, scope).map((row) => [`${text(row.product_slug, "")}:${text(row.sku, "")}`, row])
  );
  const itemsByOrder = new Map<string, Array<Record<string, unknown>>>();
  for (const item of snapshot.data.orderItems) {
    const orderId = text(item.order_id, "");
    if (!orderId) continue;
    itemsByOrder.set(orderId, [...(itemsByOrder.get(orderId) ?? []), item]);
  }
  const queue = filterOrdersForWarehouseScope(snapshot.data.orders, scope, defaultWarehouseCode).filter((order) => {
    const fulfillment = text(order.fulfillment_status, "pending");
    if (!["pending", "processing"].includes(fulfillment)) return false;
    const payment = text(order.payment_status, "not_required");
    const status = text(order.status, "");
    return payment !== "requires_payment" && !["draft", "cancelled", "refunded"].includes(status);
  });

  const rows: PickingLineRow[] = queue.flatMap((order) => {
    const orderId = text(order.id, "");
    const orderItems = itemsByOrder.get(orderId) ?? [{}];
    const assignedWarehouse = text(orderMetadata(order).assigned_warehouse_code, defaultWarehouseCode);
    const status = text(order.fulfillment_status, "pending");
    return orderItems.map((item, index) => {
      const sku = text(item.sku, "sku");
      const productSlug = text(item.product_slug, "product");
      const stock = stockBySku.get(`${productSlug}:${sku}`);
      return {
        orderId,
        orderNumber: text(order.order_number, orderId),
        status,
        orderStatus: text(order.status, "assigned"),
        paymentStatus: text(order.payment_status, "not_required"),
        sku,
        productName: text(item.product_name, productSlug),
        productSlug,
        quantity: Number(item.quantity ?? 0),
        warehouseCode: text(stock?.warehouse_code, assignedWarehouse),
        lineIndex: index,
        lineCount: orderItems.length
      };
    });
  });

  const scanTargets = rows.map((row) => ({
    orderId: row.orderId,
    orderNumber: row.orderNumber,
    sku: row.sku,
    productSlug: row.productSlug,
    warehouseCode: row.warehouseCode
  }));

  return (
    <ControlShell
      eyebrow="Picking"
      title="Pick orders"
      description={snapshot.blockedReason ?? "Collect items for orders in the picking queue."}
      actions={[
        { label: "Orders", href: "/warehouse/orders" },
        { label: "Packing", href: "/warehouse/packing" }
      ]}
    >
      <WarehouseOpsLiveSync enabled={policy.realtimeUpdatesEnabled} />
      <section data-picking-queue data-barcode-ready className="grid gap-4">
        <WarehousePickingBarcodePanel targets={scanTargets} />
        <OperationalFeedback status={operationStatus} message={operationMessage} context="Picking" idle="Picking updates and validation errors appear here." />
        <WarehousePickingTable rows={rows} pickAction={updatePickingStatus} />
      </section>
    </ControlShell>
  );
}
