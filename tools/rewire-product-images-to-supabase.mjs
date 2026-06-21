import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;

function isWixUrl(value) {
  return typeof value === "string" && value.includes("static.wixstatic.com");
}

function isSupabaseStorageUrl(value) {
  return typeof value === "string" && value.includes("/storage/v1/object/public/");
}

function finiteDimension(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function buildMediaField(existing, supabaseUrl, altFallback) {
  const width = finiteDimension(existing?.width) ?? 1024;
  const height = finiteDimension(existing?.height) ?? 1024;
  const alt = typeof existing?.alt === "string" && existing.alt.trim() ? existing.alt.trim() : altFallback;
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    src: supabaseUrl,
    alt,
    width,
    height,
    local: false
  };
}

function rewriteJsonField(field, supabaseUrl, altFallback) {
  if (!field || typeof field !== "object") {
    return buildMediaField(null, supabaseUrl, altFallback);
  }
  if (!isWixUrl(field.src)) return field;
  return buildMediaField(field, supabaseUrl, altFallback);
}

function rewriteGallery(gallery, supabaseUrl, altFallback) {
  if (!Array.isArray(gallery) || gallery.length === 0) {
    return [buildMediaField(null, supabaseUrl, altFallback)];
  }

  const next = gallery
    .map((item) => {
      if (!item || typeof item !== "object" || typeof item.src !== "string") return item;
      if (!isWixUrl(item.src)) return item;
      return buildMediaField(item, supabaseUrl, altFallback);
    })
    .filter((item) => item && typeof item === "object" && typeof item.src === "string" && !isWixUrl(item.src));

  if (next.length === 0) {
    return [buildMediaField(null, supabaseUrl, altFallback)];
  }

  if (!next.some((item) => item.src === supabaseUrl)) {
    next[0] = buildMediaField(next[0], supabaseUrl, altFallback);
  }

  return next;
}

function rewriteSourceImages(sourceImages, supabaseUrl, altFallback) {
  if (!Array.isArray(sourceImages) || sourceImages.length === 0) {
    return [{ src: supabaseUrl, alt: altFallback, width: 1024, height: 1024 }];
  }

  return sourceImages
    .map((item) => {
      if (!item || typeof item !== "object" || typeof item.src !== "string") return item;
      if (!isWixUrl(item.src)) return item;
      return {
        ...item,
        src: supabaseUrl,
        width: finiteDimension(item.width) ?? 1024,
        height: finiteDimension(item.height) ?? 1024
      };
    })
    .filter((item) => item && typeof item === "object" && typeof item.src === "string" && !isWixUrl(item.src));
}

function pickBestLink(links) {
  const ranked = [...links].sort((left, right) => {
    const leftScore =
      (left.usage === "cms" && left.variant_id === "catalog-cutout-v1" ? 400 : 0) +
      (left.usage === "primary" ? 300 : 0) +
      (left.is_primary ? 100 : 0) -
      (left.sort_order ?? 0);
    const rightScore =
      (right.usage === "cms" && right.variant_id === "catalog-cutout-v1" ? 400 : 0) +
      (right.usage === "primary" ? 300 : 0) +
      (right.is_primary ? 100 : 0) -
      (right.sort_order ?? 0);
    return rightScore - leftScore;
  });
  return ranked.find((link) => isSupabaseStorageUrl(link.public_url)) ?? null;
}

function productHasWix(row) {
  if (isWixUrl(row.image?.src)) return true;
  if (isWixUrl(row.hero?.src)) return true;
  if (isWixUrl(row.og_image?.src)) return true;
  if (Array.isArray(row.gallery) && row.gallery.some((item) => isWixUrl(item?.src))) return true;
  if (Array.isArray(row.source_images) && row.source_images.some((item) => isWixUrl(item?.src))) return true;
  return false;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  const { data: products, error: productsError } = await supabase
    .from("mithron_products")
    .select("slug,name,image,hero,gallery,og_image,source_images")
    .limit(5000);
  if (productsError) throw new Error(`mithron_products read failed: ${productsError.message}`);

  const { data: links, error: linksError } = await supabase
    .from("product_media_assets")
    .select("product_slug,usage,variant_id,is_primary,sort_order,media_assets(id,public_url,width,height,alt,alt_text,caption)")
    .limit(10000);
  if (linksError) throw new Error(`product_media_assets read failed: ${linksError.message}`);

  const linksBySlug = new Map();
  for (const link of links ?? []) {
    const slug = link.product_slug;
    const publicUrl = link.media_assets?.public_url;
    if (!slug || !publicUrl) continue;
    const bucket = linksBySlug.get(slug) ?? [];
    bucket.push({
      usage: link.usage,
      variant_id: link.variant_id,
      is_primary: Boolean(link.is_primary),
      sort_order: link.sort_order ?? 0,
      public_url: publicUrl,
      width: link.media_assets?.width,
      height: link.media_assets?.height,
      alt: link.media_assets?.alt_text ?? link.media_assets?.alt ?? link.media_assets?.caption ?? slug
    });
    linksBySlug.set(slug, bucket);
  }

  const candidates = [];
  const stillOnWix = [];
  const noSupabaseLink = [];

  for (const row of products ?? []) {
    if (!productHasWix(row)) continue;
    const slugLinks = linksBySlug.get(row.slug) ?? [];
    const best = pickBestLink(slugLinks);
    if (!best) {
      noSupabaseLink.push(row.slug);
      continue;
    }
    candidates.push({ row, best });
  }

  const selected = limit && limit > 0 ? candidates.slice(0, limit) : candidates;
  const updates = [];

  for (const { row, best } of selected) {
    const altFallback = best.alt || row.name || row.slug;
    const payload = {
      image: rewriteJsonField(row.image, best.public_url, altFallback),
      hero: rewriteJsonField(row.hero, best.public_url, altFallback),
      og_image: rewriteJsonField(row.og_image, best.public_url, altFallback),
      gallery: rewriteGallery(row.gallery, best.public_url, altFallback),
      source_images: rewriteSourceImages(row.source_images, best.public_url, altFallback),
      updated_at: new Date().toISOString()
    };
    updates.push({ slug: row.slug, payload, sourceUrl: best.public_url });
    if (apply) {
      const { error } = await supabase.from("mithron_products").update(payload).eq("slug", row.slug);
      if (error) throw new Error(`update failed for ${row.slug}: ${error.message}`);
    }
  }

  for (const row of products ?? []) {
    if (productHasWix(row) && !selected.some((item) => item.row.slug === row.slug)) {
      stillOnWix.push(row.slug);
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "APPLIED" : "DRY_RUN",
        scannedProducts: products?.length ?? 0,
        candidates: candidates.length,
        updated: updates.length,
        stillOnWix: stillOnWix.length,
        noSupabaseLink: noSupabaseLink.length,
        updatedSample: updates.slice(0, 10).map((item) => ({
          slug: item.slug,
          sourceUrl: item.sourceUrl
        })),
        stillOnWixSample: stillOnWix.slice(0, 20),
        noSupabaseLinkSample: noSupabaseLink.slice(0, 20)
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
