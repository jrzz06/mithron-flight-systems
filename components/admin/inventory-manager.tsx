"use client";

import Image from "next/image";
import { Archive, Download, MoreHorizontal, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { createPortal } from "react-dom";
import { memo, type ReactNode, useDeferredValue, useEffect, useMemo, useState } from "react";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import type { SimpleInventoryRow, SimpleInventoryStatus } from "@/services/simple-inventory-view";
import { buildInventorySnapshot } from "@/services/inventory-csv";

type InventoryAction = (formData: FormData) => void | Promise<void>;

type InventoryManagerProps = {
  rows: SimpleInventoryRow[];
  action: InventoryAction;
  importAction: InventoryAction;
  bulkAction: InventoryAction;
  deleteAction: InventoryAction;
  exportHref: string;
  title?: string;
  page?: number;
  hasNextPage?: boolean;
  previousPageHref?: string;
  nextPageHref?: string;
};

const statusOptions: Array<{ value: SimpleInventoryStatus; label: string }> = [
  { value: "available", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "archived", label: "Archived" }
];

function statusClass(status: SimpleInventoryStatus) {
  if (status === "available") return "bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/15";
  if (status === "low_stock") return "bg-amber-500/10 text-amber-200 ring-1 ring-amber-400/15";
  if (status === "out_of_stock" || status === "archived") return "bg-rose-500/10 text-rose-200 ring-1 ring-rose-400/15";
  return "bg-slate-500/10 text-slate-300 ring-1 ring-slate-400/15";
}

function statusLabel(status: SimpleInventoryStatus) {
  return statusOptions.find((option) => option.value === status)?.label ?? "In stock";
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatUpdated(value: string | null) {
  if (!value) return "Not updated";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed);
}

function rowSearchText(row: SimpleInventoryRow) {
  return `${row.productName} ${row.productSlug} ${row.sku} ${row.category}`.toLowerCase();
}

function rowKey(row: SimpleInventoryRow) {
  return `${row.warehouseCode}::${row.productSlug}::${row.sku}`;
}

function HiddenInventoryFields({
  row,
  status,
  quantity,
  includeStatus = true,
  includeQuantity = true
}: {
  row: SimpleInventoryRow;
  status?: SimpleInventoryStatus;
  quantity?: number;
  includeStatus?: boolean;
  includeQuantity?: boolean;
}) {
  return (
    <>
      <input type="hidden" name="product_slug" value={row.productSlug} />
      <input type="hidden" name="product_name" value={row.productName} />
      <input type="hidden" name="product_image" value={row.productImage ?? ""} />
      <input type="hidden" name="sku" value={row.sku} />
      <input type="hidden" name="variant_id" value={row.variantId ?? ""} />
      <input type="hidden" name="warehouse_code" value={row.warehouseCode} />
      {includeQuantity ? <input type="hidden" name="quantity" value={quantity ?? row.quantity} /> : null}
      <input type="hidden" name="category" value={row.category} />
      <input type="hidden" name="price" value={row.price} />
      {includeStatus ? <input type="hidden" name="stock_status" value={status ?? row.stockStatus} /> : null}
      {row.warehouseUpdatedAt ? <input type="hidden" name="expected_updated_at" value={row.warehouseUpdatedAt} /> : null}
      {row.inventoryUpdatedAt ? <input type="hidden" name="expected_inventory_updated_at" value={row.inventoryUpdatedAt} /> : null}
      <input type="hidden" name="change_summary" value={`Update inventory ${row.productSlug}:${row.sku}`} />
    </>
  );
}

function InventoryDialogPortal({
  children,
  onClose,
  align = "center"
}: {
  children: ReactNode;
  onClose: () => void;
  align?: "center" | "right";
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      data-inventory-dialog-portal
      className={`fixed inset-0 z-[140] flex bg-[#02040a]/72 p-3 backdrop-blur-sm transition-opacity ${align === "right" ? "items-stretch justify-end" : "items-center justify-center"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </div>,
    document.body
  );
}

function InventoryStatusPill({ status }: { status: SimpleInventoryStatus }) {
  return (
    <span data-inventory-status-pill className={`inline-flex h-7 items-center rounded-full px-2.5 text-xs font-semibold ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function InlineStockEditor({
  row,
  action,
  onLocalUpdate
}: {
  row: SimpleInventoryRow;
  action: InventoryAction;
  onLocalUpdate: (id: string, fields: Partial<SimpleInventoryRow>) => void;
}) {
  function updateLocal(form: HTMLFormElement) {
    const quantity = Number(new FormData(form).get("quantity") ?? row.quantity);
    if (Number.isFinite(quantity)) {
      onLocalUpdate(row.id, {
        quantity,
        inventoryValue: quantity * row.price,
        stockStatus: quantity <= 0 ? "out_of_stock" : row.stockStatus === "out_of_stock" ? "available" : row.stockStatus
      });
    }
  }

  return (
    <div data-inventory-inline-stock className="flex flex-wrap items-center gap-1.5">
      <form action={action} onSubmit={(event) => updateLocal(event.currentTarget)} className="flex items-center gap-1">
        <HiddenInventoryFields row={row} includeQuantity={false} />
        <input
          name="quantity"
          type="number"
          min={0}
          defaultValue={row.quantity}
          aria-label={`Stock quantity for ${row.productName}`}
          className="h-8 w-20 rounded-lg border border-slate-800 bg-[#0b1017] px-2 text-sm font-semibold text-slate-100 outline-none focus:border-emerald-400/70"
        />
        <OperationalSubmitButton pendingLabel="Saving" className="inline-flex h-8 items-center rounded-lg border border-slate-800 bg-white/[0.04] px-2 text-[11px] font-semibold text-slate-200 hover:border-slate-700">
          Save
        </OperationalSubmitButton>
      </form>
      <form
        action={action}
        onSubmit={() => {
          const quantity = row.quantity + 1;
          onLocalUpdate(row.id, {
            quantity,
            inventoryValue: quantity * row.price,
            stockStatus: row.stockStatus === "out_of_stock" ? "available" : row.stockStatus
          });
        }}
      >
        <HiddenInventoryFields row={row} quantity={row.quantity + 1} />
        <button
          data-inventory-increment="1"
          className="inline-flex h-8 items-center rounded-lg border border-slate-800 bg-white/[0.03] px-2 text-[11px] font-semibold text-slate-300 hover:border-emerald-400/40 hover:text-emerald-100"
        >
          +1
        </button>
      </form>
      <form
        action={action}
        onSubmit={() => {
          const quantity = row.quantity + 5;
          onLocalUpdate(row.id, {
            quantity,
            inventoryValue: quantity * row.price,
            stockStatus: row.stockStatus === "out_of_stock" ? "available" : row.stockStatus
          });
        }}
      >
        <HiddenInventoryFields row={row} quantity={row.quantity + 5} />
        <button
          data-inventory-increment="5"
          className="inline-flex h-8 items-center rounded-lg border border-slate-800 bg-white/[0.03] px-2 text-[11px] font-semibold text-slate-300 hover:border-emerald-400/40 hover:text-emerald-100"
        >
          +5
        </button>
      </form>
      <form
        action={action}
        onSubmit={() => {
          const quantity = row.quantity + 10;
          onLocalUpdate(row.id, {
            quantity,
            inventoryValue: quantity * row.price,
            stockStatus: row.stockStatus === "out_of_stock" ? "available" : row.stockStatus
          });
        }}
      >
        <HiddenInventoryFields row={row} quantity={row.quantity + 10} />
        <button
          data-inventory-increment="10"
          className="inline-flex h-8 items-center rounded-lg border border-slate-800 bg-white/[0.03] px-2 text-[11px] font-semibold text-slate-300 hover:border-emerald-400/40 hover:text-emerald-100"
        >
          +10
        </button>
      </form>
    </div>
  );
}

const InventoryRow = memo(function InventoryRow({
  row,
  selected,
  menuOpen,
  action,
  deleteAction,
  onSelect,
  onEdit,
  onMenuToggle,
  onLocalUpdate,
  onLocalDelete
}: {
  row: SimpleInventoryRow;
  selected: boolean;
  menuOpen: boolean;
  action: InventoryAction;
  deleteAction: InventoryAction;
  onSelect: (id: string, selected: boolean) => void;
  onEdit: (row: SimpleInventoryRow) => void;
  onMenuToggle: (id: string) => void;
  onLocalUpdate: (id: string, fields: Partial<SimpleInventoryRow>) => void;
  onLocalDelete: (id: string) => void;
}) {
  return (
    <tr data-inventory-row className={`content-visibility-auto group border-b border-slate-800/70 text-sm [contain-intrinsic-size:72px] [content-visibility:auto] ${menuOpen ? "relative z-30" : ""}`}>
      <td className="w-10 px-3 py-2.5">
        <input
          type="checkbox"
          aria-label={`Select ${row.productName}`}
          checked={selected}
          onChange={(event) => onSelect(rowKey(row), event.currentTarget.checked)}
          className="h-4 w-4 rounded border-slate-700 bg-[#0b1017]"
        />
      </td>
      <td className="w-16 px-2 py-2.5">
        <div className="grid size-11 place-items-center overflow-hidden rounded-lg border border-slate-800 bg-[#0b1017]">
          {row.productImage ? (
            <Image
              src={row.productImage}
              alt=""
              width={44}
              height={44}
              sizes="44px"
              loading="lazy"
              className="h-full w-full object-contain p-1"
            />
          ) : (
            <span className="text-xs font-semibold text-slate-500">{row.productName.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
      </td>
      <td className="min-w-[260px] px-3 py-2.5">
        <p className="max-w-[360px] truncate font-semibold text-slate-100">{row.productName}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{row.productSlug}</p>
      </td>
      <td className="min-w-[150px] px-3 py-2.5 font-mono text-xs text-slate-300">{row.sku}</td>
      <td className="min-w-[210px] px-3 py-2.5">
        <InlineStockEditor row={row} action={action} onLocalUpdate={onLocalUpdate} />
      </td>
      <td className="min-w-[132px] px-3 py-2.5">
        <InventoryStatusPill status={row.stockStatus} />
      </td>
      <td className="sticky right-0 min-w-[72px] bg-[#0f141b] px-3 py-2.5">
        <div className="flex items-center justify-end">
          <div className="relative" data-inventory-action-menu>
            <button
              type="button"
              aria-label={`More actions for ${row.productName}`}
              aria-expanded={menuOpen}
              onClick={() => onMenuToggle(row.id)}
              className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 bg-[#151c26] text-slate-300 hover:border-slate-600"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-9 z-[95] grid w-48 gap-1 rounded-xl border border-slate-800 bg-[#10151d] p-2 text-xs shadow-2xl shadow-black/30">
                <button
                  type="button"
                  data-inventory-quick-edit
                  data-inventory-action="edit"
                  onClick={() => onEdit(row)}
                  className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-slate-300 hover:bg-[#151c26] hover:text-slate-100"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  Edit
                </button>
                <button
                  type="button"
                  data-inventory-action="stock"
                  aria-label="Stock update"
                  onClick={() => onEdit(row)}
                  className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-slate-300 hover:bg-[#151c26] hover:text-slate-100"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Update stock
                </button>
                <form action={action} onSubmit={() => onLocalUpdate(row.id, { stockStatus: "archived" })}>
                  <HiddenInventoryFields row={row} status="archived" />
                  <button data-inventory-action="archive" className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-slate-300 hover:bg-[#151c26] hover:text-slate-100">
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                    Archive
                  </button>
                </form>
                <a
                  data-inventory-action="view"
                  href={`/product/${row.productSlug}`}
                  target="_blank"
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-slate-300 hover:bg-[#151c26] hover:text-slate-100"
                >
                  View product
                </a>
                <form
                  action={deleteAction}
                  onSubmit={(event) => {
                    if (!window.confirm(`Delete ${row.productName}? Protected items are kept automatically.`)) {
                      event.preventDefault();
                      return;
                    }
                    onLocalDelete(row.id);
                  }}
                >
                  <HiddenInventoryFields row={row} />
                  <button data-inventory-action="delete" className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-semibold text-rose-300 hover:bg-rose-950/35">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Delete
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </td>
    </tr>
  );
});

export function InventoryManager({
  rows,
  action,
  importAction,
  bulkAction,
  deleteAction,
  exportHref,
  title = "Inventory",
  page = 1,
  hasNextPage = false,
  previousPageHref,
  nextPageHref
}: InventoryManagerProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [statusFilter, setStatusFilter] = useState<"all" | SimpleInventoryStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockRangeFilter, setStockRangeFilter] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<SimpleInventoryRow | null>(null);
  const [bulkDrawerOpen, setBulkDrawerOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Partial<SimpleInventoryRow>>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => new Set());
  const mergedRows = useMemo(
    () => rows
      .filter((row) => !deletedIds.has(row.id))
      .map((row) => ({ ...row, ...(overrides[row.id] ?? {}) })),
    [deletedIds, overrides, rows]
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return mergedRows.filter((row) => {
      const matchesSearch = normalizedQuery ? rowSearchText(row).includes(normalizedQuery) : true;
      const matchesStatus = statusFilter === "all" ? true : row.stockStatus === statusFilter;
      const matchesCategory = categoryFilter === "all" ? true : row.category === categoryFilter;
      const matchesRange = stockRangeFilter === "all"
        ? true
        : stockRangeFilter === "zero"
          ? row.quantity <= 0
          : stockRangeFilter === "low"
            ? row.quantity > 0 && row.quantity <= Math.max(5, row.reorderThreshold)
            : row.quantity > 10;
      return matchesSearch && matchesStatus && matchesCategory && matchesRange;
    });
  }, [categoryFilter, deferredQuery, mergedRows, statusFilter, stockRangeFilter]);
  const visibleRows = filteredRows;
  const inventorySummary = useMemo(() => buildInventorySnapshot(filteredRows), [filteredRows]);
  const categoryOptions = useMemo(() => Array.from(new Set(mergedRows.map((row) => row.category).filter(Boolean))).sort(), [mergedRows]);

  function updateSelected(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function updateRow(id: string, fields: Partial<SimpleInventoryRow>) {
    setOverrides((current) => ({
      ...current,
      [id]: {
        ...(current[id] ?? {}),
        ...fields
      }
    }));
  }

  function applyQuickEdit(form: HTMLFormElement) {
    if (!editingRow) return;
    const formData = new FormData(form);
    const quantity = Number(formData.get("quantity") ?? editingRow.quantity);
    const price = Number(formData.get("price") ?? editingRow.price);
    const nextStatus = String(formData.get("stock_status") ?? editingRow.stockStatus) as SimpleInventoryStatus;
    const category = String(formData.get("category") ?? editingRow.category);
    updateRow(editingRow.id, {
      quantity: Number.isFinite(quantity) ? quantity : editingRow.quantity,
      price: Number.isFinite(price) ? price : editingRow.price,
      inventoryValue: Number.isFinite(quantity) && Number.isFinite(price) ? quantity * price : editingRow.inventoryValue,
      stockStatus: nextStatus,
      category
    });
    setEditingRow(null);
  }

  return (
    <section data-inventory-system className="mithron-elevated-card grid gap-3 rounded-xl border border-slate-800 bg-[#0f141b] p-3 text-slate-100 md:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Stock control</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">{title} <span className="text-slate-500">{formatNumber(filteredRows.length)}</span></h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={exportHref}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#151c26] px-3 text-xs font-semibold text-slate-100 hover:border-slate-600"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export
          </a>
        </div>
      </div>

      <div data-inventory-source-report className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        <div className="mithron-elevated-card rounded-lg border border-slate-800 bg-[#10151d] p-3">
          <p className="text-xs text-slate-500">Products</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{formatNumber(inventorySummary.productCount)}</p>
        </div>
        <div className="mithron-elevated-card rounded-lg border border-slate-800 bg-[#10151d] p-3">
          <p className="text-xs text-slate-500">Stock units</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{formatNumber(inventorySummary.stockUnits)}</p>
        </div>
        <div className="mithron-elevated-card rounded-lg border border-slate-800 bg-[#10151d] p-3">
          <p className="text-xs text-slate-500">Inventory value</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{formatCurrency(inventorySummary.totalValue)}</p>
        </div>
        <div className="mithron-elevated-card rounded-lg border border-slate-800 bg-[#10151d] p-3">
          <p className="text-xs text-slate-500">Low stock</p>
          <p className="mt-1 text-lg font-semibold text-amber-200">{formatNumber(inventorySummary.lowStockCount)}</p>
        </div>
        <div className="mithron-elevated-card rounded-lg border border-slate-800 bg-[#10151d] p-3">
          <p className="text-xs text-slate-500">Out of stock</p>
          <p className="mt-1 text-lg font-semibold text-rose-200">{formatNumber(inventorySummary.outOfStockCount)}</p>
        </div>
      </div>

      <div data-inventory-sticky-toolbar className="sticky top-0 z-20 grid gap-2 rounded-xl border border-slate-800 bg-[#10151d]/95 p-2 backdrop-blur-sm md:grid-cols-[minmax(220px,1fr)_160px_170px_160px_auto]">
        <label className="grid gap-1 text-xs font-medium text-slate-500">
          <span className="sr-only">Search</span>
          <span className="flex items-center gap-1 text-slate-400">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            Search
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search product, SKU, category"
            className="h-10 rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-500">
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.currentTarget.value as typeof statusFilter)}
            className="h-10 rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100 outline-none focus:border-slate-500"
          >
            <option value="all">All</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-500">
          Category
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.currentTarget.value)}
            className="h-10 rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100 outline-none focus:border-slate-500"
          >
            <option value="all">All categories</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-500">
          Stock range
          <select
            value={stockRangeFilter}
            onChange={(event) => setStockRangeFilter(event.currentTarget.value)}
            className="h-10 rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100 outline-none focus:border-slate-500"
          >
            <option value="all">All stock</option>
            <option value="zero">Zero</option>
            <option value="low">Low</option>
            <option value="healthy">Healthy</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => setBulkDrawerOpen(true)}
          className="mt-auto inline-flex h-10 items-center justify-center rounded-lg border border-slate-700 bg-[#151c26] px-3 text-xs font-semibold text-slate-100 hover:border-slate-600"
        >
          Bulk actions
        </button>
      </div>

      <div data-inventory-bulk-bar className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#10151d] p-2 text-xs text-slate-400">
        <span className="font-semibold text-slate-300">{selected.size} selected</span>
        <span>Use row checkboxes, then open Bulk actions for a grouped stock update.</span>
      </div>

      <div className="hidden overflow-auto rounded-xl border border-slate-800 md:block">
        <table data-inventory-table className="min-w-[920px] w-full border-collapse bg-[#0f141b]">
          <thead className="sticky top-0 z-20 bg-[#172131] text-left text-xs font-semibold text-slate-300">
            <tr>
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  aria-label="Select visible inventory"
                  checked={visibleRows.length > 0 && visibleRows.every((row) => selected.has(rowKey(row)))}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setSelected((current) => {
                      const next = new Set(current);
                      visibleRows.forEach((row) => {
                        if (checked) next.add(rowKey(row));
                        else next.delete(rowKey(row));
                      });
                      return next;
                    });
                  }}
                  className="h-4 w-4 rounded border-slate-700 bg-[#0b1017]"
                />
              </th>
              <th className="w-16 px-2 py-3">Product image</th>
              <th className="px-3 py-3">Product name</th>
              <th className="px-3 py-3">SKU</th>
              <th className="px-3 py-3">Stock quantity</th>
              <th className="px-3 py-3">Inventory status</th>
              <th className="sticky right-0 bg-[#172131] px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? visibleRows.map((row) => (
              <InventoryRow
                key={row.id}
                row={row}
                selected={selected.has(rowKey(row))}
                menuOpen={openMenuId === row.id}
                action={action}
                deleteAction={deleteAction}
                onSelect={updateSelected}
                onEdit={(nextRow) => {
                  setOpenMenuId(null);
                  setEditingRow(nextRow);
                }}
                onMenuToggle={(id) => setOpenMenuId((current) => current === id ? null : id)}
                onLocalUpdate={updateRow}
                onLocalDelete={(id) => {
                  setOpenMenuId(null);
                  setDeletedIds((current) => new Set([...current, id]));
                }}
              />
            )) : (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">No inventory rows match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div data-inventory-mobile-cards className="grid gap-2 md:hidden">
        {visibleRows.length ? visibleRows.map((row) => (
          <article key={row.id} className="content-visibility-auto rounded-xl border border-slate-800 bg-[#10151d] p-3 [contain-intrinsic-size:220px] [content-visibility:auto]">
            <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-start gap-3">
              <div className="grid size-12 place-items-center overflow-hidden rounded-lg border border-slate-800 bg-[#0b1017]">
                {row.productImage ? (
                  <Image src={row.productImage} alt="" width={48} height={48} sizes="48px" loading="lazy" className="h-full w-full object-contain p-1" />
                ) : (
                  <span className="text-xs font-semibold text-slate-500">{row.productName.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">{row.productName}</p>
                <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{row.sku}</p>
                <p className="mt-1 text-[11px] text-slate-600">{formatUpdated(row.lastUpdated)}</p>
              </div>
              <input
                type="checkbox"
                aria-label={`Select ${row.productName}`}
                checked={selected.has(rowKey(row))}
                onChange={(event) => updateSelected(rowKey(row), event.currentTarget.checked)}
                className="h-4 w-4 rounded border-slate-700 bg-[#0b1017]"
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <InventoryStatusPill status={row.stockStatus} />
              <button
                type="button"
                data-inventory-quick-edit
                onClick={() => setEditingRow(row)}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#151c26] px-2.5 text-xs font-semibold text-slate-100 hover:border-slate-600"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </button>
            </div>
            <div className="mt-3">
              <InlineStockEditor row={row} action={action} onLocalUpdate={updateRow} />
            </div>
          </article>
        )) : (
          <p className="rounded-xl border border-slate-800 bg-[#10151d] px-4 py-8 text-center text-sm text-slate-500">No inventory rows match the current filters.</p>
        )}
      </div>

      <div data-inventory-pagination className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-[#10151d] px-3 py-2 text-xs text-slate-400">
        <span>Page {page}</span>
        <div className="flex gap-2">
          {previousPageHref ? (
            <a href={previousPageHref} className="inline-flex h-8 items-center rounded-md border border-slate-700 px-3 font-semibold text-slate-200 hover:bg-[#151c26]">Previous</a>
          ) : (
            <span className="inline-flex h-8 items-center rounded-md border border-slate-800 px-3 font-semibold text-slate-600">Previous</span>
          )}
          {hasNextPage && nextPageHref ? (
            <a href={nextPageHref} className="inline-flex h-8 items-center rounded-md border border-slate-700 px-3 font-semibold text-slate-200 hover:bg-[#151c26]">Next</a>
          ) : (
            <span className="inline-flex h-8 items-center rounded-md border border-slate-800 px-3 font-semibold text-slate-600">Next</span>
          )}
        </div>
      </div>

      <details data-advanced-warehouse-details className="rounded-lg border border-slate-800 bg-[#10151d] p-3 text-sm text-slate-400">
        <summary className="cursor-pointer font-semibold text-slate-300">Data tools</summary>
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <form action={importAction} data-inventory-csv-import className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-[#0b1017] p-2">
            <span className="sr-only">Supabase inventory records are the source of truth.</span>
            <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 bg-[#151c26] px-2.5 text-xs font-semibold text-slate-100 hover:border-slate-600">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Import file
              <input name="inventory_csv" type="file" accept=".csv,text/csv" className="sr-only" />
            </label>
            <OperationalSubmitButton
              pendingLabel="Importing"
              className="inline-flex h-8 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-950/40 px-3 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/45"
            >
              Upload
            </OperationalSubmitButton>
          </form>
          <span data-inventory-audit-table="inventory_movements" className="self-center text-xs text-slate-500">Reserved and committed stock stay out of the scan table.</span>
        </div>
      </details>

      {editingRow ? (
        <InventoryDialogPortal onClose={() => setEditingRow(null)}>
          <div
            data-inventory-edit-dialog
            role="dialog"
            aria-modal="true"
            aria-label={`Edit inventory for ${editingRow.productName}`}
            className="w-full max-w-3xl scale-100 rounded-xl border border-slate-800 bg-[#0f141b] p-4 shadow-2xl shadow-black/40 transition duration-150 ease-out"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Quick stock edit</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-100">{editingRow.productName}</h3>
                <p className="mt-1 text-xs text-slate-500">{editingRow.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRow(null)}
                aria-label="Close inventory editor"
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 text-slate-300 hover:bg-[#151c26]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <form
              action={action}
              data-inventory-quick-edit-form
              onSubmit={(event) => applyQuickEdit(event.currentTarget)}
              className="mt-4 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]"
            >
              <input type="hidden" name="product_slug" value={editingRow.productSlug} />
              <input type="hidden" name="sku" value={editingRow.sku} />
              <input type="hidden" name="variant_id" value={editingRow.variantId ?? ""} />
              <input type="hidden" name="warehouse_code" value={editingRow.warehouseCode} />
              <div className="rounded-xl border border-slate-800 bg-[#0b1017] p-3">
                <div className="relative mx-auto aspect-square w-full max-w-[180px] overflow-hidden rounded-xl border border-slate-800 bg-[#10151d]">
                  {editingRow.productImage ? (
                    <Image src={editingRow.productImage} alt="" fill sizes="180px" loading="lazy" className="object-contain p-3" />
                  ) : (
                    <div className="grid h-full place-items-center text-xl font-semibold text-slate-600">{editingRow.productName.slice(0, 1).toUpperCase()}</div>
                  )}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-500">
                  <p className="flex items-center justify-between gap-3"><span>Current stock</span><strong className="text-slate-100">{formatNumber(editingRow.quantity)}</strong></p>
                  <p className="flex items-center justify-between gap-3"><span>Available</span><strong className="text-slate-100">{formatNumber(editingRow.availableQuantity)}</strong></p>
                  <p className="flex items-center justify-between gap-3"><span>Committed</span><strong className="text-slate-100">{formatNumber(editingRow.committedQuantity)}</strong></p>
                </div>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-medium text-slate-500">
                    Stock quantity
                    <input name="quantity" type="number" min={0} defaultValue={editingRow.quantity} className="h-10 rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100 outline-none focus:border-emerald-400/70" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-500">
                    Status
                    <select name="stock_status" defaultValue={editingRow.stockStatus} className="h-10 rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100 outline-none focus:border-emerald-400/70">
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-500">
                    SKU
                    <input value={editingRow.sku} readOnly className="h-10 rounded-lg border border-slate-800 bg-[#0b1017] px-3 font-mono text-xs text-slate-300" />
                  </label>
                  <label className="grid gap-1 text-xs font-medium text-slate-500">
                    Warehouse location
                    <input value={editingRow.warehouseCode} readOnly className="h-10 rounded-lg border border-slate-800 bg-[#0b1017] px-3 text-sm text-slate-300" />
                  </label>
                </div>
                <input type="hidden" name="category" value={editingRow.category} />
                <input type="hidden" name="price" value={editingRow.price} />
                <label className="grid gap-1 text-xs font-medium text-slate-500">
                  Note
                  <input name="note" placeholder="Optional reason for this stock change" className="h-10 rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/70" />
                </label>
                <input type="hidden" name="change_summary" value={`Quick edit ${editingRow.productSlug}:${editingRow.sku}`} />
                <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                  <button type="button" onClick={() => setEditingRow(null)} className="h-9 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:bg-[#151c26]">Cancel</button>
                  <OperationalSubmitButton
                    pendingLabel="Saving"
                    className="inline-flex h-9 items-center rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 text-xs font-semibold text-emerald-100 hover:bg-emerald-900/45"
                  >
                    Save stock
                  </OperationalSubmitButton>
                </div>
              </div>
            </form>
          </div>
        </InventoryDialogPortal>
      ) : null}

      {bulkDrawerOpen ? (
        <InventoryDialogPortal onClose={() => setBulkDrawerOpen(false)} align="right">
          <form
            action={bulkAction}
            data-inventory-bulk-drawer
            role="dialog"
            aria-modal="true"
            aria-label="Bulk stock update"
            className="grid h-full w-full max-w-sm content-start gap-4 rounded-l-xl border-l border-slate-800 bg-[#0f141b] p-4 shadow-2xl shadow-black/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Bulk stock</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-100">{selected.size} selected</h3>
              </div>
              <button type="button" onClick={() => setBulkDrawerOpen(false)} aria-label="Close bulk stock update" className="grid h-8 w-8 place-items-center rounded-lg border border-slate-700 text-slate-300 hover:bg-[#151c26]">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {Array.from(selected).map((id) => (
              <input key={id} type="hidden" name="selected_inventory_row" value={id} />
            ))}
            <label className="grid gap-1 text-xs font-medium text-slate-500">
              Status
              <select name="bulk_stock_status" defaultValue="available" className="h-10 rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100">
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-slate-500">
              Category
              <input name="bulk_category" placeholder="Optional category" className="h-10 rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100 placeholder:text-slate-600" />
            </label>
            <OperationalSubmitButton
              pendingLabel="Updating"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-4 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/45"
            >
              Apply update
            </OperationalSubmitButton>
          </form>
        </InventoryDialogPortal>
      ) : null}
    </section>
  );
}
