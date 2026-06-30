import { ControlShell } from "@/components/admin/control-shell";
import { WarehouseInventoryManager } from "@/components/warehouse/warehouse-inventory-manager";
import { getCsvInventoryRows } from "@/services/csv-inventory-source";
import { getCurrentAuthContext } from "@/services/auth";
import { resolveWarehouseScope } from "@/services/warehouse-scope";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const auth = await getCurrentAuthContext();
  const scope = await resolveWarehouseScope({ userId: auth.userId, role: auth.role });
  const inventorySource = await getCsvInventoryRows({ all: true, publishedOnly: true });
  const rows = scope.isGlobal
    ? inventorySource.rows
    : inventorySource.rows.filter((row) => row.warehouseCode === scope.warehouseCode);

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
      <div className="grid gap-6">
        <WarehouseInventoryManager
          rows={rows}
          totalProductCount={inventorySource.totalProductCount}
          readOnly
        />
      </div>
    </ControlShell>
  );
}
