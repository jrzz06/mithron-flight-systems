import { cache } from "react";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { listActiveWarehouses } from "@/services/warehouses";

type EnvSource = Record<string, string | undefined>;

export type WarehouseConfiguration = {
  defaultWarehouseCode: string;
  checkoutWarehouseCode: string;
  supplierIntakeWarehouseCode: string;
  autoReserveOnAllocate: boolean;
  defaultCarrier: string;
  barcodePrefix: string;
  printerName: string;
  labelWidthMm: number;
  requireItemScan: boolean;
};

type WarehouseConfigurationRow = {
  default_warehouse_code?: string | null;
  checkout_warehouse_code?: string | null;
  supplier_intake_warehouse_code?: string | null;
  auto_reserve_on_allocate?: boolean | null;
  default_carrier?: string | null;
  barcode_prefix?: string | null;
  printer_name?: string | null;
  label_width_mm?: number | null;
  require_item_scan?: boolean | null;
};

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };
}

async function loadWarehouseConfigurationRow(env: EnvSource = process.env): Promise<WarehouseConfigurationRow | null> {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/warehouse_configuration?id=eq.global&select=default_warehouse_code,checkout_warehouse_code,supplier_intake_warehouse_code,auto_reserve_on_allocate,default_carrier,barcode_prefix,printer_name,label_width_mm,require_item_scan&limit=1`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as WarehouseConfigurationRow[];
  return rows[0] ?? null;
}

async function resolveConfiguredWarehouseCode(
  preferred: string | null | undefined,
  env: EnvSource
) {
  const normalized = preferred?.trim();
  if (normalized) return normalized;

  const envDefault = env.DEFAULT_WAREHOUSE_CODE?.trim();
  if (envDefault) return envDefault;

  const warehouses = await listActiveWarehouses(env);
  const first = warehouses[0]?.code?.trim();
  if (first) return first;

  throw new Error("No active warehouse is configured. Add a warehouse and set warehouse_configuration.default_warehouse_code.");
}

export const getWarehouseConfiguration = cache(async (env: EnvSource = process.env): Promise<WarehouseConfiguration> => {
  const row = await loadWarehouseConfigurationRow(env);
  const defaultWarehouseCode = await resolveConfiguredWarehouseCode(row?.default_warehouse_code, env);
  const checkoutWarehouseCode = await resolveConfiguredWarehouseCode(
    row?.checkout_warehouse_code ?? defaultWarehouseCode,
    env
  );
  const supplierIntakeWarehouseCode = await resolveConfiguredWarehouseCode(
    row?.supplier_intake_warehouse_code ?? defaultWarehouseCode,
    env
  );

  return {
    defaultWarehouseCode,
    checkoutWarehouseCode,
    supplierIntakeWarehouseCode,
    autoReserveOnAllocate: row?.auto_reserve_on_allocate !== false,
    defaultCarrier: row?.default_carrier?.trim() || "Mithron Field",
    barcodePrefix: row?.barcode_prefix?.trim() || "MTH-",
    printerName: row?.printer_name?.trim() || "",
    labelWidthMm: Number(row?.label_width_mm ?? 100) || 100,
    requireItemScan: row?.require_item_scan !== false
  };
});

export async function getDefaultWarehouseCode(env: EnvSource = process.env) {
  const config = await getWarehouseConfiguration(env);
  return config.defaultWarehouseCode;
}

export async function getCheckoutWarehouseCode(env: EnvSource = process.env) {
  const config = await getWarehouseConfiguration(env);
  return config.checkoutWarehouseCode;
}

export async function getSupplierIntakeWarehouseCode(env: EnvSource = process.env) {
  const config = await getWarehouseConfiguration(env);
  return config.supplierIntakeWarehouseCode;
}

export type WarehouseConfigurationInput = {
  defaultWarehouseCode: string;
  checkoutWarehouseCode: string;
  supplierIntakeWarehouseCode: string;
  autoReserveOnAllocate: boolean;
  defaultCarrier: string;
  barcodePrefix: string;
  printerName: string;
  labelWidthMm: number;
  requireItemScan: boolean;
};

export function parseWarehouseConfigurationFormData(formData: FormData): WarehouseConfigurationInput {
  const labelWidth = Number(formData.get("label_width_mm") ?? "100");
  return {
    defaultWarehouseCode: String(formData.get("default_warehouse_code") ?? "").trim(),
    checkoutWarehouseCode: String(formData.get("checkout_warehouse_code") ?? "").trim(),
    supplierIntakeWarehouseCode: String(formData.get("supplier_intake_warehouse_code") ?? "").trim(),
    autoReserveOnAllocate: formData.get("auto_reserve_on_allocate") === "on",
    defaultCarrier: String(formData.get("default_carrier") ?? "Mithron Field").trim() || "Mithron Field",
    barcodePrefix: String(formData.get("barcode_prefix") ?? "MTH-").trim() || "MTH-",
    printerName: String(formData.get("printer_name") ?? "").trim(),
    labelWidthMm: Number.isFinite(labelWidth) && labelWidth > 0 ? labelWidth : 100,
    requireItemScan: formData.get("require_item_scan") === "on"
  };
}
