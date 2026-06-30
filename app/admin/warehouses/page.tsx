import { ControlShell } from "@/components/admin/control-shell";
import { OperationalFeedback } from "@/components/admin/module-panel";
import { CreateWarehouseForm, WarehouseDirectory } from "@/components/admin/warehouse-management-panel";
import { createWarehouseFormAction } from "@/app/admin/warehouses/actions";
import { listAdminWarehouses } from "@/services/warehouses";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

export default async function AdminWarehousesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const warehouses = await listAdminWarehouses();
  const params = searchParams ? await searchParams : {};
  const status = value(params, "warehouse_status");
  const message = value(params, "warehouse_message");

  return (
    <div data-warehouse-management-shell className="grid gap-4">
      <ControlShell
        eyebrow="Fulfillment"
        title="Warehouses"
        description="Physical warehouse sites stored in the database. Operators are assigned to exactly one site."
        actions={[{ label: "Users", href: "/admin/users" }]}
      >
        <OperationalFeedback
          status={status}
          message={message}
          context="Warehouse"
          idle="Warehouse creation and assignment results appear here."
        />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <WarehouseDirectory warehouses={warehouses.filter((warehouse) => warehouse.isActive)} />
          <CreateWarehouseForm action={createWarehouseFormAction} />
        </div>
      </ControlShell>
    </div>
  );
}
