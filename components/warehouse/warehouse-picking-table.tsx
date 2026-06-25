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
    <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#10151d]">
      <table className="min-w-[1080px] w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-[#182235] text-xs uppercase tracking-[0.12em] text-slate-400">
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
        <tbody className="divide-y divide-white/[0.05]">
          {rows.length ? rows.map((row) => {
            const nextStatus = row.status === "pending" ? "processing" : "picked";
            const showAction = row.lineIndex === 0;
            return (
              <tr
                key={`${row.orderId}:${row.sku}:${row.lineIndex}`}
                data-picking-row={row.orderId}
                className="content-visibility-auto align-top [contain-intrinsic-size:76px] [content-visibility:auto]"
              >
                <td className="px-4 py-4 font-semibold text-slate-100">{row.orderNumber}</td>
                <td className="px-4 py-4 text-slate-500">{row.lineIndex + 1} / {row.lineCount}</td>
                <td className="px-4 py-4 font-mono text-xs text-slate-300">{row.sku}</td>
                <td className="px-4 py-4 text-slate-300">{row.productName}</td>
                <td className="px-4 py-4 text-slate-100">{String(row.quantity)}</td>
                <td className="px-4 py-4 text-slate-400">{row.warehouseCode}</td>
                <td className="px-4 py-4"><StatusBadge status={row.status} /></td>
                <td className="px-4 py-4">
                  {showAction ? (
                    <form action={pickAction} className="flex justify-end">
                      <input name="order_id" type="hidden" value={row.orderId} />
                      <input name="status" type="hidden" value={row.orderStatus} />
                      <input name="payment_status" type="hidden" value={row.paymentStatus} />
                      <input name="fulfillment_status" type="hidden" value={nextStatus} />
                      <input name="warehouse_code" type="hidden" value={row.warehouseCode} />
                      <input name="note" type="hidden" value={`${nextStatus} from picking queue`} />
                      <input name="change_summary" type="hidden" value={`Warehouse picking ${nextStatus} ${row.orderNumber}`} />
                      <OperationalSubmitButton pendingLabel="Saving" className="inline-flex min-h-9 items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100">
                        {nextStatus === "processing" ? "Start picking" : "Picking complete"}
                      </OperationalSubmitButton>
                    </form>
                  ) : (
                    <span className="text-xs text-slate-500">Included in order pick</span>
                  )}
                </td>
              </tr>
            );
          }) : (
            <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No orders are waiting for picking.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
