import Link from "next/link";
import { ControlShell } from "@/components/admin/control-shell";
import { DataList } from "@/components/admin/module-panel";
import { getWarehouseSnapshot } from "@/services/admin";
import { INVENTORY_MOVEMENT_TYPES } from "@/services/warehouse-movements";

export const dynamic = "force-dynamic";

type LedgerPageProps = {
  searchParams: Promise<{
    movement_type?: string;
    product_slug?: string;
    sku?: string;
    recent?: string;
    page?: string;
  }>;
};

function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value: unknown) {
  const raw = asText(value, "");
  if (!raw) return "n/a";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(date);
}

function badgeClass(type: string) {
  if (type === "stock_in" || type === "return") {
    return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  }
  if (type === "stock_out" || type === "damaged" || type === "fulfillment") {
    return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  }
  return "border-sky-300/25 bg-sky-300/10 text-sky-100";
}

function queryString(params: Record<string, string | number | undefined>) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).trim()) next.set(key, String(value));
  }
  const query = next.toString();
  return query ? `/warehouse/movements?${query}` : "/warehouse/movements";
}

export default async function WarehouseLedgerPage({ searchParams }: LedgerPageProps) {
  const params = await searchParams;
  const snapshot = await getWarehouseSnapshot({ scope: "movements" });
  const selectedType = INVENTORY_MOVEMENT_TYPES.includes(params.movement_type as typeof INVENTORY_MOVEMENT_TYPES[number])
    ? params.movement_type ?? ""
    : "";
  const selectedProduct = params.product_slug?.trim() ?? "";
  const selectedSku = params.sku?.trim() ?? "";
  const recentOnly = params.recent === "1";
  const recentMovementKeys = new Set(snapshot.data.movements.slice(0, 24).map((movement) => asText(movement.id, `${asText(movement.product_slug)}-${asText(movement.created_at)}`)));
  const page = Math.max(1, Math.trunc(Number(params.page ?? "1") || 1));
  const pageSize = 25;
  const filtered = snapshot.data.movements.filter((movement) => {
    const typeMatch = !selectedType || asText(movement.movement_type) === selectedType;
    const productMatch = !selectedProduct || asText(movement.product_slug).includes(selectedProduct);
    const skuMatch = !selectedSku || asText(movement.sku).includes(selectedSku);
    const recentMatch = !recentOnly || recentMovementKeys.has(asText(movement.id, `${asText(movement.product_slug)}-${asText(movement.created_at)}`));
    return typeMatch && productMatch && skuMatch && recentMatch;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalDelta = filtered.reduce((sum, movement) => sum + asNumber(movement.quantity_delta), 0);
  const inboundDelta = filtered
    .filter((movement) => asNumber(movement.quantity_delta) > 0)
    .reduce((sum, movement) => sum + asNumber(movement.quantity_delta), 0);
  const outboundDelta = filtered
    .filter((movement) => asNumber(movement.quantity_delta) < 0)
    .reduce((sum, movement) => sum + Math.abs(asNumber(movement.quantity_delta)), 0);
  const auditFeedRows = filtered.slice(0, 8).map((movement) => ({
    label: `${asText(movement.movement_type, "movement")} | ${asText(movement.product_slug, "product")}:${asText(movement.sku, "sku")}`,
    value: `${asNumber(movement.quantity_before)} -> ${asNumber(movement.quantity_after)}`,
    detail: `${formatDate(movement.created_at)} | delta ${asNumber(movement.quantity_delta) >= 0 ? "+" : ""}${asNumber(movement.quantity_delta)} | actor ${asText(movement.actor_user_id, "system")} | order ${asText(movement.related_order_id, "n/a")} | reason ${asText(movement.reason_code, "n/a")}`
  }));

  return (
    <ControlShell
      eyebrow="Warehouse ledger"
      title="Inventory movement history."
      description={snapshot.blockedReason ?? "Warehouse stock events are recorded with product, SKU, variant, actor, order, and quantity before/after context."}
      metrics={[
        { label: "Movements", value: String(snapshot.data.movements.length) },
        { label: "Filtered", value: String(filtered.length) },
        { label: "Status", value: snapshot.status }
      ]}
      actions={[
        { label: "Inventory", href: "/warehouse/inventory" },
        { label: "Shipments", href: "/warehouse/shipments" },
        { label: "Stock Movements", href: "/warehouse/movements" }
      ]}
    >
      <section data-ledger-delta-summary className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:grid-cols-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/34">Net delta</p>
          <p className="mt-2 font-[var(--type-display)] text-3xl font-semibold text-white">{totalDelta >= 0 ? "+" : ""}{totalDelta}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/34">Inbound</p>
          <p className="mt-2 font-[var(--type-display)] text-3xl font-semibold text-[#7ce7c9]">+{inboundDelta}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/34">Outbound</p>
          <p className="mt-2 font-[var(--type-display)] text-3xl font-semibold text-amber-100">-{outboundDelta}</p>
        </div>
      </section>

      <section data-movement-audit-feed className="mb-8 grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Movement audit feed</p>
          <Link
            data-recent-activity-filter
            href={queryString({ movement_type: selectedType, product_slug: selectedProduct, sku: selectedSku, recent: recentOnly ? undefined : 1 })}
            className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-4 text-xs font-semibold uppercase tracking-[0.13em] text-white/70 transition hover:border-white/30 hover:text-white"
          >
            {recentOnly ? "Show all" : "Most recent"}
          </Link>
        </div>
        <DataList rows={auditFeedRows.length ? auditFeedRows : [{ label: "inventory_movements", value: "0", detail: "No movement audit rows match the current filters." }]} />
      </section>

      <form className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 md:grid-cols-4">
        <label className="grid gap-2 text-sm">
          <span className="text-white/70">movement_type</span>
          <select name="movement_type" defaultValue={selectedType} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none">
            <option value="">all</option>
            {INVENTORY_MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-white/70">Product</span>
          <input name="product_slug" defaultValue={selectedProduct} placeholder="source-agri" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="text-white/70">SKU</span>
          <input name="sku" defaultValue={selectedSku} placeholder="AGRI" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
        </label>
        <div className="flex items-end gap-3">
          <button type="submit" className="ambient-cta inline-flex w-fit items-center justify-center">
            Filter
          </button>
          <Link href="/warehouse/movements" className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-4 text-sm text-white/70 transition hover:border-white/30 hover:text-white">
            Reset
          </Link>
        </div>
      </form>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.025]">
        <table data-warehouse-ledger-table className="min-w-[980px] w-full border-collapse text-left text-sm">
          <thead className="border-b border-white/10 text-[11px] uppercase tracking-[0.16em] text-white/45">
            <tr>
              <th className="px-4 py-3 font-semibold">Timestamp</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Product / SKU</th>
              <th className="px-4 py-3 font-semibold">Variant</th>
              <th className="px-4 py-3 font-semibold">Qty</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-white/70">
            {rows.length ? rows.map((movement) => {
              const type = asText(movement.movement_type, "adjustment");
              return (
                <tr key={asText(movement.id, `${asText(movement.product_slug)}-${asText(movement.created_at)}`)} className="align-top">
                  <td className="px-4 py-4 text-white/60">{formatDate(movement.created_at)}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(type)}`}>
                      {type}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="block text-white">{asText(movement.product_slug, "product")}</span>
                    <span className="block text-xs text-white/45">{asText(movement.warehouse_code, "warehouse")} / {asText(movement.sku, "sku")}</span>
                  </td>
                  <td className="px-4 py-4">{asText(movement.variant_id, "product-level")}</td>
                  <td className="px-4 py-4">
                    <span className="block text-white">{asNumber(movement.quantity_before)} {"->"} {asNumber(movement.quantity_after)}</span>
                    <span className="block text-xs text-white/45">{asNumber(movement.quantity_delta) >= 0 ? "+" : ""}{asNumber(movement.quantity_delta)}</span>
                  </td>
                  <td className="px-4 py-4">{asText(movement.reason_code, "n/a")}</td>
                  <td className="px-4 py-4">{asText(movement.actor_user_id, "system")}</td>
                  <td className="px-4 py-4">{asText(movement.related_order_id, "n/a")}</td>
                  <td className="px-4 py-4 text-white/55">{asText(movement.notes, "n/a")}</td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-white/50">No movement rows match the current filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-white/60">
        <span>Page {currentPage} of {totalPages}</span>
        <div className="flex gap-2">
          <Link
            aria-disabled={currentPage <= 1}
            href={queryString({ movement_type: selectedType, product_slug: selectedProduct, sku: selectedSku, page: currentPage > 1 ? currentPage - 1 : 1 })}
            className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-4 transition hover:border-white/30 hover:text-white aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Previous
          </Link>
          <Link
            aria-disabled={currentPage >= totalPages}
            href={queryString({ movement_type: selectedType, product_slug: selectedProduct, sku: selectedSku, page: currentPage < totalPages ? currentPage + 1 : totalPages })}
            className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-4 transition hover:border-white/30 hover:text-white aria-disabled:pointer-events-none aria-disabled:opacity-40"
          >
            Next
          </Link>
        </div>
      </div>
    </ControlShell>
  );
}
