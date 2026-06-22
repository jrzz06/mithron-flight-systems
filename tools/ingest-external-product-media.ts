import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { buildPrimaryMediaBackfill } from "../lib/media/backfill-primary-media.ts";

const { loadEnvConfig } = nextEnv;

const BUCKET = "mithron-products";
const LEGACY_CATEGORY = "Imported Wix Inventory";

type ProductRow = {
  slug: string;
  name: string;
  image: { src?: string; alt?: string; width?: number; height?: number; kind?: string } | null;
  hero: ProductRow["image"];
  gallery: ProductRow["image"][] | null;
  description?: string | null;
};

function isSupabaseStorageUrl(url: string) {
  return url.includes(".supabase.co/storage/v1/object/public/");
}

function hashBuffer(buffer: Buffer, size = 8) {
  return createHash("sha256").update(buffer).digest("hex").slice(0, size);
}

function buildMediaJson(src: string, alt: string, width: number, height: number) {
  return {
    src,
    alt,
    kind: "image" as const,
    width,
    height,
    local: false
  };
}

function isJunkDescription(description: string | null | undefined) {
  if (!description?.trim()) return false;
  const text = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!text) return true;
  return /gettyimages\.com/.test(text)
    || /^(df|ss|sfafse)(\s|$)/.test(text)
    || /^[a-z0-9-]+ catalog listing\.?$/.test(text);
}

export function parseCliArgs(argv: string[]) {
  const args = new Set(argv);
  const slugArg = argv.find((arg) => arg.startsWith("--slug="));
  return {
    apply: args.has("--apply"),
    all: args.has("--all"),
    slug: slugArg ? slugArg.slice("--slug=".length).trim() : undefined
  };
}

async function fetchPublishedProducts(supabase: ReturnType<typeof createClient>, slug?: string) {
  let query = supabase
    .from("mithron_products")
    .select("slug,name,image,hero,gallery,description")
    .eq("workflow_status", "published")
    .eq("is_visible", true)
    .neq("category", LEGACY_CATEGORY);

  if (slug) query = query.eq("slug", slug);

  const { data, error } = await query.limit(500);
  if (error) throw new Error(`Failed to fetch products: ${error.message}`);
  return (data ?? []) as ProductRow[];
}

async function ingestProductImage(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  product: ProductRow
) {
  const src = typeof product.image?.src === "string" ? product.image.src.trim() : "";
  if (!src) return { slug: product.slug, status: "skipped", reason: "missing_image_src" as const };
  if (isSupabaseStorageUrl(src)) return { slug: product.slug, status: "skipped", reason: "already_on_supabase" as const };

  const response = await fetch(src, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to download image for ${product.slug}: ${response.status} ${response.statusText}`);
  }

  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const optimized = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: 480, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const contentHash = hashBuffer(optimized.data);
  const storagePath = `${product.slug}-480w-enh-v1.${contentHash}.webp`;
  const publicUrl = `${supabaseUrl.replace(/\/+$/g, "")}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  const alt = product.image?.alt?.trim() || product.name;
  const media = buildMediaJson(publicUrl, alt, optimized.info.width, optimized.info.height);

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, optimized.data, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "31536000"
  });
  if (uploadError) throw new Error(`Storage upload failed for ${product.slug}: ${uploadError.message}`);

  const description = isJunkDescription(product.description)
    ? `<p>${product.name} is available from the Mithron catalog. Contact sales for specifications and deployment support.</p>`
    : product.description;

  const { error: updateError } = await supabase
    .from("mithron_products")
    .update({
      image: media,
      hero: media,
      gallery: [media],
      ...(description !== product.description ? { description } : {})
    })
    .eq("slug", product.slug);

  if (updateError) throw new Error(`Product update failed for ${product.slug}: ${updateError.message}`);

  return {
    slug: product.slug,
    status: "ingested" as const,
    publicUrl,
    storagePath,
    width: optimized.info.width,
    height: optimized.info.height,
    descriptionCleaned: description !== product.description
  };
}

async function applyPrimaryBackfill(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  slugs: string[]
) {
  if (!slugs.length) return { linked: 0 };

  const { data: products, error } = await supabase
    .from("mithron_products")
    .select("slug,name,image")
    .in("slug", slugs);
  if (error) throw new Error(error.message);

  const { data: links, error: linksError } = await supabase
    .from("product_media_assets")
    .select("product_slug")
    .eq("usage", "primary")
    .eq("is_primary", true)
    .in("product_slug", slugs);
  if (linksError) throw new Error(linksError.message);

  const linkedSlugs = new Set((links ?? []).map((row) => row.product_slug).filter(Boolean));
  const backfill = buildPrimaryMediaBackfill({
    products: products ?? [],
    linkedSlugs,
    supabaseUrl
  });

  if (backfill.mediaAssets.length) {
    const { error: mediaError } = await supabase
      .from("media_assets")
      .upsert(backfill.mediaAssets, { onConflict: "id", ignoreDuplicates: true });
    if (mediaError) throw new Error(mediaError.message);
  }

  if (backfill.productMediaAssets.length) {
    const { error: linkError } = await supabase
      .from("product_media_assets")
      .upsert(backfill.productMediaAssets, { onConflict: "product_slug,media_asset_id,usage", ignoreDuplicates: true });
    if (linkError) throw new Error(linkError.message);
  }

  return { linked: backfill.productMediaAssets.length };
}

async function main() {
  loadEnvConfig(process.cwd());
  const options = parseCliArgs(process.argv.slice(2));
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }
  if (!options.apply) {
    throw new Error("Pass --apply to upload external product images. Use --slug=layam or --all.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const products = await fetchPublishedProducts(supabase, options.all ? undefined : options.slug);
  const external = products.filter((product) => {
    const src = product.image?.src?.trim() ?? "";
    return src && !isSupabaseStorageUrl(src);
  });

  if (!external.length) {
    console.log(JSON.stringify({ status: "noop", message: "No external product images found." }, null, 2));
    return;
  }

  const results = [];
  for (const product of external) {
    results.push(await ingestProductImage(supabase, supabaseUrl, product));
  }

  const ingestedSlugs = results
    .filter((result) => result.status === "ingested")
    .map((result) => result.slug);
  const backfill = await applyPrimaryBackfill(supabase, supabaseUrl, ingestedSlugs);

  console.log(JSON.stringify({
    status: "applied",
    processed: results.length,
    ingested: ingestedSlugs.length,
    primaryLinksCreated: backfill.linked,
    results
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
