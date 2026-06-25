import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const ACTIVE_PRODUCT_FILTER = "workflow_status=eq.published&is_visible=eq.true&archived_at=is.null&merge_status=neq.archived_merged";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase configuration.");
    process.exit(1);
  }

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };

  const [productsResponse, inventoryResponse, stockResponse] = await Promise.all([
    fetch(`${url}/rest/v1/mithron_products?select=slug&${ACTIVE_PRODUCT_FILTER}&limit=1000`, { headers }),
    fetch(`${url}/rest/v1/inventory?select=product_slug,sku,quantity,reserved_quantity&limit=2000`, { headers }),
    fetch(`${url}/rest/v1/warehouse_stock?select=product_slug,sku,available_quantity&limit=2000`, { headers })
  ]);

  const products = await productsResponse.json();
  const inventory = await inventoryResponse.json();
  const stock = await stockResponse.json();

  const productSlugs = new Set(products.map((row) => String(row.slug ?? "")).filter(Boolean));
  const inventorySlugs = new Set(inventory.map((row) => String(row.product_slug ?? "")).filter(Boolean));
  const missingProducts = [...productSlugs].filter((slug) => !inventorySlugs.has(slug));

  const duplicateInventory = inventory.reduce((map, row) => {
    const key = `${row.product_slug}:${row.sku}`;
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());
  const duplicateKeys = [...duplicateInventory.entries()].filter(([, count]) => count > 1).map(([key]) => key);

  const negativeInventory = inventory.filter((row) => Number(row.quantity ?? 0) < 0 || Number(row.reserved_quantity ?? 0) < 0);
  const negativeStock = stock.filter((row) => Number(row.available_quantity ?? 0) < 0);

  const report = {
    activeProducts: productSlugs.size,
    inventoryRows: inventory.length,
    missingInventoryForProducts: missingProducts.length,
    duplicateInventoryKeys: duplicateKeys.length,
    negativeInventoryRows: negativeInventory.length,
    negativeStockRows: negativeStock.length,
    synchronized: productSlugs.size === inventorySlugs.size && missingProducts.length === 0 && duplicateKeys.length === 0 && negativeInventory.length === 0 && negativeStock.length === 0
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.synchronized) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
