#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const resultsDir = join(root, "test-results");
const bucket = "mithron-products";
const pipelineVersion = "catalog-cutout-v1";
const batchSize = 100;

function loadProjectEnv() {
  for (const envPath of [join(root, ".env.local"), join(root, ".env")]) {
    if (!existsSync(envPath)) continue;
    const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const separator = trimmed.indexOf("=");
      const name = trimmed.slice(0, separator);
      const value = trimmed.slice(separator + 1).replace(/^["']|["']$/g, "");
      if (!name || process.env[name]) continue;
      process.env[name] = value;
    }
  }
}

function parseArgs(argv) {
  return { apply: argv.includes("--apply") };
}

function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function isProtectedPath(storagePath) {
  return storagePath.startsWith("catalog-cutouts/")
    || storagePath.startsWith("products/catalog-cutouts");
}

function isSourceFolder(folder) {
  return typeof folder === "string" && /^products\/source-/i.test(folder);
}

async function listAllStorageObjects(supabase, prefix) {
  const objects = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw new Error(`storage list failed for ${prefix}: ${error.message}`);
    const entries = data ?? [];
    if (!entries.length) break;

    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        objects.push({
          path,
          sizeBytes: entry.metadata?.size ?? null
        });
      } else {
        const nested = await listAllStorageObjects(supabase, path);
        objects.push(...nested);
      }
    }

    if (entries.length < limit) break;
    offset += limit;
  }

  return objects;
}

async function removeInBatches(supabase, paths) {
  let removed = 0;
  for (let index = 0; index < paths.length; index += batchSize) {
    const batch = paths.slice(index, index + batchSize);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw new Error(`storage remove failed: ${error.message}`);
    removed += batch.length;
  }
  return removed;
}

async function main() {
  loadProjectEnv();
  mkdirSync(resultsDir, { recursive: true });
  const options = parseArgs(process.argv.slice(2));
  const supabase = createSupabaseAdminClient();

  const { data: mediaAssets, error: mediaError } = await supabase
    .from("media_assets")
    .select("id,bucket,storage_path,folder,size_bytes,file_size_bytes")
    .eq("bucket", bucket)
    .limit(10000);
  if (mediaError) throw new Error(`media_assets read failed: ${mediaError.message}`);

  const { data: cutoutLinks, error: cutoutError } = await supabase
    .from("product_media_assets")
    .select("product_slug,media_asset_id")
    .eq("usage", "cms")
    .eq("variant_id", pipelineVersion)
    .limit(5000);
  if (cutoutError) throw new Error(`product_media_assets read failed: ${cutoutError.message}`);

  const cutoutSlugs = new Set((cutoutLinks ?? []).map((link) => link.product_slug).filter(Boolean));
  const mediaByPath = new Map();
  for (const asset of mediaAssets ?? []) {
    if (!asset.storage_path) continue;
    mediaByPath.set(asset.storage_path, asset);
  }

  const sourceAssets = (mediaAssets ?? []).filter((asset) => isSourceFolder(asset.folder));
  const candidates = [];
  const protectedSkipped = [];
  const activeSourceAssets = [];

  for (const asset of sourceAssets) {
    const slugMatch = asset.folder.match(/^products\/source-(.+)$/i);
    const slug = slugMatch ? slugMatch[1] : null;
    if (!slug || !cutoutSlugs.has(slug)) {
      activeSourceAssets.push({
        id: asset.id,
        storage_path: asset.storage_path,
        folder: asset.folder,
        reason: "no_catalog_cutout_for_slug"
      });
      continue;
    }
    candidates.push({
      id: asset.id,
      storage_path: asset.storage_path,
      folder: asset.folder,
      sizeBytes: asset.size_bytes ?? asset.file_size_bytes ?? null,
      reason: "superseded_by_catalog_cutout"
    });
  }

  const storageObjects = await listAllStorageObjects(supabase, "products");
  for (const object of storageObjects) {
    if (isProtectedPath(object.path)) {
      protectedSkipped.push(object.path);
      continue;
    }
    if (!/^products\/source-/i.test(object.path)) continue;
    if (mediaByPath.has(object.path)) continue;
    candidates.push({
      id: null,
      storage_path: object.path,
      folder: object.path.split("/").slice(0, 2).join("/"),
      sizeBytes: object.sizeBytes,
      reason: "orphan_source_storage_object"
    });
  }

  const uniqueDeletePaths = [...new Set(candidates.map((item) => item.storage_path))];
  const totalCandidateBytes = candidates.reduce((sum, item) => sum + (item.sizeBytes ?? 0), 0);
  const removedCount = options.apply
    ? await removeInBatches(supabase, uniqueDeletePaths)
    : 0;

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.apply ? "APPLIED" : "DRY_RUN",
    summary: {
      sourceAssetsInDb: sourceAssets.length,
      deleteCandidates: uniqueDeletePaths.length,
      activeSourceAssets: activeSourceAssets.length,
      protectedPathsSkipped: protectedSkipped.length,
      estimatedReclaimBytes: totalCandidateBytes,
      removedCount
    },
    deleteCandidates: candidates.slice(0, 200),
    activeSourceAssets: activeSourceAssets.slice(0, 50),
    protectedPathsSample: protectedSkipped.slice(0, 20)
  };

  const outputPath = join(resultsDir, "product-source-image-cleanup.json");
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outputPath, ...report.summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
