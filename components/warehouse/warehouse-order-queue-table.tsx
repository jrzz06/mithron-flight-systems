import Link from "next/link";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { fulfillmentStepLabel } from "@/lib/warehouse/operational-labels";
import type { WarehouseOrderRow } from "@/lib/warehouse/order-helpers";

const actionButtonClass = "platform-btn-secondary platform-btn-sm";
const primaryActionClass = "platform-btn-primary platform-btn-sm";

type WarehouseOrderQueueTableProps = {
  rows: WarehouseOrderRow[];
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
    <form action={advanceAction} className="contents">
      <input name="order_id" type="hidden" value={order.orderId} />
      <input name="status" type="hidden" value={order.orderStatus} />
      <input name="payment_status" type="hidden" value={order.paymentStatusRaw} />
      <input name="fulfillment_status" type="hidden" value={nextStatus} />
      <input name="warehouse_code" type="hidden" value={order.warehouseCode} />
      <input name="note" type="hidden" value={`${label} from order queue`} />
      <input name="change_summary" type="hidden" value={`${label} ${order.orderNumber}`} />
      <OperationalSubmitButton pendingLabel="Saving" className={actionButtonClass}>
        {label}
      </OperationalSubmitButton>
    </form>
  );
}

function DispatchButton({
  order,
  dispatchAction
}: {
  order: WarehouseOrderRow;
  dispatchAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={dispatchAction} className="contents">
      <input name="order_id" type="hidden" value={order.orderId} />
      <input name="warehouse_code" type="hidden" value={order.warehouseCode} />
      <OperationalSubmitButton pendingLabel="Dispatching" className={primaryActionClass}>
        Dispatch
      </OperationalSubmitButton>
    </form>
  );
}

export function WarehouseOrderQueueTable({ rows, advanceAction, dispatchAction }: WarehouseOrderQueueTableProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
      <table data-order-management-table="orders" className="min-w-[1400px] w-full border-collapse text-left text-sm">
        <thead className="border-b border-[var(--platform-border)] text-[11px] uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">
          <tr>
            <th className="px-3 py-3 font-semibold">Order</th>
            <th className="px-3 py-3 font-semibold">Customer</th>
            <th className="px-3 py-3 font-semibold">Order Date</th>
            <th className="px-3 py-3 font-semibold">Items</th>
            <th className="px-3 py-3 font-semibold">Priority</th>
            <th className="px-3 py-3 font-semibold">Shipping</th>
            <th className="px-3 py-3 font-semibold">Payment</th>
            <th className="px-3 py-3 font-semibold">Current Status</th>
            <th className="px-3 py-3 font-semibold">Assigned Picker</th>
            <th className="px-3 py-3 font-semibold">Est. Dispatch</th>
            <th className="px-3 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--platform-border)] text-[var(--platform-text-secondary)]">
          {rows.length ? rows.map((order) => {
            const step = order.fulfillmentStatus;
            return (
              <tr key={order.orderId}>
                <td className="px-3 py-3 font-medium text-[var(--platform-text-primary)]">{order.orderNumber}</td>
                <td className="px-3 py-3">{order.customerEmail}</td>
                <td className="px-3 py-3">{order.orderDate}</td>
                <td className="px-3 py-3">{String(order.itemCount)}</td>
                <td className="px-3 py-3">{order.priority}</td>
                <td className="px-3 py-3">{order.shippingMethod}</td>
                <td className="px-3 py-3">{order.paymentStatus}</td>
                <td className="px-3 py-3">{fulfillmentStepLabel(step)}</td>
                <td className="px-3 py-3">{order.assignedPicker}</td>
                <td className="px-3 py-3">{order.estimatedDispatch}</td>
                <td className="px-3 py-3">
                  <div className="platform-action-group min-w-[320px]">
                    <Link href={`/warehouse/orders/${order.orderId}`} className={actionButtonClass}>
                      View Order
                    </Link>
                    {step === "pending" ? (
                      <AdvanceButton order={order} nextStatus="processing" label="Reserve Stock" advanceAction={advanceAction} />
                    ) : null}
                    {step === "pending" || step === "processing" ? (
                      <Link href="/warehouse/picking" className={actionButtonClass}>Start Picking</Link>
                    ) : null}
                    {step === "processing" ? (
                      <AdvanceButton order={order} nextStatus="picked" label="Picking Complete" advanceAction={advanceAction} />
                    ) : null}
                    {step === "picked" ? (
                      <Link href="/warehouse/packing" className={actionButtonClass}>Start Packing</Link>
                    ) : null}
                    {step === "packed" ? (
                      <AdvanceButton order={order} nextStatus="ready_to_dispatch" label="Ready for Dispatch" advanceAction={advanceAction} />
                    ) : null}
                    {step === "ready_to_dispatch" ? (
                      <DispatchButton order={order} dispatchAction={dispatchAction} />
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          }) : (
            <tr>
              <td colSpan={11} className="px-4 py-10 text-center text-[var(--platform-text-muted)]">
                No orders are waiting for processing.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
