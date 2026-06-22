import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { WixCatalogSnapshot } from "../lib/wix/catalog-client.ts";
import { buildProductReconcileReport } from "../lib/product-reconcile/audit-catalog.ts";
import {
  buildWixPatch,
  mergeGapFillPatch,
  pickCanonicalSlug,
  type DbProductRow,
  type ProductSignals,
  type ScoreCanonicalInput
} from "../lib/product-reconcile/score-canonical.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const defaultWixPath = join(root, "data", "wix-catalog.snapshot.json");
const defaultReportPath = join(root, "data", "product-reconcile-report.json");

function loadProjectEnv() {
  for (const envPath of [join(root, ".env.local"), join(root, ".env")]) {
    if (!existsSync(envPath)) continue;
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [name, ...parts] = trimmed.split("=");
      if (!name || process.env[name]) continue;
      process.env[name] = parts.join("=").replace(/^["']|["']$/g, "");
    }
  }
}

function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

async function fetchAllProducts(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  const rows: DbProductRow[] = [];
  const pageSize = 200;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("mithron_products")
      .select(
        "slug,name,tagline,price,compare_at,on_sale,description,source_description,source_catalog_id,source_url,source_fingerprint,category,workflow_status,is_visible,image,seo_title,seo_description,tax_group,merge_status,merged_into_slug"
      )
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Failed to read mithron_products: ${error.message}`);
    if (!data?.length) break;
    rows.push(...(data as DbProductRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function loadSignals(supabase: ReturnType<typeof createSupabaseAdminClient>, slugs: string[]) {
  const signals = new Map<string, ProductSignals>();
  for (const slug of slugs) {
    signals.set(slug, {
      slug,
      hasPrimaryMedia: false,
      hasValidImage: false,
      orderItemCount: 0,
      warehouseStockCount: 0,
      inventoryCount: 0,
      seoFieldCount: 0
    });
  }

  if (!slugs.length) return signals;

  const [mediaRes, ordersRes, stockRes, inventoryRes] = await Promise.all([
    supabase
      .from("product_media_assets")
      .select("product_slug,usage")
      .in("product_slug", slugs)
      .eq("usage", "primary"),
    supabase.from("order_items").select("product_slug").in("product_slug", slugs),
    supabase.from("warehouse_stock").select("product_slug").in("product_slug", slugs),
    supabase.from("inventory").select("product_slug").in("product_slug", slugs)
  ]);

  for (const row of mediaRes.data ?? []) {
    const entry = signals.get(row.product_slug);
    if (entry) entry.hasPrimaryMedia = true;
  }

  for (const row of ordersRes.data ?? []) {
    const entry = signals.get(row.product_slug);
    if (entry) entry.orderItemCount += 1;
  }

  for (const row of stockRes.data ?? []) {
    const entry = signals.get(row.product_slug);
    if (entry) entry.warehouseStockCount += 1;
  }

  for (const row of inventoryRes.data ?? []) {
    const entry = signals.get(row.product_slug);
    if (entry) entry.inventoryCount += 1;
  }

  return signals;
}

async function hideCsvStorefrontArtifacts(supabase: ReturnType<typeof createSupabaseAdminClient>, dryRun: boolean) {
  const { data, error } = await supabase
    .from("mithron_products")
    .select("slug")
    .eq("source_availability", "uploaded_csv")
    .eq("price", 0)
    .is("source_url", null);

  if (error) throw new Error(`Failed to read CSV storefront artifacts: ${error.message}`);

  const slugs = (data ?? []).map((row) => row.slug);
  if (!slugs.length) return { hidden: 0, slugs: [] as string[] };

  if (!dryRun) {
    const { error: updateError } = await supabase
      .from("mithron_products")
      .update({
        is_visible: false,
        category: "Imported Wix Inventory",
        merge_status: "archived_merged",
        updated_at: new Date().toISOString()
      })
      .in("slug", slugs);

    if (updateError) throw new Error(`Failed to hide CSV storefront artifacts: ${updateError.message}`);
  }

  return { hidden: slugs.length, slugs };
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  const wixPath = process.argv.find((arg) => arg.startsWith("--wix="))?.split("=")[1] ?? defaultWixPath;
  const reportPath =
    process.argv.find((arg) => arg.startsWith("--report="))?.split("=")[1] ?? defaultReportPath;

  loadProjectEnv();

  if (!existsSync(wixPath)) {
    throw new Error(`Wix snapshot not found at ${wixPath}. Run: npm run products:fetch-wix`);
  }

  const wixCatalog = JSON.parse(readFileSync(wixPath, "utf8")) as WixCatalogSnapshot;
  const supabase = createSupabaseAdminClient();
  const dbRows = await fetchAllProducts(supabase);
  const report = existsSync(reportPath)
    ? JSON.parse(readFileSync(reportPath, "utf8"))
    : buildProductReconcileReport(wixCatalog.products, dbRows);

  const rowBySlug = new Map(dbRows.map((row) => [row.slug, row]));
  const allClusterSlugs = [...new Set(report.duplicate_clusters.flatMap((c: { slugs: string[] }) => c.slugs))];
  const signals = await loadSignals(supabase, allClusterSlugs);
  const merges: Array<{ source: string; target: string; reason: string }> = [];
  const patches: Array<{ slug: string; fields: string[] }> = [];

  for (const cluster of report.duplicate_clusters as Array<{ slugs: string[]; reason: string }>) {
    const candidates: ScoreCanonicalInput[] = cluster.slugs
      .map((slug) => rowBySlug.get(slug))
      .filter((row): row is DbProductRow => Boolean(row))
      .map((row) => {
        const wixSlug = report.db_slug_to_wix_slug?.[row.slug];
        const wixMatch = wixSlug ? wixCatalog.products.find((p) => p.wix_slug === wixSlug) ?? null : null;
        const signal = signals.get(row.slug) ?? {
          slug: row.slug,
          hasPrimaryMedia: false,
          hasValidImage: false,
          orderItemCount: 0,
          warehouseStockCount: 0,
          inventoryCount: 0,
          seoFieldCount: Number(Boolean(row.seo_title)) + Number(Boolean(row.seo_description))
        };
        if (row.image?.src && !/placeholder|broken/i.test(row.image.src)) signal.hasValidImage = true;
        return { row, signals: signal, wixMatch };
      });

    const canonicalSlug = pickCanonicalSlug(candidates);
    if (!canonicalSlug) continue;

    const canonicalRow = rowBySlug.get(canonicalSlug);
    const donors = candidates.map((c) => c.row).filter((row) => row.slug !== canonicalSlug);
    const gapPatch = canonicalRow ? mergeGapFillPatch(canonicalRow, donors) : {};
    const wixSlug = report.db_slug_to_wix_slug?.[canonicalSlug];
    const wix = wixSlug ? wixCatalog.products.find((p) => p.wix_slug === wixSlug) : null;
    const wixPatch = canonicalRow && wix ? buildWixPatch(canonicalRow, wix, { forceDescription: true }) : {};
    const canonicalPatch = { ...gapPatch, ...wixPatch };

    if (Object.keys(canonicalPatch).length) {
      patches.push({ slug: canonicalSlug, fields: Object.keys(canonicalPatch) });
      if (!dryRun) {
        const { error } = await supabase.from("mithron_products").update(canonicalPatch).eq("slug", canonicalSlug);
        if (error) throw new Error(`Failed to patch canonical ${canonicalSlug}: ${error.message}`);
      }
    }

    for (const donor of donors) {
      merges.push({ source: donor.slug, target: canonicalSlug, reason: cluster.reason });
      if (!dryRun) {
        const { error } = await supabase.rpc("merge_product_into_canonical", {
          p_source_slug: donor.slug,
          p_target_slug: canonicalSlug,
          p_reason: cluster.reason
        });
        if (error) throw new Error(`Failed to merge ${donor.slug} -> ${canonicalSlug}: ${error.message}`);
      }
    }
  }

  const driftSlugs = new Set([
    ...report.price_drift.map((row: { slug: string }) => row.slug),
    ...report.description_drift.map((row: { slug: string }) => row.slug)
  ]);

  for (const slug of driftSlugs) {
    if (merges.some((merge) => merge.source === slug)) continue;
    const row = rowBySlug.get(slug);
    const wixSlug = report.db_slug_to_wix_slug?.[slug];
    const wix = wixSlug ? wixCatalog.products.find((p) => p.wix_slug === wixSlug) : null;
    if (!row || !wix) continue;

    const patch = buildWixPatch(row, wix, { forceDescription: true });
    patches.push({ slug, fields: Object.keys(patch) });
    if (!dryRun) {
      const { error } = await supabase.from("mithron_products").update(patch).eq("slug", slug);
      if (error) throw new Error(`Failed to patch drift ${slug}: ${error.message}`);
    }
  }

  const csvCleanup = await hideCsvStorefrontArtifacts(supabase, dryRun);

  const brokenImageSlugs = (report.broken_image_slugs as string[] | undefined) ?? [];
  const mediaBackfillHint =
    brokenImageSlugs.length > 0
      ? "Run: node tools/backfill-canonical-media.mjs --apply"
      : null;

  console.log(
    JSON.stringify(
      {
        status: dryRun ? "DRY_RUN" : "RECONCILED",
        merges: merges.length,
        patches: patches.length,
        csvArtifactsHidden: csvCleanup.hidden,
        brokenImageSlugs: brokenImageSlugs.length,
        mediaBackfillHint,
        sampleMerges: merges.slice(0, 10),
        samplePatches: patches.slice(0, 10),
        summary: report.summary
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
