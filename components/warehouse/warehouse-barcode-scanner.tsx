"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Input } from "@/components/platform/form-field";
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
    <form
      onSubmit={submit}
      className="sticky top-3 z-20 grid gap-3 rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-raised)] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
    >
      <Input
        ref={inputRef}
        name="scan"
        aria-label="Scan SKU or order"
        value={scanValue}
        onChange={(event) => setScanValue(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button type="submit" className="platform-btn-primary platform-btn-sm md:min-w-[140px]">
        Scan lookup
      </button>
      {message ? <p className="platform-type-caption md:col-span-2">{message}</p> : null}
    </form>
  );
}
