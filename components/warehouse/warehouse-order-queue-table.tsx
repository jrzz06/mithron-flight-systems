"use client";

import Link from "next/link";
import { useOptimistic } from "react";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { fulfillmentStepLabel } from "@/lib/warehouse/operational-labels";
import type { WarehouseOrderRow } from "@/lib/warehouse/order-helpers";

const actionButtonClass = "platform-btn-secondary platform-btn-sm";
const primaryActionClass = "platform-btn-primary platform-btn-sm";

type OptimisticUpdate = {
  orderId: string;
  nextStatus: string;
};

type WarehouseOrderQueueTableProps = {
  rows: WarehouseOrderRow[];
  advanceAction: (formData: FormData) => Promise<void>;
  dispatchAction: (formData: FormData) => Promise<void>;
};

function AdvanceButton({
  order,
  nextStatus,
  label,
  advanceAction,
  onAdvance
}: {
  order: WarehouseOrderRow;
  nextStatus: string;
  label: string;
  advanceAction: (formData: FormData) => Promise<void>;
  onAdvance: (update: OptimisticUpdate) => void;
}) {
  return (
    <form
      action={async (formData) => {
        onAdvance({ orderId: order.orderId, nextStatus });
        await advanceAction(formData);
      }}
      className="contents"
    >
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
  dispatchAction,
  onAdvance
}: {
  order: WarehouseOrderRow;
  dispatchAction: (formData: FormData) => Promise<void>;
  onAdvance: (update: OptimisticUpdate) => void;
}) {
  return (
    <form
      action={async (formData) => {
        onAdvance({ orderId: order.orderId, nextStatus: "shipped" });
        await dispatchAction(formData);
      }}
      className="contents"
    >
      <input name="order_id" type="hidden" value={order.orderId} />
      <input name="warehouse_code" type="hidden" value={order.warehouseCode} />
      <OperationalSubmitButton pendingLabel="Dispatching" className={primaryActionClass}>
        Dispatch
      </OperationalSubmitButton>
    </form>
  );
}

function OrderRowCard({
  order,
  step,
  advanceAction,
  dispatchAction,
  onAdvance
}: {
  order: WarehouseOrderRow;
  step: string;
  advanceAction: (formData: FormData) => Promise<void>;
  dispatchAction: (formData: FormData) => Promise<void>;
  onAdvance: (update: OptimisticUpdate) => void;
}) {
  return (
    <article className="rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[var(--platform-text-primary)]">{order.orderNumber}</p>
          <p className="mt-1 text-xs text-[var(--platform-text-muted)]">{order.customerEmail}</p>
        </div>
        <span className="rounded-md bg-[var(--platform-accent-soft)] px-2 py-1 text-xs font-medium text-[var(--platform-accent)]">
          {fulfillmentStepLabel(step)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--platform-text-secondary)]">
        <div><dt className="text-[var(--platform-text-muted)]">Items</dt><dd>{String(order.itemCount)}</dd></div>
        <div><dt className="text-[var(--platform-text-muted)]">Payment</dt><dd>{order.paymentStatus}</dd></div>
        <div><dt className="text-[var(--platform-text-muted)]">Priority</dt><dd>{order.priority}</dd></div>
        <div><dt className="text-[var(--platform-text-muted)]">Est. dispatch</dt><dd>{order.estimatedDispatch}</dd></div>
      </dl>
      <div className="platform-action-group mt-4 flex flex-wrap gap-2">
        <Link href={`/warehouse/orders/${order.orderId}`} className={actionButtonClass}>
          View Order
        </Link>
        {step === "pending" ? (
          <AdvanceButton order={order} nextStatus="processing" label="Reserve Stock" advanceAction={advanceAction} onAdvance={onAdvance} />
        ) : null}
        {step === "pending" || step === "processing" ? (
          <Link href="/warehouse/picking" className={actionButtonClass}>Start Picking</Link>
        ) : null}
        {step === "processing" ? (
          <AdvanceButton order={order} nextStatus="picked" label="Picking Complete" advanceAction={advanceAction} onAdvance={onAdvance} />
        ) : null}
        {step === "picked" ? (
          <Link href="/warehouse/packing" className={actionButtonClass}>Start Packing</Link>
        ) : null}
        {step === "packed" ? (
          <AdvanceButton order={order} nextStatus="ready_to_dispatch" label="Ready for Dispatch" advanceAction={advanceAction} onAdvance={onAdvance} />
        ) : null}
        {step === "ready_to_dispatch" ? (
          <DispatchButton order={order} dispatchAction={dispatchAction} onAdvance={onAdvance} />
        ) : null}
      </div>
    </article>
  );
}

export function WarehouseOrderQueueTable({ rows, advanceAction, dispatchAction }: WarehouseOrderQueueTableProps) {
  const [optimisticRows, addOptimistic] = useOptimistic(rows, (state, update: OptimisticUpdate) =>
    state.map((row) =>
      row.orderId === update.orderId
        ? { ...row, fulfillmentStatus: update.nextStatus, currentStep: update.nextStatus }
        : row
    )
  );

  return (
    <div className="overflow-x-auto rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
      <div className="grid gap-3 p-3 md:hidden">
        {optimisticRows.length ? optimisticRows.map((order) => (
          <OrderRowCard
            key={order.orderId}
            order={order}
            step={order.fulfillmentStatus}
            advanceAction={advanceAction}
            dispatchAction={dispatchAction}
            onAdvance={addOptimistic}
          />
        )) : (
          <p className="px-2 py-8 text-center text-sm text-[var(--platform-text-muted)]">
            No orders are waiting for processing.
          </p>
        )}
      </div>

      <table data-order-management-table="orders" className="platform-table hidden min-w-[1400px] w-full border-collapse text-left text-sm md:table">
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
          {optimisticRows.length ? optimisticRows.map((order) => {
            const step = order.fulfillmentStatus;
            return (
              <tr key={order.orderId} className="transition-colors">
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
                      <AdvanceButton order={order} nextStatus="processing" label="Reserve Stock" advanceAction={advanceAction} onAdvance={addOptimistic} />
                    ) : null}
                    {step === "pending" || step === "processing" ? (
                      <Link href="/warehouse/picking" className={actionButtonClass}>Start Picking</Link>
                    ) : null}
                    {step === "processing" ? (
                      <AdvanceButton order={order} nextStatus="picked" label="Picking Complete" advanceAction={advanceAction} onAdvance={addOptimistic} />
                    ) : null}
                    {step === "picked" ? (
                      <Link href="/warehouse/packing" className={actionButtonClass}>Start Packing</Link>
                    ) : null}
                    {step === "packed" ? (
                      <AdvanceButton order={order} nextStatus="ready_to_dispatch" label="Ready for Dispatch" advanceAction={advanceAction} onAdvance={addOptimistic} />
                    ) : null}
                    {step === "ready_to_dispatch" ? (
                      <DispatchButton order={order} dispatchAction={dispatchAction} onAdvance={addOptimistic} />
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
