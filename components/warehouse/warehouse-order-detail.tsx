import Link from "next/link";
import Image from "next/image";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { fulfillmentStepLabel } from "@/lib/warehouse/operational-labels";
import {
  ORDER_PROGRESS_STEPS,
  formatGuestAddress,
  formatOrderDate,
  orderMetadata,
  assignedPicker,
  paymentStatusLabel,
  progressStepIndex,
  shippingMethod,
  type WarehouseOrderRow
} from "@/lib/warehouse/order-helpers";

const actionButtonClass = "inline-flex min-h-9 items-center rounded-md border border-[var(--platform-border)] px-3 text-xs font-semibold text-[var(--platform-text-primary)] transition hover:border-[var(--platform-accent)]/40";

type OrderItemRow = {
  id: string;
  productName: string;
  productSlug: string;
  sku: string;
  quantity: number;
  image: string | null;
  warehouseLocation: string;
  availableStock: number;
};

type TimelineRow = {
  at: string;
  label: string;
  detail: string;
};

type WarehouseOrderDetailProps = {
  order: Record<string, unknown>;
  orderRow: WarehouseOrderRow;
  items: OrderItemRow[];
  timeline: TimelineRow[];
  advanceAction: (formData: FormData) => Promise<void>;
  dispatchAction: (formData: FormData) => Promise<void>;
};

function AdvanceButton({
  order,
  nextStatus,
  label,
  advanceAction
}: {
  order: WarehouseOrderRow;
  nextStatus: string;
  label: string;
  advanceAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={advanceAction}>
      <input name="order_id" type="hidden" value={order.orderId} />
      <input name="status" type="hidden" value={order.orderStatus} />
      <input name="payment_status" type="hidden" value={order.paymentStatusRaw} />
      <input name="fulfillment_status" type="hidden" value={nextStatus} />
      <input name="warehouse_code" type="hidden" value={order.warehouseCode} />
      <input name="note" type="hidden" value={`${label} from order detail`} />
      <input name="change_summary" type="hidden" value={`${label} ${order.orderNumber}`} />
      <OperationalSubmitButton pendingLabel="Saving" className={actionButtonClass}>
        {label}
      </OperationalSubmitButton>
    </form>
  );
}

export function WarehouseOrderDetail({
  order,
  orderRow,
  items,
  timeline,
  advanceAction,
  dispatchAction
}: WarehouseOrderDetailProps) {
  const metadata = orderMetadata(order);
  const customerName = String(metadata.customer_name ?? metadata.guest_name ?? order.customer_email ?? "—");
  const address = formatGuestAddress(metadata);
  const currentIndex = progressStepIndex(orderRow.fulfillmentStatus);
  const step = orderRow.fulfillmentStatus;

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--platform-text-primary)]">{orderRow.orderNumber}</h2>
          <p className="mt-1 text-sm text-[var(--platform-text-secondary)]">
            {fulfillmentStepLabel(step)} · {paymentStatusLabel(orderRow.paymentStatusRaw)} · Priority {orderRow.priority}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/warehouse/orders" className={actionButtonClass}>Back to queue</Link>
          {step === "pending" ? (
            <AdvanceButton order={orderRow} nextStatus="processing" label="Reserve Stock" advanceAction={advanceAction} />
          ) : null}
          {step === "pending" || step === "processing" ? (
            <Link href="/warehouse/picking" className={actionButtonClass}>Start Picking</Link>
          ) : null}
          {step === "processing" ? (
            <AdvanceButton order={orderRow} nextStatus="picked" label="Picking Complete" advanceAction={advanceAction} />
          ) : null}
          {step === "picked" ? (
            <Link href="/warehouse/packing" className={actionButtonClass}>Start Packing</Link>
          ) : null}
          {step === "packed" ? (
            <AdvanceButton order={orderRow} nextStatus="ready_to_dispatch" label="Ready for Dispatch" advanceAction={advanceAction} />
          ) : null}
          {step === "ready_to_dispatch" ? (
            <form action={dispatchAction}>
              <input name="order_id" type="hidden" value={orderRow.orderId} />
              <input name="warehouse_code" type="hidden" value={orderRow.warehouseCode} />
              <OperationalSubmitButton pendingLabel="Dispatching" className={`${actionButtonClass} border-emerald-400/30 text-emerald-200`}>
                Dispatch
              </OperationalSubmitButton>
            </form>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-[var(--platform-text-primary)]">Progress</h3>
        <ol className="grid gap-2 sm:grid-cols-6">
          {ORDER_PROGRESS_STEPS.map((progressStep, index) => (
            <li
              key={progressStep.key}
              className={`rounded-md border px-3 py-2 text-center text-xs font-semibold ${
                index <= currentIndex
                  ? "border-[var(--platform-accent)]/40 bg-[var(--platform-accent)]/10 text-[var(--platform-text-primary)]"
                  : "border-[var(--platform-border)] text-[var(--platform-text-muted)]"
              }`}
            >
              {progressStep.label}
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-3 rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--platform-text-primary)]">Customer</h3>
          <p className="mt-2 text-sm text-[var(--platform-text-secondary)]">{customerName}</p>
          <p className="text-sm text-[var(--platform-text-secondary)]">{String(order.customer_email ?? "—")}</p>
          <p className="text-sm text-[var(--platform-text-secondary)]">{String(metadata.customer_phone ?? "—")}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[var(--platform-text-primary)]">Shipping</h3>
          <p className="mt-2 text-sm text-[var(--platform-text-secondary)]">{shippingMethod(order)}</p>
          <p className="text-sm text-[var(--platform-text-secondary)]">Assigned: {assignedPicker(order)}</p>
          <p className="text-sm text-[var(--platform-text-secondary)]">Created: {formatOrderDate(order.created_at)}</p>
          {address ? <p className="mt-2 whitespace-pre-line text-sm text-[var(--platform-text-muted)]">{address}</p> : null}
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-[var(--platform-text-primary)]">Products</h3>
        <div className="overflow-x-auto rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
          <table className="min-w-[960px] w-full border-collapse text-left text-sm">
            <thead className="border-b border-[var(--platform-border)] text-[11px] uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">
              <tr>
                <th className="px-3 py-3">Image</th>
                <th className="px-3 py-3">Product</th>
                <th className="px-3 py-3">SKU</th>
                <th className="px-3 py-3">Qty</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--platform-border)]">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3">
                    <div className="grid size-10 place-items-center overflow-hidden rounded border border-[var(--platform-border)] bg-[var(--platform-surface)]">
                      {item.image ? (
                        <Image src={item.image} alt="" width={40} height={40} className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-xs text-[var(--platform-text-muted)]">{item.productName.slice(0, 1)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--platform-text-primary)]">{item.productName}</td>
                  <td className="px-3 py-3 font-mono text-xs">{item.sku}</td>
                  <td className="px-3 py-3">{String(item.quantity)}</td>
                  <td className="px-3 py-3">{item.warehouseLocation}</td>
                  <td className="px-3 py-3">{String(item.availableStock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3">
        <h3 className="text-sm font-semibold text-[var(--platform-text-primary)]">Timeline</h3>
        {timeline.length ? (
          <ol className="grid gap-2">
            {timeline.map((event, index) => (
              <li key={`${event.at}-${index}`} className="rounded-md border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3">
                <p className="text-sm font-medium text-[var(--platform-text-primary)]">{event.label}</p>
                <p className="mt-1 text-xs text-[var(--platform-text-muted)]">{event.detail}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-[var(--platform-text-muted)]">No activity recorded for this order yet.</p>
        )}
      </section>
    </div>
  );
}
