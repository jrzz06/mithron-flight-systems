import { assertSupabaseAdminConfig } from "@/lib/env";

type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };
}

export async function getActiveWarehouseCodes(env: EnvSource = process.env): Promise<string[]> {
  const warehouses = await listActiveWarehouses(env);
  return warehouses.map((warehouse) => warehouse.code);
}

export type WarehouseOption = {
  code: string;
  name: string;
};

export async function listActiveWarehouses(env: EnvSource = process.env): Promise<WarehouseOption[]> {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/warehouses?select=code,name&is_active=eq.true&order=code.asc`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );

  if (!response.ok) {
    const fallback = env.DEFAULT_WAREHOUSE_CODE?.trim() || "IN-WEST-01";
    return [{ code: fallback, name: "Primary warehouse" }];
  }

  const rows = (await response.json()) as Array<{ code?: string; name?: string }>;
  const warehouses = rows
    .map((row) => ({
      code: String(row.code ?? "").trim(),
      name: String(row.name ?? row.code ?? "").trim()
    }))
    .filter((row) => row.code);

  if (!warehouses.length) {
    const fallback = env.DEFAULT_WAREHOUSE_CODE?.trim() || "IN-WEST-01";
    return [{ code: fallback, name: "Primary warehouse" }];
  }

  return warehouses;
}

export async function assertValidWarehouseCode(code: string, env: EnvSource = process.env) {
  const normalized = code.trim();
  if (!normalized) {
    throw new Error("warehouse_code is required.");
  }

  const activeCodes = await getActiveWarehouseCodes(env);
  if (!activeCodes.includes(normalized)) {
    throw new Error(`Unknown warehouse_code "${normalized}". Valid codes: ${activeCodes.join(", ")}.`);
  }

  return normalized;
}
