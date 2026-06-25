import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { WarehouseCodeSelect } from "@/components/warehouse/warehouse-code-select";
import type { WarehouseConfiguration } from "@/services/warehouse-config";
import { saveWarehouseConfigurationFormAction } from "@/app/warehouse/actions";

type WarehouseConfigurationFormProps = {
  config: WarehouseConfiguration;
  warehouses: Array<{ code: string; name: string }>;
  carrierNames: string[];
  saveAction?: (formData: FormData) => void | Promise<void>;
};

export function WarehouseConfigurationForm({ config, warehouses, carrierNames, saveAction }: WarehouseConfigurationFormProps) {
  return (
    <form action={saveAction ?? saveWarehouseConfigurationFormAction} data-warehouse-configuration className="grid gap-4">
      <p className="text-sm text-slate-500">
        Global warehouse defaults are stored in the database and used by allocation, checkout reservations, and supplier intake.
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <WarehouseCodeSelect
          name="default_warehouse_code"
          warehouses={warehouses}
          defaultValue={config.defaultWarehouseCode}
          label="Default warehouse"
        />
        <WarehouseCodeSelect
          name="checkout_warehouse_code"
          warehouses={warehouses}
          defaultValue={config.checkoutWarehouseCode}
          label="Checkout warehouse"
        />
        <WarehouseCodeSelect
          name="supplier_intake_warehouse_code"
          warehouses={warehouses}
          defaultValue={config.supplierIntakeWarehouseCode}
          label="Supplier intake warehouse"
        />
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 py-2 text-sm text-slate-300">
        Reserve stock when allocating orders
        <input
          type="checkbox"
          name="auto_reserve_on_allocate"
          defaultChecked={config.autoReserveOnAllocate}
          className="h-4 w-4 accent-emerald-500"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium text-slate-500">
          Default carrier
          <input
            name="default_carrier"
            defaultValue={config.defaultCarrier}
            list="warehouse-config-carrier-options"
            className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100"
          />
          <datalist id="warehouse-config-carrier-options">
            {carrierNames.map((carrier) => <option key={carrier} value={carrier} />)}
          </datalist>
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-500">
          Barcode prefix
          <input
            name="barcode_prefix"
            defaultValue={config.barcodePrefix}
            className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-500">
          Printer name (default)
          <input
            name="printer_name"
            defaultValue={config.printerName}
            placeholder="Warehouse label printer"
            className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-500">
          Label width (mm)
          <input
            name="label_width_mm"
            type="number"
            min={40}
            max={200}
            defaultValue={config.labelWidthMm}
            className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100"
          />
        </label>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 py-2 text-sm text-slate-300">
        Require item scan before pack
        <input
          type="checkbox"
          name="require_item_scan"
          defaultChecked={config.requireItemScan}
          className="h-4 w-4 accent-emerald-500"
        />
      </label>

      <OperationalSubmitButton pendingLabel="Saving" className="inline-flex h-10 w-fit items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100">
        Save warehouse configuration
      </OperationalSubmitButton>
    </form>
  );
}
