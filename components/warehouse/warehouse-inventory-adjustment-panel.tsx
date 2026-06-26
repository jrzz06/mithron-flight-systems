"use client";

import Image from "next/image";
import { useState } from "react";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import type { SimpleInventoryRow } from "@/services/simple-inventory-view";

type InventoryAction = (formData: FormData) => void | Promise<void>;

const REASONS = [
  { value: "receive_shipment", label: "Receive Shipment" },
  { value: "correction", label: "Correction" },
  { value: "damage", label: "Damage" },
  { value: "manual_count", label: "Manual Count" }
] as const;

export function WarehouseInventoryAdjustmentPanel({
  row,
  action,
  onClose
}: {
  row: SimpleInventoryRow;
  action: InventoryAction;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(row.quantity);
  const [reason, setReason] = useState<string>(REASONS[0].value);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-[var(--platform-border)] bg-[var(--platform-surface)] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">Adjust Stock</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--platform-text-primary)]">{row.productName}</h3>
            <p className="text-sm text-[var(--platform-text-secondary)]">{row.sku}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-[var(--platform-text-muted)] hover:text-[var(--platform-text-primary)]">
            Close
          </button>
        </div>

        {row.productImage ? (
          <div className="mt-4 grid size-20 place-items-center overflow-hidden rounded-lg border border-[var(--platform-border)]">
            <Image src={row.productImage} alt="" width={80} height={80} className="h-full w-full object-contain" />
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 text-sm text-[var(--platform-text-secondary)]">
          <p>Current Stock: <span className="font-semibold text-[var(--platform-text-primary)]">{row.quantity}</span></p>
          <p>Reserved: {row.reservedQuantity} · Available: {row.availableQuantity}</p>
        </div>

        <form action={action} className="mt-6 grid gap-4">
          <input type="hidden" name="product_slug" value={row.productSlug} />
          <input type="hidden" name="sku" value={row.sku} />
          <input type="hidden" name="warehouse_code" value={row.warehouseCode} />
          <input type="hidden" name="stock_status" value={row.stockStatus} />
          <input type="hidden" name="category" value={row.category} />
          <input type="hidden" name="price" value={String(row.price)} />
          <input type="hidden" name="change_summary" value={`Warehouse adjustment ${row.productSlug}`} />
          <input type="hidden" name="note" value={reason} />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(0, current - 1))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--platform-border)] text-lg font-semibold"
            >
              −
            </button>
            <input
              name="quantity"
              value={quantity}
              onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))}
              inputMode="numeric"
              className="h-10 w-24 rounded-md border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 text-center text-sm"
            />
            <button
              type="button"
              onClick={() => setQuantity((current) => current + 1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--platform-border)] text-lg font-semibold"
            >
              +
            </button>
          </div>

          <label className="grid gap-2 text-sm">
            <span className="text-[var(--platform-text-secondary)]">Reason</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-10 rounded-md border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3"
            >
              {REASONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <OperationalSubmitButton pendingLabel="Saving">
            Save adjustment
          </OperationalSubmitButton>
        </form>
      </aside>
    </div>
  );
}
