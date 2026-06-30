"use client";

import Image from "next/image";
import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { StatusPill } from "@/components/platform/status-pill";
import type { SimpleInventoryRow, SimpleInventoryStatus } from "@/services/simple-inventory-view";
import { WarehouseInventoryAdjustmentPanel } from "@/components/warehouse/warehouse-inventory-adjustment-panel";

type InventoryAction = (formData: FormData) => void | Promise<void>;

const STATUS_OPTIONS: Array<{ value: "all" | SimpleInventoryStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "In stock" },
  { value: "out_of_stock", label: "Out of stock" }
];

function formatUpdated(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function stockBarTone(status: SimpleInventoryStatus): "success" | "danger" {
  if (status === "out_of_stock" || status === "archived") return "danger";
  return "success";
}

function stockFillPercent(row: SimpleInventoryRow) {
  return row.quantity > 0 ? 100 : 0;
}

function HiddenFields({ row, quantity, stockStatus }: { row: SimpleInventoryRow; quantity: number; stockStatus: SimpleInventoryStatus }) {
  return (
    <>
      <input type="hidden" name="product_slug" value={row.productSlug} />
      <input type="hidden" name="sku" value={row.sku} />
      <input type="hidden" name="warehouse_code" value={row.warehouseCode} />
      <input type="hidden" name="quantity" value={String(quantity)} />
      <input type="hidden" name="stock_status" value={stockStatus} />
      <input type="hidden" name="category" value={row.category} />
      <input type="hidden" name="price" value={String(row.price)} />
      <input type="hidden" name="change_summary" value={`Warehouse stock update ${row.productSlug}`} />
      <input type="hidden" name="note" value="Warehouse quick action" />
    </>
  );
}

function StockLevelBar({ row }: { row: SimpleInventoryRow }) {
  const tone = stockBarTone(row.stockStatus);
  const percent = stockFillPercent(row);

  return (
    <div className="grid min-w-[120px] gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--platform-text-secondary)]">{row.quantity} units</span>
        <span className="text-[var(--platform-text-muted)]">{percent}%</span>
      </div>
      <div className="platform-stock-bar">
        <div className={`platform-stock-bar__fill platform-stock-bar__fill--${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function WarehouseInventoryManager({
  rows,
  action,
  totalProductCount,
  readOnly = false
}: {
  rows: SimpleInventoryRow[];
  action?: InventoryAction;
  totalProductCount: number;
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [statusFilter, setStatusFilter] = useState<"all" | SimpleInventoryStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [adjustingRow, setAdjustingRow] = useState<SimpleInventoryRow | null>(null);

  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.category).filter(Boolean))).sort(),
    [rows]
  );
  const supplierOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.supplierName).filter(Boolean))).sort(),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const haystack = `${row.productName} ${row.productSlug} ${row.sku} ${row.category}`.toLowerCase();
      const matchesSearch = normalizedQuery ? haystack.includes(normalizedQuery) : true;
      const matchesStatus = statusFilter === "all" ? true : row.stockStatus === statusFilter;
      const matchesCategory = categoryFilter === "all" ? true : row.category === categoryFilter;
      const matchesSupplier = supplierFilter === "all" ? true : row.supplierName === supplierFilter;
      return matchesSearch && matchesStatus && matchesCategory && matchesSupplier;
    });
  }, [categoryFilter, deferredQuery, rows, statusFilter, supplierFilter]);

  const summary = useMemo(() => ({
    inStock: rows.filter((row) => row.stockStatus === "available" && row.quantity > 0).length,
    outOfStock: rows.filter((row) => row.stockStatus === "out_of_stock" || row.quantity <= 0).length,
    totalUnits: rows.reduce((sum, row) => sum + row.quantity, 0)
  }), [rows]);

  const actionButtonClass = "inline-flex min-h-8 items-center rounded-md border border-[var(--platform-border)] px-2.5 text-[11px] font-semibold text-[var(--platform-text-primary)] hover:border-[var(--platform-accent)]/40";

  return (
    <section className="grid gap-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div className="platform-stock-tier platform-stock-tier--success">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--platform-success)]">In stock</p>
          <p className="text-2xl font-semibold text-[var(--platform-text-primary)]">{summary.inStock}</p>
          <p className="text-xs text-[var(--platform-text-muted)]">{summary.totalUnits} total units</p>
        </div>
        <div className="platform-stock-tier platform-stock-tier--danger">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--platform-danger)]">Out of stock</p>
          <p className="text-2xl font-semibold text-[var(--platform-text-primary)]">{summary.outOfStock}</p>
          <p className="text-xs text-[var(--platform-text-muted)]">Unavailable for sale</p>
        </div>
      </div>

      <p className="text-sm text-[var(--platform-text-secondary)]">
        {readOnly
          ? `Read-only stock levels for fulfillment planning. Showing ${filteredRows.length} of ${rows.length} products · ${totalProductCount} active in catalog. Stock changes are managed in Admin and Supplier panels.`
          : `Showing ${filteredRows.length} of ${rows.length} inventory records · ${totalProductCount} active products in catalog`}
      </p>

      <div className="grid gap-2 rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-3 md:grid-cols-[minmax(220px,1fr)_150px_150px_150px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search product, SKU, category"
          className="h-10 rounded-md border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)]"
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-10 rounded-md border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)]">
          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-md border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)]">
          <option value="all">All categories</option>
          {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="h-10 rounded-md border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)]">
          <option value="all">All suppliers</option>
          {supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface)]">
        <table className="platform-table min-w-[1000px] w-full border-collapse text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">
            <tr>
              <th className="px-3 py-3">Image</th>
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3">SKU</th>
              <th className="px-3 py-3">Qty</th>
              <th className="px-3 py-3">Level</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">Last updated</th>
              <th className="px-3 py-3">{readOnly ? "History" : "Actions"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--platform-border)]">
            {filteredRows.length ? filteredRows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-3">
                  <div className="grid size-10 place-items-center overflow-hidden rounded border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
                    {row.productImage ? (
                      <Image src={row.productImage} alt="" width={40} height={40} className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-[var(--platform-text-muted)]">{row.productName.slice(0, 1)}</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 font-medium text-[var(--platform-text-primary)]">{row.productName}</td>
                <td className="px-3 py-3 font-mono text-xs text-[var(--platform-text-secondary)]">{row.sku}</td>
                <td className="px-3 py-3 text-[var(--platform-text-primary)]">{row.quantity}</td>
                <td className="px-3 py-3"><StockLevelBar row={row} /></td>
                <td className="px-3 py-3"><StatusPill status={row.stockStatus} /></td>
                <td className="px-3 py-3 text-[var(--platform-text-muted)]">{formatUpdated(row.lastUpdated)}</td>
                <td className="px-3 py-3">
                  {readOnly ? (
                    <Link href={`/warehouse/movements?product_slug=${encodeURIComponent(row.productSlug)}&sku=${encodeURIComponent(row.sku)}`} className={actionButtonClass}>
                      View movements
                    </Link>
                  ) : (
                    <div className="flex min-w-[360px] flex-wrap gap-2">
                      <button type="button" onClick={() => setAdjustingRow(row)} className={actionButtonClass}>Adjust</button>
                      {action ? (
                        <>
                          <form action={action} className="contents">
                            <HiddenFields row={row} quantity={0} stockStatus="out_of_stock" />
                            <OperationalSubmitButton pendingLabel="Saving" className={actionButtonClass}>Mark out of stock</OperationalSubmitButton>
                          </form>
                          <form action={action} className="contents">
                            <HiddenFields row={row} quantity={Math.max(row.quantity, 1)} stockStatus="available" />
                            <OperationalSubmitButton pendingLabel="Saving" className={actionButtonClass}>Mark in stock</OperationalSubmitButton>
                          </form>
                        </>
                      ) : null}
                      <Link href={`/warehouse/movements?product_slug=${encodeURIComponent(row.productSlug)}&sku=${encodeURIComponent(row.sku)}`} className={actionButtonClass}>
                        View movements
                      </Link>
                    </div>
                  )}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-[var(--platform-text-muted)]">
                  No products currently require attention.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!readOnly && adjustingRow && action ? (
        <WarehouseInventoryAdjustmentPanel row={adjustingRow} action={action} onClose={() => setAdjustingRow(null)} />
      ) : null}
    </section>
  );
}
