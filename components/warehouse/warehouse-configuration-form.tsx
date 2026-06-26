import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { Input } from "@/components/platform/form-field";
import { WarehouseCodeSelect } from "@/components/warehouse/warehouse-code-select";
import type { WarehouseConfiguration } from "@/services/warehouse-config";
import { saveWarehouseConfigurationFormAction } from "@/app/warehouse/actions";

type WarehouseConfigurationFormProps = {
  config: WarehouseConfiguration;
  warehouses: Array<{ code: string; name: string }>;
  carrierNames: string[];
  saveAction?: (formData: FormData) => void | Promise<void>;
};

const fieldLabelClass = "platform-type-caption font-medium";

export function WarehouseConfigurationForm({ config, warehouses, carrierNames, saveAction }: WarehouseConfigurationFormProps) {
  return (
    <form action={saveAction ?? saveWarehouseConfigurationFormAction} data-warehouse-configuration className="grid gap-5">
      <p className="platform-type-body">
        Global warehouse defaults are stored in the database and used by allocation, checkout reservations, and supplier intake.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
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

      <label className="flex items-center justify-between gap-3 rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3 text-sm text-[var(--platform-text-primary)]">
        Reserve stock when allocating orders
        <input
          type="checkbox"
          name="auto_reserve_on_allocate"
          defaultChecked={config.autoReserveOnAllocate}
          className="h-4 w-4 accent-[var(--platform-accent)]"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={fieldLabelClass}>Default carrier</span>
          <Input name="default_carrier" defaultValue={config.defaultCarrier} list="warehouse-config-carrier-options" />
          <datalist id="warehouse-config-carrier-options">
            {carrierNames.map((carrier) => <option key={carrier} value={carrier} />)}
          </datalist>
        </label>
        <label className="grid gap-1.5">
          <span className={fieldLabelClass}>Barcode prefix</span>
          <Input name="barcode_prefix" defaultValue={config.barcodePrefix} />
        </label>
        <label className="grid gap-1.5">
          <span className={fieldLabelClass}>Printer name (default)</span>
          <Input name="printer_name" defaultValue={config.printerName} placeholder="Warehouse label printer" />
        </label>
        <label className="grid gap-1.5">
          <span className={fieldLabelClass}>Label width (mm)</span>
          <Input name="label_width_mm" type="number" min={40} max={200} defaultValue={config.labelWidthMm} />
        </label>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3 text-sm text-[var(--platform-text-primary)]">
        Require item scan before pack
        <input
          type="checkbox"
          name="require_item_scan"
          defaultChecked={config.requireItemScan}
          className="h-4 w-4 accent-[var(--platform-accent)]"
        />
      </label>

      <OperationalSubmitButton pendingLabel="Saving">
        Save warehouse configuration
      </OperationalSubmitButton>
    </form>
  );
}
