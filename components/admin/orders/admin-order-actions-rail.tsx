"use client";

import Link from "next/link";
import { AdminOrderActionForm } from "@/components/admin/admin-orders-optimistic";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { ActionGroup } from "@/components/admin/orders/order-detail-primitives";
import {
  assignedWarehouseCode,
  canArchiveOrder,
  canCancelOrder,
  canDeleteOrder,
  canPermanentlyDeleteOrder,
  canRestoreOrder,
  LIFECYCLE_STATES,
  nextStepForOrder,
  numberText,
  publicOrderLabel,
  text,
  type AdminRow
} from "@/components/admin/orders/order-view-helpers";

type AdminOrderActionsRailProps = {
  order: AdminRow;
  orderId: string;
  queue: string;
  query: string;
  warehouses: Array<{ code: string; name: string }>;
  defaultWarehouseCode: string;
  firstItem: AdminRow | null;
  selectedShipments: AdminRow[];
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

function FormContextFields({ queue, query }: { queue: string; query: string }) {
  return (
    <>
      <input type="hidden" name="queue" value={queue} />
      {query ? <input type="hidden" name="q" value={query} /> : null}
    </>
  );
}

const inputClass =
  "h-10 w-full rounded-lg border border-[var(--platform-border-strong)] bg-[var(--platform-surface-muted)] px-3 text-sm";
const buttonClass = "h-10 w-full rounded-lg px-3 text-sm font-semibold";

export function AdminOrderActionsRail({
  order,
  orderId,
  queue,
  query,
  warehouses,
  defaultWarehouseCode,
  firstItem,
  selectedShipments,
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
}: AdminOrderActionsRailProps) {
  const nextStep = nextStepForOrder(order);
  const orderLabel = publicOrderLabel(order);
  const hasInvoice = Boolean(text(order.invoice_url));

  return (
    <aside
      data-admin-order-actions-rail
      className="grid gap-6 rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface)] p-5 shadow-sm max-xl:max-h-[42vh] max-xl:overflow-y-auto max-xl:rounded-none max-xl:border-x-0 max-xl:border-b-0 max-xl:shadow-none xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto"
    >
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">Actions</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--platform-text-secondary)]">{nextStep.description}</p>
      </div>

      <ActionGroup title="Fulfillment">
        {nextStep.action === "confirm" ? (
          <AdminOrderActionForm orderId={orderId} action={confirmAdminOrderAction} nextStatus="confirmed">
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="expected_updated_at" value={text(order.updated_at)} />
            <FormContextFields queue={queue} query={query} />
            <OperationalSubmitButton
              pendingLabel="Working..."
              className={`${buttonClass} border border-violet-600 bg-violet-600 text-white`}
            >
              {nextStep.button}
            </OperationalSubmitButton>
          </AdminOrderActionForm>
        ) : null}

        {nextStep.action === "assign" ? (
          <AdminOrderActionForm orderId={orderId} action={assignAdminWarehouseAction} nextStatus="assigned" className="grid gap-3">
            <input type="hidden" name="order_id" value={orderId} />
            <input type="hidden" name="expected_updated_at" value={text(order.updated_at)} />
            <FormContextFields queue={queue} query={query} />
            <select
              name="warehouse_code"
              defaultValue={assignedWarehouseCode(order, defaultWarehouseCode)}
              className={inputClass}
            >
              {warehouses.map((warehouse) => (
                <option key={warehouse.code} value={warehouse.code}>
                  {warehouse.name} ({warehouse.code})
                </option>
              ))}
            </select>
            <OperationalSubmitButton
              pendingLabel="Assigning..."
              className={`${buttonClass} border border-cyan-600 bg-cyan-600 text-white`}
            >
              {nextStep.button}
            </OperationalSubmitButton>
          </AdminOrderActionForm>
        ) : null}

        {["confirmed", "assigned", "processing", "packed", "dispatched"].includes(text(order.status)) ? (
          <form action={updateAdminOrderLifecycleAction} data-order-transition-feedback className="grid gap-3">
            <input type="hidden" name="order_id" value={orderId} />
            <FormContextFields queue={queue} query={query} />
            <input type="hidden" name="status" value={text(order.status, "confirmed")} />
            <input type="hidden" name="payment_status" value={text(order.payment_status, "not_required")} />
            <input type="hidden" name="change_summary" value={`Operator status update ${orderLabel}`} />
            <select name="fulfillment_status" defaultValue="" className={inputClass}>
              <option value="">Next fulfillment status</option>
              {LIFECYCLE_STATES.filter((state) => state !== text(order.fulfillment_status)).map((state) => (
                <option key={state} value={state}>
                  {state.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <input name="note" placeholder="Timeline note (optional)" className={inputClass} />
            <OperationalSubmitButton pendingLabel="Updating..." className={`platform-btn-primary ${buttonClass}`}>
              Update fulfillment
            </OperationalSubmitButton>
          </form>
        ) : null}
      </ActionGroup>

      <div className="border-t border-[var(--platform-border)] pt-5">
        <ActionGroup title="Shipment">
          {["assigned", "processing", "packed", "dispatched", "confirmed"].includes(text(order.status)) ? (
            <form action={confirmAdminWarehouseHandoffAction} data-shipment-actions data-confirm-warehouse-handoff className="grid gap-3">
              <input type="hidden" name="order_id" value={orderId} />
              <FormContextFields queue={queue} query={query} />
              <select
                name="warehouse_id"
                defaultValue={assignedWarehouseCode(order, defaultWarehouseCode)}
                className={inputClass}
              >
                {warehouses.map((warehouse) => (
                  <option key={warehouse.code} value={warehouse.code}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              <input type="hidden" name="order_item_id" value={text(firstItem?.id)} />
              <input type="hidden" name="shipment_product_id" value={text(firstItem?.product_slug)} />
              <input type="hidden" name="shipment_quantity" value={numberText(firstItem?.quantity ?? 1)} />
              <input type="hidden" name="change_summary" value={`Create shipment handoff ${orderLabel}`} />
              <input name="carrier_name" placeholder="Carrier" className={inputClass} />
              <input name="tracking_number" placeholder="Tracking number" className={inputClass} />
              {firstItem ? (
                <OperationalSubmitButton pendingLabel="Creating..." className={`platform-btn-primary ${buttonClass}`}>
                  Create shipment
                </OperationalSubmitButton>
              ) : (
                <p className="text-sm text-[var(--platform-text-muted)]">Add order items before creating a shipment.</p>
              )}
              {selectedShipments.length ? (
                <p className="text-sm text-[var(--platform-text-muted)]">
                  {selectedShipments.length} existing shipment(s)
                </p>
              ) : null}
            </form>
          ) : (
            <p className="text-sm text-[var(--platform-text-muted)]">Shipment actions appear when the order is ready for fulfillment.</p>
          )}
        </ActionGroup>
      </div>

      {hasInvoice ? (
        <div className="border-t border-[var(--platform-border)] pt-5">
          <ActionGroup title="Invoice">
            <Link
              href={`/admin/orders/invoice/${encodeURIComponent(orderId)}`}
              className={`inline-flex ${buttonClass} items-center justify-center border border-[var(--platform-border-strong)] font-medium text-violet-300 hover:bg-[var(--platform-surface-muted)]`}
            >
              View / print invoice
            </Link>
          </ActionGroup>
        </div>
      ) : null}

      {text(order.status) === "admin_review" ? (
        <div className="border-t border-[var(--platform-border)] pt-5">
          <ActionGroup title="Payment">
            <AdminOrderActionForm orderId={orderId} action={rejectAdminOrderAction} nextStatus="cancelled" className="grid gap-3">
              <input type="hidden" name="order_id" value={orderId} />
              <input type="hidden" name="expected_updated_at" value={text(order.updated_at)} />
              <FormContextFields queue={queue} query={query} />
              <input name="reject_reason" placeholder="Rejection note" className={inputClass} />
              <OperationalSubmitButton
                pendingLabel="Rejecting..."
                className={`${buttonClass} border border-rose-700 bg-rose-900/40 text-rose-100`}
              >
                Reject order
              </OperationalSubmitButton>
            </AdminOrderActionForm>
          </ActionGroup>
        </div>
      ) : null}

      <div className="border-t border-[var(--platform-border)] pt-5">
        <ActionGroup title="Danger Zone" danger>
          {canCancelOrder(order) && text(order.status) !== "admin_review" ? (
            <AdminOrderActionForm orderId={orderId} action={cancelAdminOrderAction} nextStatus="cancelled" className="grid gap-3">
              <input type="hidden" name="order_id" value={orderId} />
              <input type="hidden" name="expected_updated_at" value={text(order.updated_at)} />
              <FormContextFields queue={queue} query={query} />
              <input name="cancel_reason" required placeholder="Cancellation reason" className={inputClass} />
              <OperationalSubmitButton
                pendingLabel="Cancelling..."
                className={`${buttonClass} border border-rose-700 bg-rose-900/40 text-rose-100`}
              >
                Cancel order
              </OperationalSubmitButton>
            </AdminOrderActionForm>
          ) : null}

          {canArchiveOrder(order) ? (
            <form action={archiveAdminOrderAction} className="grid gap-3">
              <input type="hidden" name="order_id" value={orderId} />
              <FormContextFields queue={queue} query={query} />
              <textarea name="archive_reason" rows={2} placeholder="Archive note" className="rounded-lg border px-3 py-2 text-sm" />
              <OperationalSubmitButton pendingLabel="Archiving..." className={`${buttonClass} border`}>
                Archive
              </OperationalSubmitButton>
            </form>
          ) : null}

          {canRestoreOrder(order) ? (
            <form action={restoreAdminOrderAction}>
              <input type="hidden" name="order_id" value={orderId} />
              <FormContextFields queue={queue} query={query} />
              <OperationalSubmitButton
                pendingLabel="Restoring..."
                className={`${buttonClass} border border-emerald-700 bg-emerald-950/40 text-emerald-100`}
              >
                Restore
              </OperationalSubmitButton>
            </form>
          ) : null}

          {canDeleteOrder(order) ? (
            <form action={deleteAdminOrderAction} className="grid gap-3">
              <input type="hidden" name="order_id" value={orderId} />
              <FormContextFields queue={queue} query={query} />
              <textarea name="delete_reason" required rows={2} placeholder="Trash reason" className="rounded-lg border px-3 py-2 text-sm" />
              <OperationalSubmitButton
                pendingLabel="Deleting..."
                confirmMessage={`Move order ${orderLabel} to trash?`}
                className={`${buttonClass} border border-rose-700 bg-rose-950/40 text-rose-100`}
              >
                Move to trash
              </OperationalSubmitButton>
            </form>
          ) : null}

          {canPermanentlyDeleteOrder(order) ? (
            <form action={permanentDeleteAdminOrderAction} className="grid gap-3">
              <input type="hidden" name="order_id" value={orderId} />
              <FormContextFields queue={queue} query={query} />
              <textarea
                name="delete_reason"
                required
                rows={2}
                placeholder="Permanent delete reason"
                className="rounded-lg border px-3 py-2 text-sm"
              />
              <OperationalSubmitButton
                pendingLabel="Deleting..."
                confirmMessage={`Permanently delete order ${orderLabel}?`}
                className={`${buttonClass} border border-rose-700 bg-rose-950/40 text-rose-100`}
              >
                Permanent delete
              </OperationalSubmitButton>
            </form>
          ) : null}
        </ActionGroup>
      </div>
    </aside>
  );
}
