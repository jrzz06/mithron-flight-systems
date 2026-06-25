import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const ACTIVE_PRODUCT_FILTER = "workflow_status=eq.published&is_visible=eq.true&archived_at=is.null&merge_status=neq.archived_merged";

function deriveProductSku(slug) {
  const cleaned = slug.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "SKU";
}

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
    Prefer: "return=representation"
  };

  const warehouseCode = process.env.DEFAULT_WAREHOUSE_CODE || "MAIN";
  const productsResponse = await fetch(`${url}/rest/v1/mithron_products?select=slug&${ACTIVE_PRODUCT_FILTER}&limit=1000`, { headers });
  const products = await productsResponse.json();
  const inventoryResponse = await fetch(`${url}/rest/v1/inventory?select=product_slug&limit=2000`, { headers });
  const inventoryRows = await inventoryResponse.json();
  const inventorySlugs = new Set(inventoryRows.map((row) => String(row.product_slug ?? "")).filter(Boolean));

  let created = 0;
  for (const product of products) {
    const slug = String(product.slug ?? "");
    if (!slug || inventorySlugs.has(slug)) continue;
    const sku = deriveProductSku(slug);
    const timestamp = new Date().toISOString();

    await fetch(`${url}/rest/v1/inventory`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        product_slug: slug,
        sku,
        stock_status: "available",
        quantity: 0,
        reserved_quantity: 0,
        reorder_threshold: 0,
        updated_at: timestamp
      })
    });

    await fetch(`${url}/rest/v1/warehouse_stock`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        warehouse_code: warehouseCode,
        product_slug: slug,
        sku,
        available_quantity: 0,
        committed_quantity: 0,
        updated_at: timestamp
      })
    });

    inventorySlugs.add(slug);
    created += 1;
    console.log(`Created inventory for ${slug}`);
  }

  console.log(JSON.stringify({ created, totalProducts: products.length, inventoryRows: inventorySlugs.size }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
