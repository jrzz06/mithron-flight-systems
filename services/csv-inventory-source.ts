import { getSupabaseAdminConfig } from "@/lib/env";
import { buildSimpleInventoryRows, type SimpleInventoryRow } from "@/services/simple-inventory-view";
import { getDefaultWarehouseCode } from "@/services/warehouse-config";
import { countProductsMissingInventoryRecords as countMissingInventoryRecords } from "@/services/product-inventory-sync";

export { countMissingInventoryRecords as countProductsMissingInventoryRecords };

type EnvSource = Record<string, string | undefined>;
type AdminRow = Record<string, unknown>;

type CsvInventoryResult = {
  rows: SimpleInventoryRow[];
  blockedReason?: string;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  totalProductCount: number;
};

export const CSV_INVENTORY_PAGE_SIZE = 80;
const CSV_INVENTORY_EXPORT_LIMIT = 1000;

type CsvInventoryOptions = {
  env?: EnvSource;
  page?: number;
  pageSize?: number;
  all?: boolean;
  publishedOnly?: boolean;
};

const ACTIVE_PRODUCT_FILTER = "workflow_status=eq.published&is_visible=eq.true&archived_at=is.null&merge_status=neq.archived_merged";

function isOptions(value: EnvSource | CsvInventoryOptions): value is CsvInventoryOptions {
  return "env" in value || "page" in value || "pageSize" in value || "all" in value || "publishedOnly" in value;
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

async function countAllProducts(
  config: Extract<ReturnType<typeof getSupabaseAdminConfig>, { configured: true }>,
  publishedOnly = false
) {
  const query = publishedOnly ? `select=slug&${ACTIVE_PRODUCT_FILTER}` : "select=slug";
  const response = await fetch(`${config.url}/rest/v1/mithron_products?${query}`, {
    headers: {
      ...getAdminHeaders(config),
      Prefer: "count=exact"
    },
    cache: "no-store"
  });
  if (!response.ok) return 0;
  const contentRange = response.headers.get("content-range");
  if (!contentRange) {
    const rows = await response.json() as AdminRow[];
    return rows.length;
  }
  const total = contentRange.split("/")[1];
  return Number(total) || 0;
}

export async function getCsvInventoryRows(input: EnvSource | CsvInventoryOptions = process.env): Promise<CsvInventoryResult> {
  const options = isOptions(input) ? input : { env: input };
  const env = options.env ?? process.env;
  const page = positiveInteger(options.page, 1);
  const pageSize = options.all ? CSV_INVENTORY_EXPORT_LIMIT : Math.min(positiveInteger(options.pageSize, CSV_INVENTORY_PAGE_SIZE), CSV_INVENTORY_PAGE_SIZE);
  const offset = options.all ? 0 : (page - 1) * pageSize;
  const productLimit = options.all ? CSV_INVENTORY_EXPORT_LIMIT : pageSize + 1;
  const publishedOnly = options.publishedOnly === true;
  const config = getSupabaseAdminConfig(env);
  if (!config.configured) {
    return { rows: [], blockedReason: config.message, page, pageSize, hasNextPage: false, totalProductCount: 0 };
  }

  try {
    const productQuery = [
      "select=slug,name,category,price,image,hero,workflow_status,archived_at,is_visible,merge_status,supplier_id,updated_at",
      publishedOnly ? ACTIVE_PRODUCT_FILTER : "",
      "order=sort_order.asc",
      `limit=${productLimit}`,
      options.all ? "" : `offset=${offset}`
    ].filter(Boolean).join("&");

    const [productsPage, totalProductCount] = await Promise.all([
      fetchRows<AdminRow>(config, "mithron_products", productQuery),
      countAllProducts(config, publishedOnly)
    ]);

    const activeProducts = publishedOnly
      ? productsPage
      : productsPage.filter((row) =>
        String(row.workflow_status ?? "") === "published"
        && row.archived_at == null
        && row.is_visible !== false
        && String(row.merge_status ?? "") !== "archived_merged"
      );
    const products = options.all ? activeProducts : activeProducts.slice(0, pageSize);
    const hasNextPage = !options.all && activeProducts.length > pageSize;
    const productSlugs = new Set(products.map((row) => String(row.slug ?? "")).filter(Boolean));
    if (!productSlugs.size) {
      return { rows: [], page, pageSize, hasNextPage: false, totalProductCount };
    }
    const relationLimit = options.all ? CSV_INVENTORY_EXPORT_LIMIT : pageSize * 4;
    const productSlugList = Array.from(productSlugs);
    const inventorySlugFilter = columnInFilter("product_slug", productSlugList);
    const warehouseSlugFilter = columnInFilter("product_slug", productSlugList);

    const [inventory, stock, defaultWarehouseCode, suppliers] = await Promise.all([
      fetchRows<AdminRow>(
        config,
        "inventory",
        [
          "select=id,product_slug,sku,variant_id,stock_status,quantity,reserved_quantity,reorder_threshold,updated_at,created_at",
          inventorySlugFilter,
          "order=updated_at.desc",
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
      ),
      getDefaultWarehouseCode(env),
      fetchRows<AdminRow>(config, "profiles", "select=id,display_name,email&limit=500")
    ]);

    const supplierNameById = new Map(
      suppliers.map((supplier) => [String(supplier.id ?? ""), String(supplier.display_name ?? supplier.email ?? "Supplier")])
    );
    const productsWithSupplier = products.map((product) => ({
      ...product,
      supplier_name: supplierNameById.get(String(product.supplier_id ?? "")) ?? ""
    }));

    return {
      page,
      pageSize,
      hasNextPage,
      totalProductCount,
      rows: buildSimpleInventoryRows(productsWithSupplier, inventory, stock, defaultWarehouseCode)
    };
  } catch (error) {
    return {
      rows: [],
      page,
      pageSize,
      hasNextPage: false,
      totalProductCount: 0,
      blockedReason: error instanceof Error ? error.message : String(error)
    };
  }
}

