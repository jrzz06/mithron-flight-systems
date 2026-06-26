"use client";

import { FormEvent, useMemo, useState } from "react";
import { Input } from "@/components/platform/form-field";
import {
  defaultWarehouseStationConfig,
  parseWarehouseStationConfig,
  serializeWarehouseStationConfig,
  WAREHOUSE_STATION_CONFIG_STORAGE_KEY,
  type WarehouseStationConfig
} from "@/services/warehouse-station-config";

const fieldLabelClass = "platform-type-label text-sm";

export function WarehouseStationSettingsForm({
  initialCarrierNames,
  serverDefaults
}: {
  initialCarrierNames: string[];
  serverDefaults?: Partial<WarehouseStationConfig>;
}) {
  const mergedDefaults = useMemo(
    () => ({ ...defaultWarehouseStationConfig(), ...serverDefaults }),
    [serverDefaults]
  );
  const [config, setConfig] = useState<WarehouseStationConfig>(() => {
    if (typeof window === "undefined") return mergedDefaults;
    try {
      const raw = window.localStorage.getItem(WAREHOUSE_STATION_CONFIG_STORAGE_KEY);
      if (raw) {
        return { ...mergedDefaults, ...parseWarehouseStationConfig(JSON.parse(raw)) };
      }
    } catch {
      // fall through to merged defaults
    }
    return mergedDefaults;
  });
  const [savedMessage, setSavedMessage] = useState("");

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.localStorage.setItem(WAREHOUSE_STATION_CONFIG_STORAGE_KEY, serializeWarehouseStationConfig(config));
    setSavedMessage("Station settings saved on this device.");
  }

  return (
    <form onSubmit={save} data-warehouse-station-settings className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className={fieldLabelClass}>Printer name</span>
          <Input
            value={config.printerName}
            onChange={(event) => setConfig((current) => ({ ...current, printerName: event.target.value }))}
            placeholder="Warehouse label printer"
          />
        </label>
        <label className="grid gap-1.5">
          <span className={fieldLabelClass}>Label width (mm)</span>
          <Input
            type="number"
            min={40}
            max={200}
            value={config.labelWidthMm}
            onChange={(event) => setConfig((current) => ({ ...current, labelWidthMm: Number(event.target.value) || 100 }))}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={fieldLabelClass}>Barcode prefix</span>
          <Input
            value={config.barcodePrefix}
            onChange={(event) => setConfig((current) => ({ ...current, barcodePrefix: event.target.value }))}
            placeholder="MTH-"
          />
        </label>
        <label className="grid gap-1.5">
          <span className={fieldLabelClass}>Default carrier</span>
          <Input
            list="warehouse-carrier-options"
            value={config.defaultCarrier}
            onChange={(event) => setConfig((current) => ({ ...current, defaultCarrier: event.target.value }))}
          />
          <datalist id="warehouse-carrier-options">
            {initialCarrierNames.map((carrier) => <option key={carrier} value={carrier} />)}
          </datalist>
        </label>
      </div>

      <div className="grid gap-2">
        <label className="flex items-center justify-between gap-3 rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3 text-sm text-[var(--platform-text-primary)]">
          Require item scan before pack
          <input
            type="checkbox"
            checked={config.requireItemScan}
            onChange={(event) => setConfig((current) => ({ ...current, requireItemScan: event.target.checked }))}
            className="h-4 w-4 accent-[var(--platform-accent)]"
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3 text-sm text-[var(--platform-text-primary)]">
          Auto-open print dialog after slip generation
          <input
            type="checkbox"
            checked={config.autoPrintPackingSlip}
            onChange={(event) => setConfig((current) => ({ ...current, autoPrintPackingSlip: event.target.checked }))}
            className="h-4 w-4 accent-[var(--platform-accent)]"
          />
        </label>
      </div>

      <button type="submit" className="platform-btn-primary platform-btn-md">
        Save station settings
      </button>
      {savedMessage ? <p className="platform-type-caption text-[var(--platform-success)]">{savedMessage}</p> : null}
      <p className="platform-type-caption">Barcode scans accept order numbers, SKUs, and prefixed labels. Settings persist in this browser for picking and packing stations.</p>
    </form>
  );
}
