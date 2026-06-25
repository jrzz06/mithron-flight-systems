import Link from "next/link";
import { ControlShell } from "@/components/admin/control-shell";
import { WarehouseKpiStrip } from "@/components/warehouse/warehouse-kpi-strip";
import { fulfillmentStepLabel } from "@/lib/warehouse/operational-labels";
import { getWarehouseSnapshot } from "@/services/admin";

export const dynamic = "force-dynamic";

function text(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isToday(value: unknown) {
  const raw = text(value, "");
  if (!raw || raw === "—") return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date.getUTCFullYear() === now.getUTCFullYear()
    && date.getUTCMonth() === now.getUTCMonth()
    && date.getUTCDate() === now.getUTCDate();
}

function orderMetadata(order: Record<string, unknown>) {
  const metadata = order.metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : {};
}

function orderPriority(order: Record<string, unknown>) {
  const metadata = orderMetadata(order);
  const priority = text(metadata.priority, "");
  if (priority && priority !== "—") return priority;
  return "Standard";
}

function assignedEmployee(order: Record<string, unknown>) {
  const metadata = orderMetadata(order);
  return text(metadata.assigned_to ?? metadata.assigned_employee, "Unassigned");
}

export default async function WarehouseDashboardPage() {
  const snapshot = await getWarehouseSnapshot({ scope: "dashboard" });
  const ordersWaiting = snapshot.data.orders.filter((order) => text(order.fulfillment_status, "pending") === "pending");
  const currentlyPicking = snapshot.data.orders.filter((order) => text(order.fulfillment_status, "pending") === "processing");
  const readyToPack = snapshot.data.orders.filter((order) => text(order.fulfillment_status, "pending") === "picked");
  const readyToDispatch = snapshot.data.orders.filter((order) =>
    ["packed", "ready_to_dispatch"].includes(text(order.fulfillment_status, "pending"))
  );
  const completedToday = snapshot.data.orders.filter((order) =>
    ["shipped", "delivered"].includes(text(order.fulfillment_status, "pending")) && isToday(order.updated_at)
  );
  const lowStock = snapshot.data.inventory.filter((row) =>
    ["low_stock", "out_of_stock"].includes(text(row.stock_status, "available"))
  );

  const itemsByOrder = new Map<string, number>();
  for (const item of snapshot.data.orderItems) {
    const orderId = text(item.order_id, "");
    if (!orderId) continue;
    itemsByOrder.set(orderId, (itemsByOrder.get(orderId) ?? 0) + Number(item.quantity ?? 0));
  }

  const workQueue = snapshot.data.orders
    .filter((order) => {
      const step = text(order.fulfillment_status, "pending");
      return ["pending", "processing", "picked", "packed", "ready_to_dispatch"].includes(step);
    })
    .slice(0, 20);

  return (
    <ControlShell
      eyebrow=""
      title="Today's Operations"
      description="What needs attention right now — orders to process, stock to review, and packages ready to leave."
      actions={[
        { label: "Picking", href: "/warehouse/picking" },
        { label: "Packing", href: "/warehouse/packing" },
        { label: "Dispatch", href: "/warehouse/dispatch" }
      ]}
    >
      <section data-warehouse-operational-dashboard className="grid gap-6">
        <WarehouseKpiStrip
          tiles={[
            { label: "Orders Waiting", value: ordersWaiting.length, href: "/warehouse/orders?fulfillment_status=pending" },
            { label: "Currently Picking", value: currentlyPicking.length, href: "/warehouse/picking" },
            { label: "Ready to Pack", value: readyToPack.length, href: "/warehouse/packing" },
            { label: "Ready to Dispatch", value: readyToDispatch.length, href: "/warehouse/dispatch" },
            { label: "Completed Today", value: completedToday.length },
            { label: "Low Stock", value: lowStock.length, href: "/warehouse/inventory" }
          ]}
        />

        <section className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--platform-text-primary)]">Today&apos;s Work Queue</h2>
            <Link href="/warehouse/orders" className="text-xs font-medium text-[var(--platform-accent)] hover:underline">
              View all orders
            </Link>
          </div>
          <div className="overflow-x-auto rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
            <table className="min-w-[960px] w-full border-collapse text-left text-sm">
              <thead className="border-b border-[var(--platform-border)] text-[11px] uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Items</th>
                  <th className="px-4 py-3 font-semibold">Priority</th>
                  <th className="px-4 py-3 font-semibold">Current Step</th>
                  <th className="px-4 py-3 font-semibold">Assigned To</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--platform-border)] text-[var(--platform-text-secondary)]">
                {workQueue.length ? workQueue.map((order) => {
                  const orderId = text(order.id, "");
                  const orderNumber = text(order.order_number, orderId);
                  const step = text(order.fulfillment_status, "pending");
                  const actionHref = step === "pending" || step === "processing"
                    ? "/warehouse/picking"
                    : step === "picked"
                      ? "/warehouse/packing"
                      : "/warehouse/dispatch";
                  return (
                    <tr key={orderId}>
                      <td className="px-4 py-3 font-medium text-[var(--platform-text-primary)]">{orderNumber}</td>
                      <td className="px-4 py-3">{text(order.customer_email)}</td>
                      <td className="px-4 py-3">{String(itemsByOrder.get(orderId) ?? 0)}</td>
                      <td className="px-4 py-3">{orderPriority(order)}</td>
                      <td className="px-4 py-3">{fulfillmentStepLabel(step)}</td>
                      <td className="px-4 py-3">{assignedEmployee(order)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`${actionHref}?q=${encodeURIComponent(orderNumber)}`}
                          className="inline-flex min-h-8 items-center rounded-md border border-[var(--platform-border)] px-3 text-xs font-semibold text-[var(--platform-text-primary)] transition hover:border-[var(--platform-accent)]/40"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[var(--platform-text-muted)]">
                      No orders are waiting for processing.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-3">
          <h2 className="text-sm font-semibold text-[var(--platform-text-primary)]">Inventory Requiring Attention</h2>
          {lowStock.length ? (
            <div className="overflow-x-auto rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
              <table className="min-w-[720px] w-full border-collapse text-left text-sm">
                <thead className="border-b border-[var(--platform-border)] text-[11px] uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">SKU</th>
                    <th className="px-4 py-3 font-semibold">Available</th>
                    <th className="px-4 py-3 font-semibold">Reserved</th>
                    <th className="px-4 py-3 font-semibold">Reorder Point</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--platform-border)] text-[var(--platform-text-secondary)]">
                  {lowStock.slice(0, 10).map((row) => (
                    <tr key={`${text(row.product_slug)}-${text(row.sku)}`}>
                      <td className="px-4 py-3 font-medium text-[var(--platform-text-primary)]">{text(row.product_slug)}</td>
                      <td className="px-4 py-3">{text(row.sku)}</td>
                      <td className="px-4 py-3">{String(row.quantity ?? 0)}</td>
                      <td className="px-4 py-3">{String(row.reserved_quantity ?? 0)}</td>
                      <td className="px-4 py-3">{String(row.reorder_threshold ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-6 text-sm text-[var(--platform-text-muted)]">
              Inventory is fully stocked. No products currently require attention.
            </p>
          )}
        </section>
      </section>
    </ControlShell>
  );
}
