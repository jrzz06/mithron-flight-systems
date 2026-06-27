import { assertSupabaseAdminConfig, getSupabaseAdminConfig } from "@/lib/env";
import {
  createAdminRecord,
  fetchAdminRecordsByColumn,
  upsertInventoryRecord,
  upsertWarehouseStockRecord,
  type AdminMutationOptions
} from "@/services/admin-actions";
import { getDefaultWarehouseCode } from "@/services/warehouse-config";

type EnvSource = Record<string, string | undefined>;

const PAGE_SIZE = 500;

export function deriveProductSku(slug: string) {
  const cleaned = slug.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "SKU";
}

function adminHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

async function fetchPaginatedSlugs(
  config: Extract<ReturnType<typeof getSupabaseAdminConfig>, { configured: true }>,
  table: string,
  column: string
) {
  const values: string[] = [];
  let offset = 0;

  while (true) {
    const response = await fetch(
      `${config.url}/rest/v1/${table}?select=${column}&order=${column}.asc&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: adminHeaders(config.serviceRoleKey), cache: "no-store" }
    );
    if (!response.ok) {
      throw new Error(`Failed to load ${table} slugs: ${response.status}`);
    }
    const rows = (await response.json()) as Array<Record<string, unknown>>;
    if (!rows.length) break;
    for (const row of rows) {
      const value = String(row[column] ?? "").trim();
      if (value) values.push(value);
    }
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return values;
}

async function fetchInventorySlugs(
  config: Extract<ReturnType<typeof getSupabaseAdminConfig>, { configured: true }>
) {
  const slugs = new Set<string>();
  let offset = 0;

  while (true) {
    const response = await fetch(
      `${config.url}/rest/v1/inventory?select=product_slug&order=product_slug.asc&limit=${PAGE_SIZE}&offset=${offset}`,
      { headers: adminHeaders(config.serviceRoleKey), cache: "no-store" }
    );
    if (!response.ok) {
      throw new Error(`Failed to load inventory rows: ${response.status}`);
    }
    const rows = (await response.json()) as Array<Record<string, unknown>>;
    if (!rows.length) break;
    for (const row of rows) {
      const slug = String(row.product_slug ?? "").trim();
      if (slug) slugs.add(slug);
    }
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return slugs;
}

export async function listProductSlugsMissingInventory(env: EnvSource = process.env): Promise<string[]> {
  const config = getSupabaseAdminConfig(env);
  if (!config.configured) return [];

  const [productSlugs, inventorySlugs] = await Promise.all([
    fetchPaginatedSlugs(config, "mithron_products", "slug"),
    fetchInventorySlugs(config)
  ]);

  return productSlugs.filter((slug) => !inventorySlugs.has(slug));
}

export async function countProductsMissingInventoryRecords(env: EnvSource = process.env): Promise<number> {
  const missing = await listProductSlugsMissingInventory(env);
  return missing.length;
}

/** Seeds the supplier/catalog inventory row only — never touches warehouse_stock. */
export async function ensureProductCatalogInventoryRecord(
  slug: string,
  actorId: string | null,
  env: EnvSource = process.env,
  options: AdminMutationOptions = {}
) {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) {
    throw new Error("Product slug is required to seed catalog inventory.");
  }

  const sku = deriveProductSku(normalizedSlug);
  const timestamp = new Date().toISOString();

  const existingInventory = await fetchAdminRecordsByColumn("inventory", "product_slug", normalizedSlug, env);
  if (existingInventory.length > 0) return;

  const seedPayload = {
    product_slug: normalizedSlug,
    sku,
    stock_status: "out_of_stock",
    quantity: 0,
    reserved_quantity: 0,
    reorder_threshold: 0,
    updated_by: actorId,
    updated_at: timestamp
  };

  try {
    await createAdminRecord("inventory", seedPayload, actorId, env, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("code=23505") || message.includes("duplicate key")) {
      return;
    }
    throw error;
  }
}

/** Seeds warehouse_stock for fulfillment workflows — requires warehouse.write. */
export async function ensureWarehouseStockRecord(
  slug: string,
  actorId: string | null,
  env: EnvSource = process.env,
  options: AdminMutationOptions = {}
) {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) {
    throw new Error("Product slug is required to seed warehouse stock.");
  }

  const sku = deriveProductSku(normalizedSlug);
  const warehouseCode = await getDefaultWarehouseCode(env);
  const timestamp = new Date().toISOString();

  const existingStock = await fetchAdminRecordsByColumn("warehouse_stock", "product_slug", normalizedSlug, env);
  const hasWarehouseStock = existingStock.some(
    (row) => String(row.sku ?? "") === sku && String(row.warehouse_code ?? "") === warehouseCode
  );
  if (hasWarehouseStock) return;

  await upsertWarehouseStockRecord(
    {
      warehouse_code: warehouseCode,
      product_slug: normalizedSlug,
      sku,
      available_quantity: 0,
      committed_quantity: 0,
      updated_by: actorId,
      updated_at: timestamp
    },
    actorId,
    env,
    options
  );
}

/** Admin/warehouse repair path: ensures both catalog inventory and warehouse stock rows. */
export async function ensureProductInventoryRecord(
  slug: string,
  actorId: string | null,
  env: EnvSource = process.env,
  options: AdminMutationOptions = {}
) {
  await ensureProductCatalogInventoryRecord(slug, actorId, env, options);
  await ensureWarehouseStockRecord(slug, actorId, env, options);
}

/** @deprecated Use ensureProductCatalogInventoryRecord or ensureProductInventoryRecord */
export async function ensureInventoryForPublishedProduct(slug: string, actorId: string | null) {
  return ensureProductCatalogInventoryRecord(slug, actorId);
}

/** @deprecated Use ensureProductCatalogInventoryRecord or ensureProductInventoryRecord */
export async function ensureInventoryForProduct(slug: string, actorId: string | null) {
  return ensureProductCatalogInventoryRecord(slug, actorId);
}

export type RepairMissingInventoryResult = {
  created: number;
  failed: number;
  totalProducts: number;
  errors: string[];
};

export async function repairMissingProductInventory(
  actorId: string | null,
  env: EnvSource = process.env
): Promise<RepairMissingInventoryResult> {
  const config = assertSupabaseAdminConfig(env);

  const productSlugs = await fetchPaginatedSlugs(config, "mithron_products", "slug");
  const missing = await listProductSlugsMissingInventory(env);
  const errors: string[] = [];
  let created = 0;

  for (const slug of missing) {
    try {
      await ensureProductCatalogInventoryRecord(slug, actorId, env);
      created += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    created,
    failed: errors.length,
    totalProducts: productSlugs.length,
    errors
  };
}

type BackfillResult = {
  created: number;
  skipped: number;
  totalProducts: number;
};

export async function backfillMissingInventoryRows(
  actorId: string | null,
  env: Record<string, string | undefined> = process.env
): Promise<BackfillResult> {
  const result = await repairMissingProductInventory(actorId, env);
  return {
    created: result.created,
    skipped: result.totalProducts - result.created,
    totalProducts: result.totalProducts
  };
}
