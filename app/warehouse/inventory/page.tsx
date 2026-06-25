import { redirect } from "next/navigation";
import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { WarehouseInventoryManager } from "@/components/warehouse/warehouse-inventory-manager";
import { inventoryFeedbackQueryParams } from "@/lib/admin/conflict-handling";
import { getCsvInventoryRows } from "@/services/csv-inventory-source";
import { saveInventoryQuickEditFormAction } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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

export default async function InventoryPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = searchParams ? await searchParams : {};
  const inventorySource = await getCsvInventoryRows({ all: true, publishedOnly: true });
  const inventoryStatus = searchValue(params, "inventory_status");
  const inventoryMessage = searchValue(params, "inventory_message");

  return (
    <ControlShell
      eyebrow=""
      title="Inventory"
      description="Current stock levels for all active products. Adjust quantities using the action buttons — every change is recorded."
      actions={[
        { label: "Orders", href: "/warehouse/orders" },
        { label: "Dispatch", href: "/warehouse/dispatch" }
      ]}
    >
      <div className="grid gap-6">
        <OperationalFeedback
          status={inventoryStatus}
          message={inventoryMessage}
          context="Inventory"
          idle="Stock updates and save messages appear here."
        />

        <WarehouseInventoryManager
          rows={inventorySource.rows}
          action={saveWarehouseInventoryWithFeedback}
          totalProductCount={inventorySource.totalProductCount}
        />
      </div>
    </ControlShell>
  );
}
