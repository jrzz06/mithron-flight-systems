import { assertSupabaseAdminConfig } from "@/lib/env";

type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`
  };
}

export async function getActiveWarehouseCodes(env: EnvSource = process.env): Promise<string[]> {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/warehouses?select=code&is_active=eq.true&order=code.asc`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );

  if (!response.ok) {
    const fallback = env.DEFAULT_WAREHOUSE_CODE?.trim() || "IN-WEST-01";
    return [fallback];
  }

  const rows = (await response.json()) as Array<{ code?: string }>;
  const codes = rows.map((row) => String(row.code ?? "").trim()).filter(Boolean);
  if (!codes.length) {
    const fallback = env.DEFAULT_WAREHOUSE_CODE?.trim() || "IN-WEST-01";
    return [fallback];
  }
  return codes;
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
