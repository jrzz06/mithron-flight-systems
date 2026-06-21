import { getSupabaseAdminConfig } from "@/lib/env";
import { buildSimpleInventoryRows, type SimpleInventoryRow } from "@/services/simple-inventory-view";

type EnvSource = Record<string, string | undefined>;
type AdminRow = Record<string, unknown>;

type CsvInventoryResult = {
  rows: SimpleInventoryRow[];
  blockedReason?: string;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
};

export const CSV_INVENTORY_PAGE_SIZE = 80;
const CSV_INVENTORY_EXPORT_LIMIT = 1000;

type CsvInventoryOptions = {
  env?: EnvSource;
  page?: number;
  pageSize?: number;
  all?: boolean;
};

function isOptions(value: EnvSource | CsvInventoryOptions): value is CsvInventoryOptions {
  return "env" in value || "page" in value || "pageSize" in value || "all" in value;
}

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function columnInFilter(column: string, slugs: string[]) {
  return `${column}=in.(${slugs.map((slug) => encodeURIComponent(slug)).join(",")})`;
}

function getAdminHeaders(config: Extract<ReturnType<typeof getSupabaseAdminConfig>, { configured: true }>) {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

async function fetchRows<T extends AdminRow>(
  config: Extract<ReturnType<typeof getSupabaseAdminConfig>, { configured: true }>,
  table: string,
  query: string
) {
  const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
    headers: getAdminHeaders(config),
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = (await response.text()).trim().slice(0, 240);
    throw new Error(
      `${table} read failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`
    );
  }

  return (await response.json()) as T[];
}

export async function getCsvInventoryRows(input: EnvSource | CsvInventoryOptions = process.env): Promise<CsvInventoryResult> {
  const options = isOptions(input) ? input : { env: input };
  const env = options.env ?? process.env;
  const page = positiveInteger(options.page, 1);
  const pageSize = options.all ? CSV_INVENTORY_EXPORT_LIMIT : Math.min(positiveInteger(options.pageSize, CSV_INVENTORY_PAGE_SIZE), CSV_INVENTORY_PAGE_SIZE);
  const offset = options.all ? 0 : (page - 1) * pageSize;
  const productLimit = options.all ? CSV_INVENTORY_EXPORT_LIMIT : pageSize + 1;
  const config = getSupabaseAdminConfig(env);
  if (!config.configured) {
    return { rows: [], blockedReason: config.message, page, pageSize, hasNextPage: false };
  }

  try {
    const inventoryPage = await fetchRows<AdminRow>(
      config,
      "inventory",
      [
        "select=id,product_slug,sku,variant_id,stock_status,quantity,reserved_quantity,reorder_threshold,updated_at,created_at",
        "order=updated_at.desc",
        `limit=${productLimit}`,
        `offset=${offset}`
      ].join("&")
    );
    const inventory = options.all ? inventoryPage : inventoryPage.slice(0, pageSize);
    const hasNextPage = !options.all && inventoryPage.length > pageSize;
    const inventorySlugs = new Set(inventory.map((row) => String(row.product_slug ?? "")).filter(Boolean));
    if (!inventorySlugs.size) {
      return { rows: [], page, pageSize, hasNextPage: false };
    }
    const relationLimit = options.all ? CSV_INVENTORY_EXPORT_LIMIT : pageSize * 4;
    const inventorySlugList = Array.from(inventorySlugs);
    const productSlugFilter = columnInFilter("slug", inventorySlugList);
    const warehouseSlugFilter = columnInFilter("product_slug", inventorySlugList);

    const [products, stock] = await Promise.all([
      fetchRows<AdminRow>(
        config,
        "mithron_products",
        [
          "select=slug,name,category,price,image,hero,workflow_status,archived_at,is_visible,updated_at",
          productSlugFilter,
          `limit=${relationLimit}`
        ].join("&")
      ),
      fetchRows<AdminRow>(
        config,
        "warehouse_stock",
        [
          "select=id,warehouse_code,product_slug,sku,variant_id,available_quantity,committed_quantity,last_counted_at,updated_at,created_at",
          warehouseSlugFilter,
          "order=updated_at.desc",
          `limit=${relationLimit}`
        ].join("&")
      )
    ]);

    return {
      page,
      pageSize,
      hasNextPage,
      rows: buildSimpleInventoryRows(
        products.filter((row) => inventorySlugs.has(String(row.slug ?? ""))),
        inventory.filter((row) => inventorySlugs.has(String(row.product_slug ?? ""))),
        stock.filter((row) => inventorySlugs.has(String(row.product_slug ?? "")))
      )
    };
  } catch (error) {
    return {
      rows: [],
      page,
      pageSize,
      hasNextPage: false,
      blockedReason: error instanceof Error ? error.message : String(error)
    };
  }
}
