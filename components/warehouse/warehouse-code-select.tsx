type WarehouseCodeSelectProps = {
  name?: string;
  warehouses: Array<{ code: string; name: string }>;
  defaultValue: string;
  className?: string;
  required?: boolean;
  label?: string;
};

export function WarehouseCodeSelect({
  name = "warehouse_code",
  warehouses,
  defaultValue,
  className = "h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100",
  required = true,
  label = "Warehouse"
}: WarehouseCodeSelectProps) {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-500">
      {label}
      <select name={name} defaultValue={defaultValue} required={required} className={className}>
        {warehouses.map((warehouse) => (
          <option key={warehouse.code} value={warehouse.code}>
            {warehouse.name} ({warehouse.code})
          </option>
        ))}
      </select>
    </label>
  );
}
