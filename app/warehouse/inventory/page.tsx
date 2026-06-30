import Link from "next/link";
import { ControlShell } from "@/components/admin/control-shell";
import { WarehouseInventoryManager } from "@/components/warehouse/warehouse-inventory-manager";
import { CSV_INVENTORY_PAGE_SIZE, getCsvInventoryRows } from "@/services/csv-inventory-source";
import { resolveWarehouseScope } from "@/services/warehouse-scope";
import { readSessionHandoff } from "@/lib/auth/session-handoff";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const currentPage = Math.max(1, Number.parseInt(searchValue(params, "page"), 10) || 1);
  const handoff = await readSessionHandoff();
  const scope = await resolveWarehouseScope({
    userId: handoff?.userId ?? null,
    role: handoff?.role ?? null
  });
  const inventorySource = await getCsvInventoryRows({
    page: currentPage,
    pageSize: CSV_INVENTORY_PAGE_SIZE,
    publishedOnly: true
  });
  const rows = scope.isGlobal
    ? inventorySource.rows
    : inventorySource.rows.filter((row) => row.warehouseCode === scope.warehouseCode);
  const previousPageHref = currentPage > 1 ? `/warehouse/inventory?page=${currentPage - 1}` : undefined;
  const nextPageHref = inventorySource.hasNextPage ? `/warehouse/inventory?page=${currentPage + 1}` : undefined;

  return (
    <ControlShell
      eyebrow=""
      title="Inventory"
      description="Read-only stock levels for fulfillment. Use Orders and Dispatch to pack and ship — stock changes are managed in Admin and Supplier panels."
      actions={[
        { label: "Orders", href: "/warehouse/orders" },
        { label: "Dispatch", href: "/warehouse/dispatch" }
      ]}
    >
      <div data-warehouse-inventory-route className="grid gap-6">
        <WarehouseInventoryManager
          rows={rows}
          totalProductCount={inventorySource.totalProductCount}
          readOnly
        />
        {previousPageHref || nextPageHref ? (
          <div className="flex items-center justify-between gap-3 text-sm text-[var(--platform-text-secondary)]">
            {previousPageHref ? <Link href={previousPageHref} className="text-[var(--platform-accent)]">Previous page</Link> : <span />}
            <span>Page {inventorySource.page}</span>
            {nextPageHref ? <Link href={nextPageHref} className="text-[var(--platform-accent)]">Next page</Link> : <span />}
          </div>
        ) : null}
      </div>
    </ControlShell>
  );
}
