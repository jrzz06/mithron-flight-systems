"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  defaultWarehouseStationConfig,
  parseWarehouseStationConfig,
  serializeWarehouseStationConfig,
  WAREHOUSE_STATION_CONFIG_STORAGE_KEY,
  type WarehouseStationConfig
} from "@/services/warehouse-station-config";

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
    <form onSubmit={save} data-warehouse-station-settings className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm text-slate-300">
          Printer name
          <input
            value={config.printerName}
            onChange={(event) => setConfig((current) => ({ ...current, printerName: event.target.value }))}
            placeholder="Warehouse label printer"
            className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-300">
          Label width (mm)
          <input
            type="number"
            min={40}
            max={200}
            value={config.labelWidthMm}
            onChange={(event) => setConfig((current) => ({ ...current, labelWidthMm: Number(event.target.value) || 100 }))}
            className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-300">
          Barcode prefix
          <input
            value={config.barcodePrefix}
            onChange={(event) => setConfig((current) => ({ ...current, barcodePrefix: event.target.value }))}
            placeholder="MTH-"
            className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-300">
          Default carrier
          <input
            list="warehouse-carrier-options"
            value={config.defaultCarrier}
            onChange={(event) => setConfig((current) => ({ ...current, defaultCarrier: event.target.value }))}
            className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100"
          />
          <datalist id="warehouse-carrier-options">
            {initialCarrierNames.map((carrier) => <option key={carrier} value={carrier} />)}
          </datalist>
        </label>
      </div>

      <div className="grid gap-2">
        <label className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 py-2 text-sm text-slate-300">
          Require item scan before pack
          <input
            type="checkbox"
            checked={config.requireItemScan}
            onChange={(event) => setConfig((current) => ({ ...current, requireItemScan: event.target.checked }))}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 py-2 text-sm text-slate-300">
          Auto-open print dialog after slip generation
          <input
            type="checkbox"
            checked={config.autoPrintPackingSlip}
            onChange={(event) => setConfig((current) => ({ ...current, autoPrintPackingSlip: event.target.checked }))}
            className="h-4 w-4 accent-emerald-500"
          />
        </label>
      </div>

      <button type="submit" className="inline-flex h-10 w-fit items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-100">
        Save station settings
      </button>
      {savedMessage ? <p className="text-xs text-slate-400">{savedMessage}</p> : null}
      <p className="text-xs text-slate-500">Barcode scans accept order numbers, SKUs, and prefixed labels. Settings persist in this browser for picking and packing stations.</p>
    </form>
  );
}
