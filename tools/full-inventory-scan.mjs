import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(import.meta.dirname, "..");
const WIX_SITEMAP = "https://www.mithron.co/store-products-sitemap.xml";
const OUR_SITEMAP = "https://mithron-flight-systems-kbkbkh.vercel.app/sitemap.xml";

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
      // ignore
    }
  }
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function normName(name) {
  return decodeHtml(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugFromWixUrl(url) {
  const match = url.match(/\/product-page\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}

function slugFromOurUrl(url) {
  const match = url.match(/\/product\/([^/?#]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
}

async function fetchSitemapProductUrls(sitemapUrl, slugExtractor) {
  const response = await fetch(sitemapUrl, {
    headers: { "user-agent": "Mithron inventory scanner/1.0" }
  });
  if (!response.ok) {
    throw new Error(`Sitemap fetch failed ${sitemapUrl}: ${response.status}`);
  }
  const xml = await response.text();
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/gi)].map((m) => m[1].trim());
  const products = [];
  for (const loc of locs) {
    const slug = slugExtractor(loc);
    if (slug) products.push({ url: loc, slug });
  }
  return products;
}

async function fetchWixApiProducts(apiKey, siteId) {
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
      body: JSON.stringify({ query: { paging: { limit: 100, offset } } })
    });
    if (!response.ok) {
      throw new Error(`Wix API failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    }
    const payload = await response.json();
    const batch = payload.products ?? [];
    for (const p of batch) {
      const slug = String(p.slug ?? "").trim();
      const name = decodeHtml(String(p.name ?? "")).trim();
      if (!slug || !name) continue;
      products.push({
        wix_product_id: String(p.id),
        wix_slug: slug,
        name,
        visible: p.visible !== false,
        price: Number(p.priceData?.price ?? p.price ?? 0) || 0,
        url: `https://www.mithron.co/product-page/${slug}`
      });
    }
    if (batch.length < 100) break;
    offset += 100;
  }
  return products;
}

async function fetchAllDbProducts(supabase) {
  const rows = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("mithron_products")
      .select("slug,name,category,workflow_status,is_visible,merge_status,source_url,source_catalog_id,price")
      .range(from, from + 199);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < 200) break;
    from += 200;
  }
  return rows;
}

function isStorefrontVisible(row) {
  return (
    row.workflow_status === "published" &&
    row.is_visible &&
    !["archived_merged", "merged"].includes(row.merge_status ?? "")
  );
}

function findDbMatch(wixProduct, dbRows) {
  const bySlug = new Map(dbRows.map((r) => [r.slug, r]));
  const bySourceUrl = new Map(
    dbRows.filter((r) => r.source_url).map((r) => [r.source_url.replace(/\/$/, ""), r])
  );
  const byName = new Map();
  for (const row of dbRows) {
    const key = normName(row.name);
    if (!byName.has(key)) byName.set(key, row);
  }

  const wixUrl = wixProduct.url.replace(/\/$/, "");
  if (bySlug.has(wixProduct.wix_slug)) return { row: bySlug.get(wixProduct.wix_slug), match: "slug" };
  if (bySourceUrl.has(wixUrl)) return { row: bySourceUrl.get(wixUrl), match: "source_url" };
  const nameKey = normName(wixProduct.name);
  if (byName.has(nameKey)) return { row: byName.get(nameKey), match: "name" };
  return null;
}

async function checkLiveProductPage(baseUrl, slug) {
  const url = `${baseUrl}/product/${slug}`;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return { slug, url, status: res.status, ok: res.status === 200 };
  } catch {
    return { slug, url, status: 0, ok: false };
  }
}

async function main() {
  loadProjectEnv();
  const apiKey = process.env.WIX_STUDIO_API_KEY?.trim();
  const siteId = process.env.WIX_SITE_ID?.trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!apiKey || !siteId) throw new Error("WIX credentials missing");
  if (!url || !serviceRoleKey) throw new Error("Supabase credentials missing");

  console.log("Scanning Wix Studio API...");
  const wixApi = await fetchWixApiProducts(apiKey, siteId);

  console.log("Scanning live Wix storefront sitemap...");
  const wixSitemap = await fetchSitemapProductUrls(WIX_SITEMAP, slugFromWixUrl);

  console.log("Scanning deployed website sitemap...");
  const ourSitemap = await fetchSitemapProductUrls(OUR_SITEMAP, slugFromOurUrl);

  console.log("Loading database...");
  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const dbRows = await fetchAllDbProducts(supabase);
  const dbVisible = dbRows.filter(isStorefrontVisible);
  const ourSitemapSlugs = new Set(ourSitemap.map((p) => p.slug));

  const wixApiSlugs = new Set(wixApi.map((p) => p.wix_slug));
  const wixSitemapSlugs = new Set(wixSitemap.map((p) => p.slug));

  // Wix sitemap vs API
  const inSitemapNotApi = wixSitemap.filter((p) => !wixApiSlugs.has(p.slug));
  const inApiNotSitemap = wixApi.filter((p) => !wixSitemapSlugs.has(p.wix_slug));

  // For each Wix API product: is it in DB? is it live on our site?
  const wixInventory = [];
  for (const wix of wixApi) {
    const dbMatch = findDbMatch(wix, dbRows);
    const dbRow = dbMatch?.row ?? null;
    const onOurSitemap = dbRow ? ourSitemapSlugs.has(dbRow.slug) : false;
    const storefrontVisible = dbRow ? isStorefrontVisible(dbRow) : false;

    wixInventory.push({
      wix_slug: wix.wix_slug,
      name: wix.name,
      wix_url: wix.url,
      wix_visible: wix.visible,
      wix_price: wix.price,
      in_wix_sitemap: wixSitemapSlugs.has(wix.wix_slug),
      db_slug: dbRow?.slug ?? null,
      db_match: dbMatch?.match ?? null,
      in_database: Boolean(dbRow),
      storefront_visible: storefrontVisible,
      on_deployed_sitemap: onOurSitemap,
      status:
        !dbRow
          ? "MISSING_FROM_DATABASE"
          : !storefrontVisible
            ? "IN_DB_BUT_HIDDEN"
            : !onOurSitemap
              ? "IN_DB_NOT_ON_SITEMAP"
              : "OK"
    });
  }

  const missingFromDb = wixInventory.filter((p) => p.status === "MISSING_FROM_DATABASE");
  const hiddenInDb = wixInventory.filter((p) => p.status === "IN_DB_BUT_HIDDEN");
  const notOnSitemap = wixInventory.filter((p) => p.status === "IN_DB_NOT_ON_SITEMAP");
  const ok = wixInventory.filter((p) => p.status === "OK");

  // Wix sitemap URLs not covered by any Wix API product
  const orphanSitemapUrls = inSitemapNotApi.map((p) => p);

  // Spot-check live pages for problem products
  const toSpotCheck = [...missingFromDb, ...hiddenInDb, ...notOnSitemap].slice(0, 20);
  const liveChecks = [];
  for (const item of toSpotCheck) {
    if (item.db_slug) {
      liveChecks.push(await checkLiveProductPage("https://mithron-flight-systems-kbkbkh.vercel.app", item.db_slug));
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    counts: {
      wix_studio_api: wixApi.length,
      wix_live_sitemap: wixSitemap.length,
      our_database_total: dbRows.length,
      our_database_storefront_visible: dbVisible.length,
      our_deployed_sitemap: ourSitemap.length,
      wix_products_ok_on_our_site: ok.length,
      wix_products_missing_from_database: missingFromDb.length,
      wix_products_hidden_in_database: hiddenInDb.length,
      wix_products_in_db_not_on_sitemap: notOnSitemap.length,
      wix_sitemap_urls_not_in_api: orphanSitemapUrls.length,
      wix_api_not_in_sitemap: inApiNotSitemap.length
    },
    missing_from_database: missingFromDb,
    hidden_in_database: hiddenInDb,
    in_database_not_on_sitemap: notOnSitemap,
    wix_sitemap_not_in_api: orphanSitemapUrls,
    wix_api_not_in_sitemap: inApiNotSitemap.map((p) => ({
      wix_slug: p.wix_slug,
      name: p.name,
      url: p.url
    })),
    live_page_spot_checks: liveChecks
  };

  const outPath = join(root, "data", "full-inventory-scan.json");
  mkdirSync(join(root, "data"), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("\n=== FULL INVENTORY SCAN ===\n");
  console.log(`Wix Studio API:          ${report.counts.wix_studio_api}`);
  console.log(`Wix live sitemap:        ${report.counts.wix_live_sitemap}`);
  console.log(`Our database (total):    ${report.counts.our_database_total}`);
  console.log(`Our storefront visible:  ${report.counts.our_database_storefront_visible}`);
  console.log(`Our deployed sitemap:    ${report.counts.our_deployed_sitemap}`);
  console.log("");
  console.log(`OK on our site:          ${report.counts.wix_products_ok_on_our_site}`);
  console.log(`MISSING from database:   ${report.counts.wix_products_missing_from_database}`);
  console.log(`Hidden in database:      ${report.counts.wix_products_hidden_in_database}`);
  console.log(`In DB, not on sitemap:   ${report.counts.wix_products_in_db_not_on_sitemap}`);

  if (missingFromDb.length) {
    console.log("\n--- MISSING FROM DATABASE ---");
    for (const p of missingFromDb) console.log(`  • ${p.name} (${p.wix_slug})`);
  }
  if (hiddenInDb.length) {
    console.log("\n--- IN DATABASE BUT HIDDEN ---");
    for (const p of hiddenInDb) console.log(`  • ${p.name} → db slug: ${p.db_slug}`);
  }
  if (notOnSitemap.length) {
    console.log("\n--- IN DATABASE, NOT ON DEPLOYED SITEMAP ---");
    for (const p of notOnSitemap) console.log(`  • ${p.name} → ${p.db_slug}`);
  }

  console.log(`\nFull report: ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
