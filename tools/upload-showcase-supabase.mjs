#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "blurhash";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const supabaseManifestPath = join(root, "data", "mithron-supabase-assets.generated.json");
const localManifestPath = join(root, "public", "optimized", "storefront", "manifest.json");
const cacheControl = "31536000";

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

function hashBuffer(buffer, size = 8) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, size);
}

function buildPublicUrl(supabaseUrl, bucket, storagePath) {
  return `${supabaseUrl.replace(/\/+$/g, "")}/storage/v1/object/public/${bucket}/${storagePath}`;
}

async function createBlurMetadata(buffer) {
  const preview = await sharp(buffer).resize(32, 32, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8ClampedArray(preview.data);
  const blurhash = encode(pixels, preview.info.width, preview.info.height, 4, 3);
  const blurDataUrlBuffer = await sharp(buffer).resize(28, 28, { fit: "inside" }).webp({ quality: 34 }).toBuffer();
  const blurDataUrl = `data:image/webp;base64,${blurDataUrlBuffer.toString("base64")}`;
  const stats = await sharp(buffer).stats();
  const dominant = stats.dominant;
  const dominantColor = `#${[dominant.r, dominant.g, dominant.b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  return { blurhash, blurDataUrl, dominantColor };
}

async function uploadVariant(supabase, bucket, storagePath, buffer, contentType) {
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    cacheControl,
    contentType,
    upsert: true
  });
  if (error) {
    throw new Error(`Upload failed for ${bucket}/${storagePath}: ${error.message}`);
  }
}

const showcaseVariantWidths = [480, 768, 1024];
const showcaseQuality = { avif: 86, webp: 90 };

function parseArgs() {
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const match = args.find((arg) => arg.startsWith(`${name}=`));
    return match ? match.split("=").slice(1).join("=") : undefined;
  };
  const sourcePath = getArg("--source");
  const slug = getArg("--slug");
  const alt = getArg("--alt");
  const targetWidth = getArg("--target-width") ? Number(getArg("--target-width")) : undefined;
  if (!sourcePath || !slug || !alt) {
    throw new Error("Usage: node tools/upload-showcase-supabase.mjs --source=<path> --slug=drone-care-hero --alt=\"Alt text\" [--target-width=1024]");
  }
  if (targetWidth !== undefined && (!Number.isFinite(targetWidth) || targetWidth < 480)) {
    throw new Error("--target-width must be at least 480 when provided.");
  }
  return { sourcePath, slug, alt, targetWidth };
}

function prepareMasterBuffer(masterBuffer, sourceWidth, sourceHeight, targetWidth) {
  const deliveryWidth = targetWidth ? Math.min(targetWidth, sourceWidth) : sourceWidth;
  let pipeline = sharp(masterBuffer, { failOn: "none" }).rotate();
  if (deliveryWidth < sourceWidth) {
    pipeline = pipeline.resize({
      width: deliveryWidth,
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true
    });
  }
  return pipeline.sharpen({ sigma: 0.55, m1: 0.45, m2: 0.3, x1: 2 }).toBuffer();
}

function upsertManifestAsset(manifestPath, asset) {
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : { version: 1, updatedAt: new Date().toISOString(), assets: [] };
  const assets = (manifest.assets ?? []).filter((entry) => entry.assetId !== asset.assetId);
  assets.push(asset);
  manifest.assets = assets;
  manifest.updatedAt = new Date().toISOString();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  loadProjectEnv();
  const { sourcePath, slug, alt, targetWidth } = parseArgs();
  if (!existsSync(sourcePath)) {
    throw new Error(`Missing source image: ${sourcePath}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const bucket = "mithron-story";
  const assetId = `storefront-showcase-${slug.replace(/[^a-z0-9-]/gi, "-")}`;
  const rawBuffer = await sharp(sourcePath, { failOn: "none" }).rotate().toBuffer();
  const sourceMeta = await sharp(rawBuffer).metadata();
  const sourceWidth = sourceMeta.width ?? 1024;
  const sourceHeight = sourceMeta.height ?? 341;
  const masterBuffer = await prepareMasterBuffer(rawBuffer, sourceWidth, sourceHeight, targetWidth);
  const masterMeta = await sharp(masterBuffer).metadata();
  const deliveryWidth = masterMeta.width ?? sourceWidth;
  const deliveryHeight = masterMeta.height ?? sourceHeight;
  const blur = await createBlurMetadata(masterBuffer);
  const widths = showcaseVariantWidths.filter((width) => width <= deliveryWidth);
  if (!widths.includes(deliveryWidth)) widths.push(deliveryWidth);
  const variants = { avif: [], webp: [] };

  for (const width of widths.sort((left, right) => left - right)) {
    for (const format of ["avif", "webp"]) {
      const pipeline = sharp(masterBuffer).resize({ width, fit: "inside", withoutEnlargement: true, kernel: sharp.kernel.lanczos3 });
      const buffer = format === "avif"
        ? await pipeline.avif({ quality: showcaseQuality.avif, effort: 7 }).toBuffer()
        : await pipeline.webp({ quality: showcaseQuality.webp, effort: 6, smartSubsample: true }).toBuffer();
      const hash = hashBuffer(buffer, 8);
      const storagePath = `${slug}-${width}w-v3.${hash}.${format}`;
      await uploadVariant(supabase, bucket, storagePath, buffer, `image/${format}`);
      const info = await sharp(buffer).metadata();
      variants[format].push({
        width: info.width ?? width,
        height: info.height ?? Math.round(width * (sourceHeight / sourceWidth)),
        format,
        src: buildPublicUrl(supabaseUrl, bucket, storagePath),
        storagePath,
        optimizedSizeKb: Number((buffer.byteLength / 1024).toFixed(2))
      });
    }
  }

  const fallbackSrc = variants.webp.at(-1)?.src ?? variants.avif.at(-1)?.src;
  if (!fallbackSrc) {
    throw new Error("No showcase variants were generated.");
  }

  const asset = {
    assetId,
    bucket,
    assetRole: "poster",
    category: "showcase",
    generatedPromptId: `supabase.storefront.showcase.${slug}`,
    status: "generated",
    fallbackSrc,
    fallbackAlt: alt,
    width: deliveryWidth,
    height: deliveryHeight,
    sourceSizeKb: Number((rawBuffer.byteLength / 1024).toFixed(2)),
    blurhash: blur.blurhash,
    blurDataUrl: blur.blurDataUrl,
    dominantColor: blur.dominantColor,
    variants
  };

  upsertManifestAsset(supabaseManifestPath, asset);
  if (existsSync(localManifestPath)) {
    const localManifest = JSON.parse(readFileSync(localManifestPath, "utf8"));
    localManifest.assets = (localManifest.assets ?? []).filter((entry) => entry.assetId !== assetId);
    localManifest.updatedAt = new Date().toISOString();
    writeFileSync(localManifestPath, `${JSON.stringify(localManifest, null, 2)}\n`);
  }

  console.log(JSON.stringify({ assetId, fallbackSrc, width: deliveryWidth, height: deliveryHeight, sourceWidth }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
