import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

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
    "Content-Type": "application/json",
    Prefer: "count=exact"
  };

  const [productsCountResponse, inventoryCountResponse, productsResponse, inventoryResponse] = await Promise.all([
    fetch(`${url}/rest/v1/mithron_products?select=slug`, { method: "HEAD", headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/inventory?select=product_slug`, { method: "HEAD", headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/mithron_products?select=slug&limit=5000`, { headers, cache: "no-store" }),
    fetch(`${url}/rest/v1/inventory?select=product_slug&limit=5000`, { headers, cache: "no-store" })
  ]);

  const readCount = (response: Response) => {
    const range = response.headers.get("content-range");
    if (!range?.includes("/")) return 0;
    return Number(range.split("/").at(-1)) || 0;
  };

  const products = productsResponse.ok ? await productsResponse.json() : [];
  const inventory = inventoryResponse.ok ? await inventoryResponse.json() : [];

  const productSlugs = new Set(products.map((row: { slug?: string }) => String(row.slug ?? "").trim()).filter(Boolean));
  const inventorySlugCounts = inventory.reduce((map: Map<string, number>, row: { product_slug?: string }) => {
    const slug = String(row.product_slug ?? "").trim();
    if (!slug) return map;
    map.set(slug, (map.get(slug) ?? 0) + 1);
    return map;
  }, new Map<string, number>());

  const inventorySlugs = new Set(inventorySlugCounts.keys());
  const missingProducts = [...productSlugs].filter((slug) => !inventorySlugs.has(slug));
  const duplicateSlugs = [...inventorySlugCounts.entries()].filter(([, count]) => count > 1).map(([slug]) => slug);
  const orphanSlugs = [...inventorySlugs].filter((slug) => !productSlugs.has(slug));
  const archivedProducts = products.filter((row: { slug?: string; workflow_status?: string; archived_at?: string | null }) => {
    const slug = String(row.slug ?? "").trim();
    return slug && (String(row.workflow_status ?? "") === "archived" || row.archived_at);
  });
  const archivedMissingInventory = archivedProducts.filter((row: { slug?: string }) => !inventorySlugs.has(String(row.slug ?? "")));

  const productCount = readCount(productsCountResponse);
  const inventoryCount = readCount(inventoryCountResponse);

  const report = {
    productCount,
    inventoryCount,
    countsMatch: productCount === inventoryCount,
    missingInventoryForProducts: missingProducts.length,
    duplicateInventorySlugs: duplicateSlugs.length,
    orphanInventorySlugs: orphanSlugs.length,
    archivedProducts: archivedProducts.length,
    archivedMissingInventory: archivedMissingInventory.length,
    negativeInventoryRows: inventory.filter((row: { quantity?: number; reserved_quantity?: number }) =>
      Number(row.quantity ?? 0) < 0 || Number(row.reserved_quantity ?? 0) < 0
    ).length,
    synchronized:
      productCount === inventoryCount
      && missingProducts.length === 0
      && duplicateSlugs.length === 0
      && orphanSlugs.length === 0
      && archivedMissingInventory.length === 0
  };

  console.log(JSON.stringify(report, null, 2));
  if (!report.synchronized) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
