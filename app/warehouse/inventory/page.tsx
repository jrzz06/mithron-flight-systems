import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { InventoryManager } from "@/components/admin/inventory-manager-loader";
import { inventoryFeedbackQueryParams } from "@/lib/admin/conflict-handling";
import { CSV_INVENTORY_PAGE_SIZE, getCsvInventoryRows } from "@/services/csv-inventory-source";
import {
  deleteInventoryProductFormAction,
  importInventoryCsvFormAction,
  saveInventoryBulkUpdateFormAction,
  saveInventoryQuickEditFormAction
} from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function inventoryActionMessage(error: unknown) {
  return inventoryFeedbackQueryParams(error).get("inventory_message") ?? "Inventory update failed.";
}

async function saveWarehouseInventoryWithFeedback(formData: FormData) {
  "use server";
  try {
    await saveInventoryQuickEditFormAction(formData);
  } catch (error) {
    const params = inventoryFeedbackQueryParams(error);
    redirect(`/warehouse/inventory?${params.toString()}`);
  }
  redirect("/warehouse/inventory?inventory_status=success&inventory_message=Inventory%20updated.");
}

async function importWarehouseInventoryWithFeedback(formData: FormData) {
  "use server";
  try {
    await importInventoryCsvFormAction(formData);
  } catch (error) {
    redirect(`/warehouse/inventory?inventory_status=error&inventory_message=${encodeURIComponent(inventoryActionMessage(error).slice(0, 240))}`);
  }
  redirect("/warehouse/inventory?inventory_status=success&inventory_message=Inventory%20imported.");
}

async function bulkWarehouseInventoryWithFeedback(formData: FormData) {
  "use server";
  try {
    await saveInventoryBulkUpdateFormAction(formData);
  } catch (error) {
    redirect(`/warehouse/inventory?inventory_status=error&inventory_message=${encodeURIComponent(inventoryActionMessage(error).slice(0, 240))}`);
  }
  redirect("/warehouse/inventory?inventory_status=success&inventory_message=Bulk%20inventory%20updated.");
}

async function deleteWarehouseInventoryWithFeedback(formData: FormData) {
  "use server";
  try {
    await deleteInventoryProductFormAction(formData);
  } catch (error) {
    redirect(`/warehouse/inventory?inventory_status=error&inventory_message=${encodeURIComponent(inventoryActionMessage(error).slice(0, 240))}`);
  }
  redirect("/warehouse/inventory?inventory_status=success&inventory_message=Inventory%20item%20deleted.");
}

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const currentPage = Math.max(1, Number.parseInt(searchValue(params, "page"), 10) || 1);
  const inventorySource = await getCsvInventoryRows({ page: currentPage, pageSize: CSV_INVENTORY_PAGE_SIZE });
  const inventoryStatus = searchValue(params, "inventory_status");
  const inventoryMessage = searchValue(params, "inventory_message");
  const rows = inventorySource.rows;
  const previousPageHref = currentPage > 1 ? `/warehouse/inventory?page=${currentPage - 1}` : undefined;
  const nextPageHref = inventorySource.hasNextPage ? `/warehouse/inventory?page=${currentPage + 1}` : undefined;

  return (
    <ControlShell
      eyebrow="Warehouse inventory"
      title="Supabase stock operations."
      description={inventorySource.blockedReason ?? "Supabase inventory records are the source of truth for warehouse stock."}
      metrics={[
        { label: "Rows", value: String(rows.length) },
        { label: "Page", value: String(inventorySource.page) },
        { label: "Status", value: inventorySource.blockedReason ? "blocked" : "live" }
      ]}
      actions={[
        { label: "Inventory", href: "/warehouse/inventory" },
        { label: "Shipments", href: "/warehouse/shipments" },
        { label: "Stock Movements", href: "/warehouse/movements" }
      ]}
    >
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
        action={saveWarehouseInventoryWithFeedback}
        importAction={importWarehouseInventoryWithFeedback}
        bulkAction={bulkWarehouseInventoryWithFeedback}
        deleteAction={deleteWarehouseInventoryWithFeedback}
        exportHref="/warehouse/inventory/export"
        title="Inventory"
        page={inventorySource.page}
        hasNextPage={inventorySource.hasNextPage}
        previousPageHref={previousPageHref}
        nextPageHref={nextPageHref}
      />
    </ControlShell>
  );
}
