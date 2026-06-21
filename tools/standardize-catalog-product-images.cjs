/* eslint-disable @typescript-eslint/no-require-imports */
const { createHash } = require("node:crypto");
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const sharp = require("sharp");
const { createClient } = require("@supabase/supabase-js");

const root = join(__dirname, "..");
const workDir = join(root, "test-results", "catalog-product-image-pipeline");
const inputDir = join(workDir, "input");
const cutoutDir = join(workDir, "cutouts");
const studioDir = join(workDir, "studio");
const webpDir = join(workDir, "webp");
const studioWebpDir = join(workDir, "studio-webp");
const batchPath = join(workDir, "batch.json");
const cutoutResultsPath = join(workDir, "cutout-results.json");
const reportPath = join(workDir, "report.json");
const bucket = "mithron-products";
const pipelineVersion = "catalog-cutout-v1";
const stageSize = 1024;
const wixFitVariantPattern = /^(https?:\/\/static\.wixstatic\.com\/media\/[^?\s]+?)\/v1\/fit\/w_\d+,h_\d+,q_\d+\/file\.[a-z0-9]+(\?.*)?$/i;

function parseArgs(argv) {
  const args = new Set(argv);
  const value = (name) => {
    const found = argv.find((arg) => arg.startsWith(`${name}=`));
    return found ? found.slice(name.length + 1) : null;
  };
  const limit = Number(value("--limit") ?? 0);
  const slugsPath = value("--slugs");
  return {
    apply: args.has("--apply"),
    force: args.has("--force"),
    onlySupabaseStorage: args.has("--only-supabase-storage"),
    tightCrop: args.has("--tight-crop"),
    slugsPath,
    limit: Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : null
  };
}

function loadSlugFilter(slugsPath) {
  if (!slugsPath) return null;
  const resolved = slugsPath.startsWith("/") || /^[A-Za-z]:/.test(slugsPath)
    ? slugsPath
    : join(root, slugsPath);
  if (!existsSync(resolved)) {
    throw new Error(`Slug filter file not found: ${resolved}`);
  }
  const parsed = JSON.parse(readFileSync(resolved, "utf8"));
  const slugs = Array.isArray(parsed) ? parsed : parsed.slugs;
  if (!Array.isArray(slugs)) {
    throw new Error(`Slug filter file must contain a slug array or { slugs: string[] }: ${resolved}`);
  }
  return new Set(slugs.map((slug) => String(slug).trim()).filter(Boolean));
}

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

function normalizeUrl(src) {
  return String(src ?? "").trim().replace(wixFitVariantPattern, "$1$2");
}

function finiteDimension(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function mediaFromJson(value, fallbackAlt) {
  if (!value || typeof value !== "object" || typeof value.src !== "string") return null;
  const src = normalizeUrl(value.src);
  if (!/^https?:\/\//i.test(src)) return null;
  return {
    src,
    alt: typeof value.alt === "string" && value.alt.trim() ? value.alt.trim() : fallbackAlt,
    width: finiteDimension(value.width),
    height: finiteDimension(value.height),
    source: src.includes("/storage/v1/object/public/mithron-products/") ? "supabase" : src.includes("static.wixstatic.com") ? "wix" : "other"
  };
}

function collectSourceImages(row) {
  const alt = row.name || row.slug;
  return [
    mediaFromJson(row.linkedPrimary?.media, alt),
    mediaFromJson(row.image, alt),
    mediaFromJson(row.hero, alt),
    ...(Array.isArray(row.gallery) ? row.gallery.map((item) => mediaFromJson(item, alt)) : []),
    ...(Array.isArray(row.source_images) ? row.source_images.map((item) => mediaFromJson({ ...item, alt }, alt)) : [])
  ].filter(Boolean);
}

function sourceScore(media, index) {
  const area = (media.width ?? 0) * (media.height ?? 0);
  const sourceRank = media.source === "supabase" ? 3 : media.source === "wix" ? 2 : 1;
  return sourceRank * 1_000_000_000 + area - index;
}

function selectSourceMedia(row) {
  return collectSourceImages(row)
    .map((media, index) => ({ media, score: sourceScore(media, index) }))
    .sort((left, right) => right.score - left.score)[0]?.media ?? null;
}

function slugSafe(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function hashBuffer(buffer, length = 12) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, length);
}

function ensureDirs() {
  for (const dir of [workDir, inputDir, cutoutDir, studioDir, webpDir, studioWebpDir]) {
    mkdirSync(dir, { recursive: true });
  }
}

async function fetchCatalogRows(supabase) {
  const { data: products, error } = await supabase
    .from("mithron_products")
    .select("slug,name,category,image,hero,gallery,source_images,workflow_status,is_visible")
    .eq("workflow_status", "published")
    .eq("is_visible", true)
    .order("sort_order", { ascending: true })
    .limit(5000);
  if (error) throw new Error(`mithron_products read failed: ${error.message}`);

  const { data: primaryLinks, error: primaryError } = await supabase
    .from("product_media_assets")
    .select("product_slug,media_asset_id,media_assets(id,bucket,storage_path,public_url,mime_type,width,height,alt,alt_text,caption)")
    .eq("usage", "primary")
    .eq("is_primary", true)
    .limit(5000);
  if (primaryError) throw new Error(`primary product media read failed: ${primaryError.message}`);

  const { data: catalogLinks, error: catalogError } = await supabase
    .from("product_media_assets")
    .select("product_slug,media_asset_id,usage,variant_id")
    .eq("usage", "cms")
    .eq("variant_id", pipelineVersion)
    .limit(5000);
  if (catalogError) throw new Error(`catalog product media read failed: ${catalogError.message}`);

  const primaryBySlug = new Map();
  for (const link of primaryLinks ?? []) {
    if (!link.product_slug || !link.media_assets?.public_url) continue;
    primaryBySlug.set(link.product_slug, {
      mediaAssetId: link.media_asset_id,
      media: {
        src: link.media_assets.public_url,
        alt: link.media_assets.alt_text ?? link.media_assets.alt ?? link.media_assets.caption ?? link.product_slug,
        width: link.media_assets.width,
        height: link.media_assets.height
      }
    });
  }

  const existingCatalogSlugs = new Set((catalogLinks ?? []).map((link) => link.product_slug).filter(Boolean));
  return (products ?? []).map((row) => ({
    ...row,
    linkedPrimary: primaryBySlug.get(row.slug) ?? null,
    hasExistingCatalogCutout: existingCatalogSlugs.has(row.slug)
  }));
}

async function prepareInput(product, source) {
  const response = await fetch(source.src, {
    headers: { "user-agent": "Mithron catalog image standardizer" }
  });
  if (!response.ok) {
    throw new Error(`download failed ${response.status} ${response.statusText}`);
  }
  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const sourceHash = hashBuffer(sourceBuffer, 16);
  const inputPath = join(inputDir, `${slugSafe(product.slug)}.png`);
  await sharp(sourceBuffer, { animated: false })
    .rotate()
    .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: false })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(inputPath);
  const metadata = await sharp(inputPath).metadata();
  return {
    inputPath,
    sourceHash,
    sourceBytes: sourceBuffer.length,
    preparedWidth: metadata.width,
    preparedHeight: metadata.height
  };
}

function runCutoutBatch(items, tightCrop) {
  writeFileSync(batchPath, JSON.stringify({ items, tightCrop: Boolean(tightCrop) }, null, 2));
  const pythonArgs = [
    join("tools", "catalog-product-cutout-batch.py"),
    "--batch",
    batchPath,
    "--out",
    cutoutResultsPath
  ];
  if (tightCrop) pythonArgs.push("--tight-crop");
  const result = spawnSync("python", pythonArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    throw new Error(`cutout batch failed:\n${result.stdout}\n${result.stderr}`);
  }
  return JSON.parse(readFileSync(cutoutResultsPath, "utf8"));
}

async function buildWebp(result) {
  const pngBuffer = readFileSync(result.outputPath);
  const contentHash = hashBuffer(pngBuffer, 12);
  const webpPath = join(webpDir, `${slugSafe(result.slug)}-${contentHash}.webp`);
  const webpBuffer = await sharp(pngBuffer)
    .resize({ width: stageSize, height: stageSize, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 92, effort: 6, smartSubsample: true })
    .toBuffer();
  writeFileSync(webpPath, webpBuffer);
  const metadata = await sharp(webpBuffer).metadata();
  if (!metadata.hasAlpha) {
    throw new Error("processed WebP lost alpha channel");
  }
  return { webpPath, webpBuffer, contentHash, metadata };
}

async function buildStudioWebp(result) {
  if (!result.studioOutputPath) return null;

  const pngBuffer = readFileSync(result.studioOutputPath);
  const contentHash = hashBuffer(pngBuffer, 12);
  const webpPath = join(studioWebpDir, `${slugSafe(result.slug)}-${contentHash}.webp`);
  const webpBuffer = await sharp(pngBuffer)
    .flatten({ background: { r: 250, g: 250, b: 250 } })
    .resize({ width: stageSize, height: stageSize, fit: "contain", background: { r: 250, g: 250, b: 250 } })
    .webp({ lossless: true, effort: 6 })
    .toBuffer();
  writeFileSync(webpPath, webpBuffer);
  const metadata = await sharp(webpBuffer).metadata();
  if (metadata.hasAlpha) {
    throw new Error("studio WebP retained alpha channel");
  }
  return { webpPath, webpBuffer, contentHash, metadata };
}

async function uploadCatalogAsset({ supabase, product, source, prepared, cutout, webp }) {
  const safeSlug = slugSafe(product.slug);
  const storagePath = `catalog-cutouts/v1/${safeSlug}-${webp.contentHash}.webp`;
  const mediaAssetId = `catalog.cutout.v1.${safeSlug}.${webp.contentHash}`;
  const altText = `${product.name} catalog product cutout`;
  const now = new Date().toISOString();
  const upload = await supabase.storage.from(bucket).upload(storagePath, webp.webpBuffer, {
    contentType: "image/webp",
    cacheControl: "31536000",
    upsert: true
  });
  if (upload.error) throw new Error(`storage upload failed: ${upload.error.message}`);
  const publicUrl = supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;

  const mediaPayload = {
    id: mediaAssetId,
    bucket,
    storage_path: storagePath,
    public_url: publicUrl,
    alt: altText,
    alt_text: altText,
    caption: `${product.name} standardized catalog cutout`,
    folder: "products/catalog-cutouts",
    tags: ["catalog-cutout", "product", "standardized", pipelineVersion, slugSafe(product.category)],
    mime_type: "image/webp",
    width: stageSize,
    height: stageSize,
    size_bytes: webp.webpBuffer.length,
    file_size_bytes: webp.webpBuffer.length,
    content_hash: webp.contentHash,
    variants: {
      pipeline: pipelineVersion,
      source_url: source.src,
      source_hash: prepared.sourceHash,
      source_bytes: prepared.sourceBytes,
      output_png_hash: webp.contentHash,
      stage_size: stageSize,
      raw_metrics: cutout.rawMetrics ?? null,
      stage_metrics: cutout.stageMetrics ?? null
    },
    responsive_variants: {},
    upload_metadata: {
      pipeline: pipelineVersion,
      scope: "catalog-page-only",
      source_url: source.src,
      source_kind: source.source,
      source_hash: prepared.sourceHash,
      source_media_asset_id: product.linkedPrimary?.mediaAssetId ?? null,
      rembg_model: "isnet-general-use",
      tight_crop: Boolean(cutout.tightCrop),
      validation: {
        raw: cutout.rawMetrics ?? null,
        stage: cutout.stageMetrics ?? null
      }
    },
    version: 1,
    is_primary: false,
    is_visible: true,
    visibility: "public",
    status: "published",
    updated_at: now
  };

  const { error: mediaError } = await supabase
    .from("media_assets")
    .upsert(mediaPayload, { onConflict: "id" });
  if (mediaError) throw new Error(`media_assets upsert failed: ${mediaError.message}`);

  const { error: deleteLinkError } = await supabase
    .from("product_media_assets")
    .delete()
    .eq("product_slug", product.slug)
    .eq("usage", "cms")
    .eq("variant_id", pipelineVersion);
  if (deleteLinkError) throw new Error(`old catalog link delete failed: ${deleteLinkError.message}`);

  const linkPayload = {
    product_slug: product.slug,
    media_asset_id: mediaAssetId,
    usage: "cms",
    variant_id: pipelineVersion,
    sort_order: -100,
    is_primary: false,
    alt_text: altText,
    caption: `${product.name} standardized catalog media`,
    metadata: {
      pipeline: pipelineVersion,
      scope: "catalog-page-only",
      source_media_asset_id: product.linkedPrimary?.mediaAssetId ?? null,
      source_url: source.src,
      validation: {
        raw: cutout.rawMetrics ?? null,
        stage: cutout.stageMetrics ?? null
      }
    },
    updated_at: now
  };

  const { error: linkError } = await supabase
    .from("product_media_assets")
    .upsert(linkPayload, { onConflict: "product_slug,media_asset_id,usage" });
  if (linkError) throw new Error(`product_media_assets upsert failed: ${linkError.message}`);

  return {
    mediaAssetId,
    storagePath,
    publicUrl,
    sizeBytes: webp.webpBuffer.length
  };
}

async function main() {
  loadProjectEnv();
  ensureDirs();
  const options = parseArgs(process.argv.slice(2));
  const slugFilter = loadSlugFilter(options.slugsPath);
  const supabase = createSupabaseAdminClient();
  const rows = await fetchCatalogRows(supabase);
  const selected = [];
  const skipped = [];

  for (const row of rows) {
    if (slugFilter && !slugFilter.has(row.slug)) {
      skipped.push({ slug: row.slug, reason: "not_in_slug_filter" });
      continue;
    }
    if (row.hasExistingCatalogCutout && !options.force) {
      skipped.push({ slug: row.slug, reason: "existing_catalog_cutout" });
      continue;
    }
    const source = selectSourceMedia(row);
    if (!source) {
      skipped.push({ slug: row.slug, reason: "no_supported_image_source" });
      continue;
    }
    if (options.onlySupabaseStorage && source.source !== "supabase") {
      skipped.push({ slug: row.slug, reason: "not_supabase_storage" });
      continue;
    }
    selected.push({ row, source });
    if (options.limit && selected.length >= options.limit) break;
  }

  const preparedItems = [];
  const preparationFailures = [];
  for (const item of selected) {
    try {
      const prepared = await prepareInput(item.row, item.source);
      const slug = item.row.slug;
      preparedItems.push({
        slug,
        inputPath: prepared.inputPath,
        outputPath: join(cutoutDir, `${slugSafe(slug)}.png`),
        studioOutputPath: join(studioDir, `${slugSafe(slug)}.png`),
        tightCrop: options.tightCrop,
        product: item.row,
        source: item.source,
        prepared
      });
    } catch (error) {
      preparationFailures.push({
        slug: item.row.slug,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const cutoutBatch = preparedItems.length
    ? runCutoutBatch(
      preparedItems.map(({ slug, inputPath, outputPath, studioOutputPath, tightCrop }) => ({
        slug,
        inputPath,
        outputPath,
        studioOutputPath,
        tightCrop
      })),
      options.tightCrop
    )
    : { results: [] };
  const cutoutBySlug = new Map((cutoutBatch.results ?? []).map((result) => [result.slug, result]));
  const accepted = [];
  const rejected = [];
  const uploadFailures = [];

  for (const item of preparedItems) {
    const cutout = cutoutBySlug.get(item.slug);
    if (!cutout || cutout.status !== "accepted") {
      rejected.push({
        slug: item.slug,
        status: cutout?.status ?? "missing",
        reason: cutout?.reason ?? "missing_cutout_result",
        metrics: cutout?.stageMetrics ?? cutout?.rawMetrics ?? null
      });
      continue;
    }

    try {
      const webp = await buildWebp(cutout);
      const studioWebp = await buildStudioWebp(cutout);
      const upload = options.apply
        ? await uploadCatalogAsset({
          supabase,
          product: item.product,
          source: item.source,
          prepared: item.prepared,
          cutout,
          webp
        })
        : null;
      accepted.push({
        slug: item.slug,
        sourceKind: item.source.source,
        sourceUrl: item.source.src,
        outputPath: cutout.outputPath,
        studioOutputPath: cutout.studioOutputPath ?? null,
        webpPath: webp.webpPath,
        studioWebpPath: studioWebp?.webpPath ?? null,
        contentHash: webp.contentHash,
        studioContentHash: studioWebp?.contentHash ?? null,
        webpBytes: webp.webpBuffer.length,
        studioWebpBytes: studioWebp?.webpBuffer.length ?? null,
        upload,
        metrics: cutout.stageMetrics
      });
    } catch (error) {
      uploadFailures.push({
        slug: item.slug,
        reason: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const report = {
    mode: options.apply ? "APPLIED" : "DRY_RUN",
    options,
    pipelineVersion,
    scanned: rows.length,
    selected: selected.length,
    prepared: preparedItems.length,
    accepted: accepted.length,
    rejected: rejected.length,
    skipped: skipped.length,
    preparationFailures,
    uploadFailures,
    rejectedSample: rejected.slice(0, 20),
    skippedSample: skipped.slice(0, 20),
    acceptedSample: accepted.slice(0, 10).map((item) => ({
      slug: item.slug,
      sourceKind: item.sourceKind,
      webpBytes: item.webpBytes,
      studioWebpBytes: item.studioWebpBytes,
      studioWebpPath: item.studioWebpPath,
      upload: item.upload ? {
        mediaAssetId: item.upload.mediaAssetId,
        storagePath: item.upload.storagePath,
        sizeBytes: item.upload.sizeBytes
      } : null,
      metrics: item.metrics
    })),
    workDir
  };

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
