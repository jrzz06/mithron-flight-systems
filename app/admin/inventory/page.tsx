import { redirect } from "next/navigation";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { InventoryManager } from "@/components/admin/inventory-manager-loader";
import { AdminInventoryLiveSync } from "@/components/admin/admin-inventory-live-sync";
import { inventoryFeedbackQueryParams } from "@/lib/admin/conflict-handling";
import { CSV_INVENTORY_PAGE_SIZE, getCsvInventoryRows, type CatalogFilter } from "@/services/csv-inventory-source";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";
import { AdminStockRequestReviewPanel } from "@/components/admin/admin-stock-request-review-panel";
import { listPendingStockRequestsForReview } from "@/services/supplier-stock-request-review";
import {
  importInventoryCsvFormAction,
  saveInventoryBulkUpdateFormAction,
  saveInventoryQuickEditFormAction
} from "@/app/warehouse/actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function inventoryActionMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function saveInventoryAdjustmentWithFeedback(formData: FormData) {
  "use server";
  try {
    await saveInventoryQuickEditFormAction(formData);
  } catch (error) {
    const params = inventoryFeedbackQueryParams(error);
    redirect(`/admin/inventory?${params.toString()}`);
  }
  redirect("/admin/inventory?inventory_status=success&inventory_message=Stock%20adjusted.");
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

function readCatalogFilter(value: string): CatalogFilter {
  if (value === "archived" || value === "all") return value;
  return "active";
}

export default async function AdminInventoryPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const currentPage = Math.max(1, Number.parseInt(searchValue(params, "page"), 10) || 1);
  const catalogFilter = readCatalogFilter(searchValue(params, "catalog"));
  const [policy, inventorySource, stockRequests] = await Promise.all([
    getAdminSettingsPolicy(),
    getCsvInventoryRows({ page: currentPage, pageSize: CSV_INVENTORY_PAGE_SIZE, catalogFilter }),
    listPendingStockRequestsForReview()
  ]);
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

      {stockRequests.length ? <AdminStockRequestReviewPanel items={stockRequests} /> : null}

      <InventoryManager
        rows={rows}
        action={saveAdminInventoryWithFeedback}
        adjustAction={saveInventoryAdjustmentWithFeedback}
        importAction={importAdminInventoryWithFeedback}
        bulkAction={bulkAdminInventoryWithFeedback}
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
