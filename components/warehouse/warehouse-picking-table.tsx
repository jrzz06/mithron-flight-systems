"use client";

import { StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";

export type PickingLineRow = {
  orderId: string;
  orderNumber: string;
  status: string;
  orderStatus: string;
  paymentStatus: string;
  sku: string;
  productName: string;
  productSlug: string;
  quantity: number;
  warehouseCode: string;
  lineIndex: number;
  lineCount: number;
};

export function WarehousePickingTable({
  rows,
  pickAction
}: {
  rows: PickingLineRow[];
  pickAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface)]">
      <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Line</th>
            <th className="px-4 py-3">SKU</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Bin</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => {
            const nextStatus = row.status === "pending" ? "processing" : "picked";
            const showAction = row.lineIndex === 0;
            return (
              <tr
                key={`${row.orderId}:${row.sku}:${row.lineIndex}`}
                data-picking-row={row.orderId}
                className="content-visibility-auto align-top [contain-intrinsic-size:76px] [content-visibility:auto]"
              >
                <td className="px-4 py-3.5 font-medium text-[var(--platform-text-primary)]">{row.orderNumber}</td>
                <td className="px-4 py-3.5 text-[var(--platform-text-muted)]">{row.lineIndex + 1} / {row.lineCount}</td>
                <td className="px-4 py-3.5 font-mono text-xs text-[var(--platform-text-secondary)]">{row.sku}</td>
                <td className="px-4 py-3.5 text-[var(--platform-text-secondary)]">{row.productName}</td>
                <td className="px-4 py-3.5 text-[var(--platform-text-primary)]">{String(row.quantity)}</td>
                <td className="px-4 py-3.5 text-[var(--platform-text-muted)]">{row.warehouseCode}</td>
                <td className="px-4 py-3.5"><StatusBadge status={row.status} /></td>
                <td className="px-4 py-3.5">
                  {showAction ? (
                    <form action={pickAction} className="flex justify-end">
                      <input name="order_id" type="hidden" value={row.orderId} />
                      <input name="status" type="hidden" value={row.orderStatus} />
                      <input name="payment_status" type="hidden" value={row.paymentStatus} />
                      <input name="fulfillment_status" type="hidden" value={nextStatus} />
                      <input name="warehouse_code" type="hidden" value={row.warehouseCode} />
                      <input name="note" type="hidden" value={`${nextStatus} from picking queue`} />
                      <input name="change_summary" type="hidden" value={`Warehouse picking ${nextStatus} ${row.orderNumber}`} />
                      <OperationalSubmitButton pendingLabel="Saving" className="platform-btn-primary platform-btn-sm">
                        {nextStatus === "processing" ? "Start picking" : "Picking complete"}
                      </OperationalSubmitButton>
                    </form>
                  ) : (
                    <span className="platform-type-caption">Included in order pick</span>
                  )}
                </td>
              </tr>
            );
          }) : (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-[var(--platform-text-muted)]">No orders are waiting for picking.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
