type SupplierInventoryInitDefaults = {
  sku?: string;
  initialQuantity?: number;
  warehouseCode?: string;
  stockNotes?: string;
  trackInventory?: boolean;
};

export function SupplierInventoryInitFields({
  assignedWarehouseCode,
  defaults = {}
}: {
  assignedWarehouseCode?: string | null;
  defaults?: SupplierInventoryInitDefaults;
}) {
  return (
    <details data-supplier-inventory-init className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] p-4">
      <summary className="cursor-pointer text-sm font-medium text-[var(--platform-text-primary)]">Stock information (optional)</summary>
      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--platform-text-secondary)]">SKU</span>
          <input
            name="inventory_sku"
            defaultValue={defaults.sku ?? ""}
            placeholder="Optional SKU suggestion"
            className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 py-2 text-[var(--platform-text-primary)]"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--platform-text-secondary)]">Initial quantity</span>
          <input
            name="inventory_initial_quantity"
            type="number"
            min={0}
            defaultValue={defaults.initialQuantity ?? 0}
            className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 py-2 text-[var(--platform-text-primary)]"
          />
        </label>
        {assignedWarehouseCode ? (
          <>
            <input type="hidden" name="inventory_warehouse_code" value={assignedWarehouseCode} />
            <p className="text-xs text-[var(--platform-text-muted)]">Warehouse: {assignedWarehouseCode}</p>
          </>
        ) : null}
        <label className="inline-flex items-center gap-2 text-sm text-[var(--platform-text-secondary)]">
          <input type="hidden" name="inventory_track" value="off" />
          <input
            type="checkbox"
            name="inventory_track"
            value="on"
            defaultChecked={defaults.trackInventory !== false}
            className="h-4 w-4 rounded border-[var(--platform-border)]"
          />
          Track inventory
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-[var(--platform-text-secondary)]">Stock notes</span>
          <textarea
            name="inventory_stock_notes"
            rows={3}
            defaultValue={defaults.stockNotes ?? ""}
            placeholder="Optional notes for the admin review team"
            className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 py-2 text-[var(--platform-text-primary)]"
          />
        </label>
      </div>
    </details>
  );
}
