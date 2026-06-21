/* eslint-disable @typescript-eslint/no-require-imports */
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const root = join(__dirname, "..");
const apply = process.argv.includes("--apply");
const wixFitVariantPattern = /^(https?:\/\/static\.wixstatic\.com\/media\/[^?\s]+?)\/v1\/fit\/w_(\d+),h_(\d+),q_(\d+)\/file\.[a-z0-9]+(\?.*)?$/i;
const minimumTrustedCatalogImageEdge = 720;

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
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

function parseFiniteDimension(value) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function normalizeImageUrl(src) {
  return src.replace(wixFitVariantPattern, (_match, base, _width, _height, _quality, query = "") => `${base}${query}`);
}

function normalizeMedia(value, fallbackAlt) {
  if (!value || typeof value !== "object" || typeof value.src !== "string" || !value.src.trim()) return null;
  const rawSrc = value.src.trim();
  const match = rawSrc.match(wixFitVariantPattern);
  const width = parseFiniteDimension(value.width);
  const height = parseFiniteDimension(value.height);
  const largestEdge = Math.max(width ?? 0, height ?? 0);
  const fitEdge = match ? Math.max(Number(match[2]), Number(match[3])) : 0;
  const keepDimensions = width && height && largestEdge >= minimumTrustedCatalogImageEdge && (!fitEdge || fitEdge >= minimumTrustedCatalogImageEdge);

  return {
    ...value,
    src: normalizeImageUrl(rawSrc),
    alt: typeof value.alt === "string" && value.alt.trim() ? value.alt.trim() : fallbackAlt,
    kind: value.kind === "video" || value.kind === "model" ? value.kind : "image",
    ...(keepDimensions ? { width, height } : { width: undefined, height: undefined }),
    local: false
  };
}

function mediaArea(value) {
  return (value?.width ?? 0) * (value?.height ?? 0);
}

function selectPrimary(candidates) {
  return candidates
    .filter(Boolean)
    .map((media, index) => ({
      media,
      score: mediaArea(media) + (media.src.includes("/storage/v1/object/public/") ? 30_000 : media.src.includes("static.wixstatic.com") ? 20_000 : 0) - index
    }))
    .sort((left, right) => right.score - left.score)[0]?.media ?? null;
}

function dedupeMedia(items) {
  return items.filter((item, index, list) => item?.src && list.findIndex((candidate) => candidate?.src === item.src) === index);
}

function repairRow(row) {
  const fallbackAlt = typeof row.name === "string" && row.name.trim() ? row.name.trim() : row.slug;
  const image = normalizeMedia(row.image, fallbackAlt);
  const hero = normalizeMedia(row.hero, fallbackAlt);
  const gallery = Array.isArray(row.gallery) ? row.gallery.map((item) => normalizeMedia(item, fallbackAlt)).filter(Boolean) : [];
  const sourceImages = Array.isArray(row.source_images)
    ? row.source_images.map((item) => normalizeMedia({ ...item, alt: fallbackAlt, kind: "image" }, fallbackAlt)).filter(Boolean)
    : [];
  const primary = selectPrimary([image, hero, ...gallery, ...sourceImages]);
  if (!primary) return null;

  const repairedGallery = dedupeMedia([primary, ...gallery, ...sourceImages]);
  return {
    image: primary,
    hero: hero ?? primary,
    gallery: repairedGallery,
    source_images: sourceImages.map(({ src, width, height }) => ({ src, width: width ?? null, height: height ?? null })),
    updated_at: new Date().toISOString()
  };
}

function hasConstrainedUrl(value) {
  if (!value) return false;
  if (typeof value === "string") return wixFitVariantPattern.test(value);
  if (Array.isArray(value)) return value.some(hasConstrainedUrl);
  if (typeof value === "object") return Object.values(value).some(hasConstrainedUrl);
  return false;
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

async function main() {
  loadProjectEnv();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("mithron_products")
    .select("slug,name,image,hero,gallery,source_images")
    .eq("workflow_status", "published")
    .eq("is_visible", true)
    .limit(5000);

  if (error) throw new Error(`mithron_products read failed: ${error.message}`);

  const updates = [];
  for (const row of data ?? []) {
    const repaired = repairRow(row);
    if (!repaired) continue;
    const before = {
      image: row.image,
      hero: row.hero,
      gallery: row.gallery,
      source_images: row.source_images
    };
    if (!hasConstrainedUrl(before) && !changed(before, {
      image: repaired.image,
      hero: repaired.hero,
      gallery: repaired.gallery,
      source_images: repaired.source_images
    })) continue;
    updates.push({ slug: row.slug, ...repaired });
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    scanned: data?.length ?? 0,
    updates: updates.length,
    sample: updates.slice(0, 5).map((row) => ({ slug: row.slug, image: row.image?.src }))
  }, null, 2));

  if (!apply || !updates.length) return;

  for (const row of updates) {
    const { slug, ...payload } = row;
    const { error: updateError } = await supabase
      .from("mithron_products")
      .update(payload)
      .eq("slug", slug);
    if (updateError) throw new Error(`mithron_products update failed for ${slug}: ${updateError.message}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
