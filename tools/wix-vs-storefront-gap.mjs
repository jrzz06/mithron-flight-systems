import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(import.meta.dirname, "..");
const BASE = process.env.CATALOG_VERIFY_BASE_URL ?? "https://final-mithron-deploy.vercel.app";

const CATEGORY_MAP = {
  Accessories: "accessories",
  "Agri Drones": "agri-drones",
  "Video Drones": "video-drones",
  "Creative Drones": "creative-drones",
  "Surveillance Drones": "surveillance-drones",
  "Survey Drones": "survey-drones",
  "Global Products": "global-products"
};

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

function decodeHtml(v) {
  return String(v ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function normName(name) {
  return decodeHtml(name).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function expectedBrowseSlugs(rows) {
  const slugs = new Set();
  for (const row of rows) {
    if (CATEGORY_MAP[row.category]) slugs.add(row.slug);
  }
  return slugs;
}

async function fetchWixApi(apiKey, siteId) {
  const products = [];
  let offset = 0;
  while (true) {
    const res = await fetch("https://www.wixapis.com/stores-reader/v1/products/query", {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json", "wix-site-id": siteId },
      body: JSON.stringify({ query: { paging: { limit: 100, offset } } })
    });
    if (!res.ok) throw new Error(`Wix API ${res.status}`);
    const payload = await res.json();
    const batch = payload.products ?? [];
    for (const p of batch) {
      products.push({
        wix_slug: String(p.slug),
        name: decodeHtml(p.name),
        url: `https://www.mithron.co/product-page/${p.slug}`
      });
    }
    if (batch.length < 100) break;
    offset += 100;
  }
  return products;
}

async function fetchLiveStorefrontSlugs() {
  const categories = Object.values(CATEGORY_MAP);
  const slugs = new Set();
  for (const cat of categories) {
    const res = await fetch(`${BASE}/category/${cat}`);
    const html = await res.text();
    for (const m of html.matchAll(/href="\/product\/([^"?#]+)"/g)) slugs.add(m[1]);
  }
  return slugs;
}

async function main() {
  loadProjectEnv();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const wix = await fetchWixApi(process.env.WIX_STUDIO_API_KEY, process.env.WIX_SITE_ID);
  const liveStorefrontSlugs = await fetchLiveStorefrontSlugs();

  const { data: dbRows } = await supabase
    .from("mithron_products")
    .select("slug,name,category,is_visible,workflow_status,merge_status,source_url")
    .eq("workflow_status", "published")
    .eq("is_visible", true);

  const visible = (dbRows ?? []).filter(
    (r) => !["archived_merged", "merged"].includes(r.merge_status ?? "") && r.category !== "Imported Wix Inventory"
  );

  const expectedSlugs = expectedBrowseSlugs(visible);
  const byName = new Map(visible.map((r) => [normName(r.name), r]));

  const notInDb = [];
  const hiddenFromExpectedBrowse = [];
  const hiddenFromLiveBrowse = [];
  const inDbNoLivePage = [];

  for (const w of wix) {
    const row = byName.get(normName(w.name));
    if (!row) {
      notInDb.push(w);
      continue;
    }
    if (!expectedSlugs.has(row.slug)) {
      hiddenFromExpectedBrowse.push({
        name: row.name,
        slug: row.slug,
        category: row.category
      });
    }
    if (!liveStorefrontSlugs.has(row.slug)) {
      hiddenFromLiveBrowse.push({
        name: row.name,
        slug: row.slug,
        category: row.category,
        wix_url: w.url,
        our_url: `${BASE}/product/${row.slug}`
      });
    }
    const live = await fetch(`${BASE}/product/${row.slug}`, { method: "HEAD" });
    if (live.status !== 200) {
      inDbNoLivePage.push({ name: row.name, slug: row.slug, status: live.status });
    }
  }

  const requiredAccessories = [
    "source-namoag",
    "source-aerofc-v2-flight-controller-compatible-with-open-source-firmware-and-gcs",
    "source-ag-fc-namoag-gps-with-aerogcs-green-software-combo"
  ];
  const accessoriesExpected = visible
    .filter((row) => row.category === "Accessories")
    .map((row) => row.slug);
  const missingRequiredAccessories = requiredAccessories.filter(
    (slug) => !accessoriesExpected.includes(slug)
  );

  const report = {
    generated_at: new Date().toISOString(),
    counts: {
      wix_studio: wix.length,
      database_visible: visible.length,
      expected_browse_total: expectedSlugs.size,
      live_storefront_total: liveStorefrontSlugs.size,
      wix_not_in_database: notInDb.length,
      wix_hidden_from_expected_browse: hiddenFromExpectedBrowse.length,
      wix_hidden_from_live_browse: hiddenFromLiveBrowse.length,
      wix_in_db_no_live_page: inDbNoLivePage.length,
      imported_wix_inventory_rows: (dbRows ?? []).filter((row) => row.category === "Imported Wix Inventory").length,
      accessories_expected_count: accessoriesExpected.length,
      accessories_required_present: missingRequiredAccessories.length === 0
    },
    missing_required_accessories: missingRequiredAccessories,
    hidden_from_expected_browse: hiddenFromExpectedBrowse,
    hidden_from_live_browse: hiddenFromLiveBrowse.slice(0, 20),
    broken_live_pages: inDbNoLivePage
  };

  const out = join(root, "data", "wix-vs-storefront-gap.json");
  mkdirSync(join(root, "data"), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report.counts, null, 2));

  if (
    report.counts.wix_hidden_from_expected_browse > 0 ||
    report.counts.imported_wix_inventory_rows > 0 ||
    !report.counts.accessories_required_present
  ) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
