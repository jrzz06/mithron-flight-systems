import { redirect } from "next/navigation";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { InventoryManager } from "@/components/admin/inventory-manager";
import { CSV_INVENTORY_PAGE_SIZE, getCsvInventoryRows } from "@/services/csv-inventory-source";
import {
  deleteInventoryProductFormAction,
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

async function saveAdminInventoryWithFeedback(formData: FormData) {
  "use server";
  try {
    await saveInventoryQuickEditFormAction(formData);
  } catch (error) {
    redirect(`/admin/inventory?inventory_status=error&inventory_message=${encodeURIComponent(inventoryActionMessage(error).slice(0, 240))}`);
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
  const inventorySource = await getCsvInventoryRows({ page: currentPage, pageSize: CSV_INVENTORY_PAGE_SIZE });
  const inventoryStatus = searchValue(params, "inventory_status");
  const inventoryMessage = searchValue(params, "inventory_message");
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

      <InventoryManager
        rows={rows}
        action={saveAdminInventoryWithFeedback}
        importAction={importAdminInventoryWithFeedback}
        bulkAction={bulkAdminInventoryWithFeedback}
        deleteAction={deleteAdminInventoryWithFeedback}
        exportHref="/admin/inventory/export"
        title="Inventory"
        page={inventorySource.page}
        hasNextPage={inventorySource.hasNextPage}
        previousPageHref={previousPageHref}
        nextPageHref={nextPageHref}
      />
    </div>
  );
}
