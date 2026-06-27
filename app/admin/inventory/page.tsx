import { redirect } from "next/navigation";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { InventoryManager } from "@/components/admin/inventory-manager-loader";
import { AdminInventoryLiveSync } from "@/components/admin/admin-inventory-live-sync";
import { inventoryFeedbackQueryParams } from "@/lib/admin/conflict-handling";
import { CSV_INVENTORY_PAGE_SIZE, countProductsMissingInventoryRecords, getCsvInventoryRows, type CatalogFilter } from "@/services/csv-inventory-source";
import { repairMissingProductInventory } from "@/services/product-inventory-sync";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";
import { getCurrentAuthContext } from "@/services/auth";
import { AdminStockRequestReviewPanel } from "@/components/admin/admin-stock-request-review-panel";
import { listPendingStockRequestsForReview } from "@/services/supplier-stock-request-review";
import {
  deleteInventoryProductFormAction,
  importInventoryCsvFormAction,
  saveInventoryBulkUpdateFormAction,
  saveInventoryQuickEditFormAction
} from "@/app/warehouse/actions";
import { syncMissingInventoryAction } from "./stock-request-actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function inventoryActionMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function saveAdminInventoryWithFeedback(formData: FormData) {
  "use server";
  try {
    await saveInventoryQuickEditFormAction(formData);
  } catch (error) {
    const params = inventoryFeedbackQueryParams(error);
    redirect(`/admin/inventory?${params.toString()}`);
  }
  redirect("/admin/inventory?inventory_status=success&inventory_message=Inventory%20updated.");
}

async function importAdminInventoryWithFeedback(formData: FormData) {
  "use server";
  try {
    await importInventoryCsvFormAction(formData);
  } catch (error) {
    redirect(`/admin/inventory?inventory_status=error&inventory_message=${encodeURIComponent(inventoryActionMessage(error).slice(0, 240))}`);
  }
  redirect("/admin/inventory?inventory_status=success&inventory_message=Inventory%20imported.");
}

async function bulkAdminInventoryWithFeedback(formData: FormData) {
  "use server";
  try {
    await saveInventoryBulkUpdateFormAction(formData);
  } catch (error) {
    redirect(`/admin/inventory?inventory_status=error&inventory_message=${encodeURIComponent(inventoryActionMessage(error).slice(0, 240))}`);
  }
  redirect("/admin/inventory?inventory_status=success&inventory_message=Bulk%20inventory%20updated.");
}

async function deleteAdminInventoryWithFeedback(formData: FormData) {
  "use server";
  try {
    await deleteInventoryProductFormAction(formData);
  } catch (error) {
    redirect(`/admin/inventory?inventory_status=error&inventory_message=${encodeURIComponent(inventoryActionMessage(error).slice(0, 240))}`);
  }
  redirect("/admin/inventory?inventory_status=success&inventory_message=Product%20archived.");
}

function readCatalogFilter(value: string): CatalogFilter {
  if (value === "archived" || value === "all") return value;
  return "active";
}

export default async function AdminInventoryPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const currentPage = Math.max(1, Number.parseInt(searchValue(params, "page"), 10) || 1);
  const catalogFilter = readCatalogFilter(searchValue(params, "catalog"));
  const [auth, policy] = await Promise.all([
    getCurrentAuthContext(),
    getAdminSettingsPolicy()
  ]);
  let missingInventoryCount = await countProductsMissingInventoryRecords();
  if (missingInventoryCount > 0) {
    await repairMissingProductInventory(auth.userId).catch((error) => {
      console.error("[mithron-inventory] Auto-repair on inventory page failed.", error);
    });
    missingInventoryCount = await countProductsMissingInventoryRecords();
  }
  const inventorySource = await getCsvInventoryRows({ page: currentPage, pageSize: CSV_INVENTORY_PAGE_SIZE, catalogFilter });
  const stockRequests = await listPendingStockRequestsForReview();
  const inventoryStatus = searchValue(params, "inventory_status");
  const inventoryMessage = searchValue(params, "inventory_message");
  const stockStatus = searchValue(params, "stock_status");
  const stockMessage = searchValue(params, "stock_message");
  const rows = inventorySource.rows;
  const previousPageHref = currentPage > 1 ? `/admin/inventory?page=${currentPage - 1}&catalog=${catalogFilter}` : undefined;
  const nextPageHref = inventorySource.hasNextPage ? `/admin/inventory?page=${currentPage + 1}&catalog=${catalogFilter}` : undefined;

  return (
    <div data-admin-inventory-route className="grid gap-4">
      <AdminInventoryLiveSync enabled={policy.realtimeUpdatesEnabled} />
      <div data-inventory-mutation-feedback>
        <OperationalFeedback
          status={inventoryStatus}
          message={inventoryMessage}
          context="Inventory"
          idle={inventorySource.blockedReason ?? "Stock updates, import results, and save messages appear here."}
        />
      </div>

      <OperationalFeedback status={stockStatus} message={stockMessage} context="Supplier stock requests" />

      {missingInventoryCount > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          <p>{missingInventoryCount} product{missingInventoryCount === 1 ? "" : "s"} have no inventory record in the database.</p>
          <form action={syncMissingInventoryAction}>
            <OperationalSubmitButton pendingLabel="Syncing" className="platform-btn-primary h-9 rounded-[8px] px-3 text-xs font-medium">
              Sync missing
            </OperationalSubmitButton>
          </form>
        </div>
      ) : null}

      {stockRequests.length ? <AdminStockRequestReviewPanel items={stockRequests} /> : null}

      <InventoryManager
        rows={rows}
        action={saveAdminInventoryWithFeedback}
        importAction={importAdminInventoryWithFeedback}
        bulkAction={bulkAdminInventoryWithFeedback}
        deleteAction={deleteAdminInventoryWithFeedback}
        exportHref={`/admin/inventory/export?catalog=${catalogFilter}`}
        title="Inventory"
        page={inventorySource.page}
        totalProductCount={inventorySource.totalProductCount}
        inventoryMetrics={inventorySource.inventoryMetrics}
        catalogFilter={catalogFilter}
        hasNextPage={inventorySource.hasNextPage}
        previousPageHref={previousPageHref}
        nextPageHref={nextPageHref}
      />
    </div>
  );
}
