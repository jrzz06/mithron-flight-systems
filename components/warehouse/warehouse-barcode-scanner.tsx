"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { matchPickingScan, normalizeBarcodeScan, type PickingScanTarget } from "@/services/warehouse-barcode";
import { WAREHOUSE_STATION_CONFIG_STORAGE_KEY, parseWarehouseStationConfig } from "@/services/warehouse-station-config";

type WarehouseBarcodeScannerProps = {
  targets: PickingScanTarget[];
  onMatch?: (orderId: string) => void;
  placeholder?: string;
};

export function WarehouseBarcodeScanner({
  targets,
  onMatch,
  placeholder = "Scan order number or SKU"
}: WarehouseBarcodeScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanValue, setScanValue] = useState("");
  const [message, setMessage] = useState("");
  const [prefix] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const raw = window.localStorage.getItem(WAREHOUSE_STATION_CONFIG_STORAGE_KEY);
      if (!raw) return "";
      return parseWarehouseStationConfig(JSON.parse(raw)).barcodePrefix;
    } catch {
      return "";
    }
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const match = matchPickingScan(scanValue, targets, prefix);
    if (!match) {
      setMessage(`No picking match for "${normalizeBarcodeScan(scanValue)}".`);
      return;
    }
    setMessage(`Matched ${match.kind === "order" ? "order" : "SKU"} ${match.target.orderNumber}.`);
    onMatch?.(match.orderId);
    setScanValue("");
    inputRef.current?.focus();
  }

  return (
    <form onSubmit={submit} className="sticky top-3 z-20 grid gap-2 rounded-xl border border-white/[0.06] bg-[#10151d]/95 p-3 backdrop-blur-sm md:grid-cols-[minmax(0,1fr)_180px] md:items-center">
      <input
        ref={inputRef}
        name="scan"
        aria-label="Scan SKU or order"
        value={scanValue}
        onChange={(event) => setScanValue(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-10 rounded-lg border border-white/[0.06] bg-[#0b1017] px-3 text-sm text-slate-100 outline-none focus:border-emerald-400/70"
      />
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-lg border border-emerald-400/15 bg-emerald-400/10 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-200"
      >
        Scan lookup
      </button>
      {message ? <p className="md:col-span-2 text-xs text-slate-400">{message}</p> : null}
    </form>
  );
}
