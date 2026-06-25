import { redirect } from "next/navigation";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { InventoryManager } from "@/components/admin/inventory-manager-loader";
import { inventoryFeedbackQueryParams } from "@/lib/admin/conflict-handling";
import { CSV_INVENTORY_PAGE_SIZE, countProductsMissingInventoryRecords, getCsvInventoryRows } from "@/services/csv-inventory-source";
import { repairMissingProductInventory } from "@/services/product-inventory-sync";
import { getCurrentAuthContext } from "@/services/auth";
import { listPendingStockRequests } from "@/services/supplier-stock-requests";
import {
  deleteInventoryProductFormAction,
  importInventoryCsvFormAction,
  saveInventoryBulkUpdateFormAction,
  saveInventoryQuickEditFormAction
} from "@/app/warehouse/actions";
import { approveStockRequestAction, rejectStockRequestAction, syncMissingInventoryAction } from "./stock-request-actions";

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
  redirect("/admin/inventory?inventory_status=success&inventory_message=Inventory%20item%20deleted.");
}

export default async function AdminInventoryPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const currentPage = Math.max(1, Number.parseInt(searchValue(params, "page"), 10) || 1);
  const auth = await getCurrentAuthContext();
  let missingInventoryCount = await countProductsMissingInventoryRecords();
  if (missingInventoryCount > 0) {
    await repairMissingProductInventory(auth.userId).catch((error) => {
      console.error("[mithron-inventory] Auto-repair on inventory page failed.", error);
    });
    missingInventoryCount = await countProductsMissingInventoryRecords();
  }
  const inventorySource = await getCsvInventoryRows({ page: currentPage, pageSize: CSV_INVENTORY_PAGE_SIZE });
  const stockRequests = await listPendingStockRequests();
  const inventoryStatus = searchValue(params, "inventory_status");
  const inventoryMessage = searchValue(params, "inventory_message");
  const stockStatus = searchValue(params, "stock_status");
  const stockMessage = searchValue(params, "stock_message");
  const rows = inventorySource.rows;
  const previousPageHref = currentPage > 1 ? `/admin/inventory?page=${currentPage - 1}` : undefined;
  const nextPageHref = inventorySource.hasNextPage ? `/admin/inventory?page=${currentPage + 1}` : undefined;

  return (
    <div data-admin-inventory-route className="grid gap-4">
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

      {stockRequests.length ? (
        <section className="rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4">
          <h2 className="text-sm font-semibold text-[var(--platform-text-primary)]">Pending supplier stock requests</h2>
          <div className="mt-3 grid gap-2">
            {stockRequests.map((request) => (
              <div key={String(request.id)} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-[var(--platform-text-primary)]">{String(request.product_slug)}</p>
                  <p className="text-[var(--platform-text-secondary)]">
                    {String(request.current_quantity ?? "?")} → {String(request.requested_quantity)}
                    {request.note ? ` · ${String(request.note)}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={approveStockRequestAction}>
                    <input type="hidden" name="requestId" value={String(request.id)} />
                    <OperationalSubmitButton pendingLabel="Applying" className="text-xs">Approve</OperationalSubmitButton>
                  </form>
                  <form action={rejectStockRequestAction}>
                    <input type="hidden" name="requestId" value={String(request.id)} />
                    <OperationalSubmitButton pendingLabel="Rejecting" className="text-xs">Reject</OperationalSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <InventoryManager
        rows={rows}
        action={saveAdminInventoryWithFeedback}
        importAction={importAdminInventoryWithFeedback}
        bulkAction={bulkAdminInventoryWithFeedback}
        deleteAction={deleteAdminInventoryWithFeedback}
        exportHref="/admin/inventory/export"
        title="Inventory"
        page={inventorySource.page}
        totalProductCount={inventorySource.totalProductCount}
        hasNextPage={inventorySource.hasNextPage}
        previousPageHref={previousPageHref}
        nextPageHref={nextPageHref}
      />
    </div>
  );
}
