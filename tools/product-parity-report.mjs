import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(import.meta.dirname, "..");

function loadProjectEnv() {
  for (const envPath of [join(root, ".env.local"), join(root, ".env")]) {
    try {
      const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [name, ...parts] = trimmed.split("=");
        if (!name || process.env[name]) continue;
        process.env[name] = parts.join("=").replace(/^["']|["']$/g, "");
      }
    } catch {
      // ignore missing env file
    }
  }
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeIdentity(name) {
  return decodeHtml(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function wixProductPageUrl(slug) {
  return `https://www.mithron.co/product-page/${slug}`;
}

function sourceCatalogIdFromWixSlug(slug) {
  return `wix-${slug}`;
}

async function fetchWixV1(apiKey, siteId) {
  const products = [];
  let offset = 0;

  while (true) {
    const response = await fetch("https://www.wixapis.com/stores-reader/v1/products/query", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        "wix-site-id": siteId
      },
      body: JSON.stringify({
        query: {
          paging: { limit: 100, offset }
        }
      })
    });

    if (!response.ok) {
      throw new Error(
        `Wix v1 query failed (${response.status}): ${(await response.text()).slice(0, 400)}`
      );
    }

    const payload = await response.json();
    const batch = payload.products ?? [];

    for (const product of batch) {
      const slug = String(product.slug ?? "").trim();
      const name = decodeHtml(String(product.name ?? "")).trim();
      if (!slug || !name) continue;

      products.push({
        wix_product_id: String(product.id),
        wix_slug: slug,
        name,
        price: Number(product.priceData?.price ?? product.price ?? 0) || 0,
        compare_at: null,
        description_plain: decodeHtml(String(product.description ?? "")),
        source_url: wixProductPageUrl(slug),
        source_catalog_id: sourceCatalogIdFromWixSlug(slug),
        source_fingerprint: normalizeIdentity(name),
        category: "Uncategorized",
        media_urls: [],
        visible: product.visible !== false,
        updated_at: String(product.lastUpdated ?? new Date().toISOString())
      });
    }

    if (batch.length < 100) break;
    offset += 100;
  }

  return products;
}

function matchDbRowToWix(row, wixProducts) {
  const byCatalogId = new Map(wixProducts.map((p) => [p.source_catalog_id, p]));
  const byUrl = new Map(wixProducts.map((p) => [p.source_url.replace(/\/$/, ""), p]));
  const byWixSlug = new Map(wixProducts.map((p) => [p.wix_slug, p]));

  if (row.source_catalog_id && byCatalogId.has(row.source_catalog_id)) {
    return byCatalogId.get(row.source_catalog_id);
  }
  if (row.source_url && byUrl.has(row.source_url.replace(/\/$/, ""))) {
    return byUrl.get(row.source_url.replace(/\/$/, ""));
  }
  if (byWixSlug.has(row.slug)) return byWixSlug.get(row.slug);
  return null;
}

function buildReport(wixProducts, dbRows) {
  const wixBySlug = new Map(wixProducts.map((p) => [p.wix_slug, p]));
  const matchedWix = new Set();
  const matchedOk = [];
  const dbOnly = [];

  for (const row of dbRows) {
    const wix = matchDbRowToWix(row, wixProducts);
    if (wix) {
      matchedWix.add(wix.wix_slug);
      matchedOk.push({ slug: row.slug, wix_slug: wix.wix_slug, name: row.name });
    } else {
      dbOnly.push({ slug: row.slug, name: row.name, category: row.category, visible: row.is_visible });
    }
  }

  const wixOnly = wixProducts
    .filter((p) => !matchedWix.has(p.wix_slug))
    .map((p) => ({
      wix_slug: p.wix_slug,
      name: p.name,
      visible: p.visible,
      source_url: p.source_url
    }));

  return {
    summary: {
      wix_count: wixProducts.length,
      db_count: dbRows.length,
      matched_ok: matchedOk.length,
      wix_only: wixOnly.length,
      db_only: dbOnly.length
    },
    matched_ok: matchedOk,
    wix_only: wixOnly,
    db_only: dbOnly,
    wix_by_slug: Object.fromEntries(wixBySlug)
  };
}

async function fetchAllDbProducts(supabase) {
  const rows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("mithron_products")
      .select(
        "slug,name,category,workflow_status,is_visible,merge_status,source_catalog_id,source_url"
      )
      .range(from, from + 199);

    if (error) throw new Error(`Failed to read mithron_products: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 200) break;
    from += 200;
  }

  return rows;
}

async function main() {
  loadProjectEnv();

  const apiKey = process.env.WIX_STUDIO_API_KEY?.trim();
  const siteId = process.env.WIX_SITE_ID?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !siteId) throw new Error("WIX_STUDIO_API_KEY and WIX_SITE_ID are required.");
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const wixProducts = await fetchWixV1(apiKey, siteId);
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const dbRows = await fetchAllDbProducts(supabase);
  const report = buildReport(wixProducts, dbRows);

  const storefrontVisible = dbRows.filter(
    (row) =>
      row.workflow_status === "published" &&
      row.is_visible &&
      !["archived_merged", "merged"].includes(row.merge_status ?? "")
  );

  const output = {
    generated_at: new Date().toISOString(),
    counts: {
      wix_studio_live: wixProducts.length,
      wix_visible_in_studio: wixProducts.filter((p) => p.visible).length,
      database_total: dbRows.length,
      database_published: dbRows.filter((r) => r.workflow_status === "published").length,
      database_storefront_visible: storefrontVisible.length
    },
    summary: report.summary,
    missing_on_website: report.wix_only,
    extra_on_website_not_in_wix: report.db_only
  };

  const outPath = join(root, "data", "product-parity-report.json");
  mkdirSync(join(root, "data"), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
