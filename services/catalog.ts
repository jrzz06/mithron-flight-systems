import { cache } from "react";
import type { Bundle, MediaAsset, Product, ProductVariant, StorySection } from "@/config/types";
import { getProductMarketingTagline } from "@/lib/product-marketing-copy";
import { clipProductPreviewText } from "@/lib/product-preview-text";
import {
  classifyProductShelf,
  filterDroneCareProducts,
  filterDroneWorldProducts,
  type ProductShelfInput
} from "@/lib/product-shelf-classification";
import {
  filterProductsForCategorySlug,
  isCatalogCategorySlug
} from "@/lib/catalog-categories";
import { formatAvailability, isSpecLikeBlob, parseInlineSpecPairs } from "@/lib/product-spec-text";
import { customerFacingAvailability } from "@/services/inventory-csv";
import { resolveStorefrontSrc } from "@/lib/media/resolve-storefront-src";

type JsonRecord = Record<string, unknown>;

type MithronProductRow = {
  slug: string;
  product_url: string | null;
  workflow_status: "draft" | "pending_review" | "published" | "rejected" | "archived" | null;
  published_at: string | null;
  archived_at: string | null;
  is_visible: boolean | null;
  name: string;
  tagline: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: JsonRecord | null;
  price: number | string | null;
  compare_at: number | string | null;
  badge: string | null;
  category: string;
  interests: string[] | null;
  image: JsonRecord | null;
  hero: JsonRecord | null;
  gallery: JsonRecord[] | null;
  hotspots: Product["hotspots"] | null;
  variants: ProductVariant[] | null;
  bundles: Bundle[] | null;
  story: StorySection[] | null;
  specs: Record<string, string> | null;
  anchors: string[] | null;
  sort_order: number | null;
  source_url: string | null;
  source_catalog_id: string | null;
  source_description: string | null;
  source_images: Array<{ src?: string; width?: number | null; height?: number | null }> | null;
  source_availability: string | null;
  source_currency: string | null;
};

type SourceImageRecord = { src?: string; width?: number | string | null; height?: number | string | null };
type ProductAffinityRow = Pick<MithronProductRow, "slug" | "category" | "interests">;

type MithronProductShellRow = Pick<
  MithronProductRow,
  "slug" | "name" | "tagline" | "price" | "badge" | "category" | "interests" | "image" | "hero" | "gallery" | "source_catalog_id" | "source_description" | "source_images"
>;

type ProductMediaLinkRow = {
  product_slug: string | null;
  media_asset_id: string | null;
  usage: string | null;
  variant_id: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
  alt_text: string | null;
  caption: string | null;
};

type MediaAssetRow = {
  id: string | null;
  public_url: string | null;
  mime_type: string | null;
  width: number | string | null;
  height: number | string | null;
  alt: string | null;
  alt_text: string | null;
  caption: string | null;
};

export type ProductShellItem = {
  slug: string;
  name: string;
  tagline: string;
  price: number;
  badge?: string;
  category: string;
  interests: string[];
  image: MediaAsset;
  searchText: string;
};

const homepageProductSelect = [
  "slug",
  "product_url",
  "workflow_status",
  "published_at",
  "archived_at",
  "is_visible",
  "name",
  "tagline",
  "price",
  "compare_at",
  "badge",
  "category",
  "interests",
  "image",
  "hero",
  "source_catalog_id",
  "source_description",
  "source_availability",
  "source_currency",
  "source_url",
  "sort_order"
].join(",");

const HOMEPAGE_PRODUCT_LIMIT = 80;
// TODO: replace with cursor pagination
const CATALOG_LIST_LIMIT = 500;
const PRODUCT_MEDIA_LIMIT = 2000;
const LEGACY_WIX_INVENTORY_CATEGORY = "Imported Wix Inventory";
const publishedCatalogFilter = `workflow_status=eq.published&is_visible=eq.true&category=neq.${encodeURIComponent(LEGACY_WIX_INVENTORY_CATEGORY)}`;

const catalogListSelect = [
  "slug",
  "product_url",
  "workflow_status",
  "published_at",
  "archived_at",
  "is_visible",
  "name",
  "tagline",
  "price",
  "compare_at",
  "badge",
  "category",
  "interests",
  "image",
  "hero",
  "sort_order",
  "source_catalog_id",
  "source_availability",
  "source_currency"
].join(",");

const productSelect = [
  "slug",
  "product_url",
  "workflow_status",
  "published_at",
  "archived_at",
  "is_visible",
  "name",
  "tagline",
  "seo_title",
  "seo_description",
  "og_title",
  "og_description",
  "og_image",
  "price",
  "compare_at",
  "badge",
  "category",
  "interests",
  "image",
  "hero",
  "gallery",
  "hotspots",
  "variants",
  "bundles",
  "story",
  "specs",
  "anchors",
  "sort_order",
  "source_url",
  "source_catalog_id",
  "source_description",
  "source_images",
  "source_availability",
  "source_currency"
].join(",");

function decodeHtml(value: string) {
  return value
    .replace(/&#009;/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCatalogRows<T>(text: string): T[] {
  try {
    return JSON.parse(text) as T[];
  } catch (error) {
    const sanitized = text.replace(/[\u0000-\u001F]/g, " ");
    if (sanitized === text) throw error;
    try {
      return JSON.parse(sanitized) as T[];
    } catch (sanitizedError) {
      const message = sanitizedError instanceof Error ? sanitizedError.message : String(sanitizedError);
      throw new Error(`Failed to parse mithron_products catalog response after control-character cleanup: ${message}`);
    }
  }
}

function cleanText(value: unknown, fallback = "") {
  return decodeHtml(typeof value === "string" ? value : fallback);
}

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

const minimumTrustedCatalogImageEdge = 720;

function parseFiniteDimension(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : undefined;
}

function normalizeProductImageSrc(src: string) {
  return resolveStorefrontSrc(src);
}

function trustedCatalogDimensions(rawSrc: string, width: unknown, height: unknown) {
  const parsedWidth = parseFiniteDimension(width);
  const parsedHeight = parseFiniteDimension(height);
  if (!parsedWidth || !parsedHeight) return { width: undefined, height: undefined };

  const largestEdge = Math.max(parsedWidth, parsedHeight);
  if (largestEdge < minimumTrustedCatalogImageEdge) {
    return { width: undefined, height: undefined };
  }

  return { width: parsedWidth, height: parsedHeight };
}

function mediaArea(asset: MediaAsset) {
  return (asset.width ?? 0) * (asset.height ?? 0);
}

function mediaQualityScore(asset: MediaAsset, index: number) {
  const area = mediaArea(asset);
  const sourceRank = asset.src.includes("/storage/v1/object/public/") ? 3 : asset.src.startsWith("/") ? 2 : 1;
  return area + sourceRank * 10_000 - index;
}

function mediaFromJson(value: JsonRecord | undefined | null, fallbackAlt: string): MediaAsset | null {
  const src = typeof value?.src === "string" ? value.src.trim() : null;
  if (!src) return null;
  const record = value as JsonRecord;
  const dimensions = trustedCatalogDimensions(src, record.width, record.height);
  const normalizedSrc = normalizeProductImageSrc(src);
  return {
    id: typeof record.id === "string" ? record.id : undefined,
    src: normalizedSrc,
    alt: cleanText(record.alt, fallbackAlt),
    kind: record.kind === "video" || record.kind === "model" ? record.kind : "image",
    width: dimensions.width,
    height: dimensions.height,
    poster: typeof record.poster === "string" ? record.poster : undefined,
    local: typeof record.local === "boolean" ? record.local : normalizedSrc.startsWith("/")
  };
}

function mediaFromSourceImage(image: SourceImageRecord | undefined, alt: string): MediaAsset | null {
  if (!image || typeof image.src !== "string") return null;
  const src = image.src.trim();
  if (!src) return null;
  const dimensions = trustedCatalogDimensions(src, image.width, image.height);
  const normalizedSrc = normalizeProductImageSrc(src);
  return {
    src: normalizedSrc,
    alt,
    kind: "image",
    width: dimensions.width,
    height: dimensions.height,
    local: normalizedSrc.startsWith("/")
  };
}

function mediaFromMediaAssetRow(row: MediaAssetRow | undefined, fallbackAlt: string): MediaAsset | null {
  const src = typeof row?.public_url === "string" ? row.public_url.trim() : "";
  if (!src) return null;
  const dimensions = trustedCatalogDimensions(src, row?.width, row?.height);
  if (!dimensions.width || !dimensions.height) return null;
  const kind = row?.mime_type?.startsWith("video/") ? "video" : "image";

  return {
    id: typeof row?.id === "string" ? row.id : undefined,
    src,
    alt: cleanText(row?.alt_text ?? row?.alt ?? row?.caption, fallbackAlt),
    kind,
    width: dimensions.width,
    height: dimensions.height,
    local: false
  };
}

function selectPrimaryProductImage(row: Pick<MithronProductRow, "image" | "hero" | "gallery" | "source_images">, alt: string) {
  const candidates = [
    mediaFromJson(row.image, alt),
    mediaFromJson(row.hero, alt),
    ...(row.gallery ?? []).map((item) => mediaFromJson(item, alt)),
    ...(row.source_images ?? []).map((item) => mediaFromSourceImage(item, alt))
  ].filter((item): item is MediaAsset => Boolean(item));

  return candidates
    .map((asset, index) => ({ asset, score: mediaQualityScore(asset, index) }))
    .sort((left, right) => right.score - left.score)[0]?.asset ?? null;
}

function dedupeMediaAssets(items: MediaAsset[]) {
  return items.filter((item, index, list) => list.findIndex((candidate) => candidate.src === item.src) === index);
}

function postgrestIn(values: string[]) {
  return `in.(${values.map((value) => `"${value.replace(/"/g, "\"\"")}"`).join(",")})`;
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

const PLACEHOLDER_VARIANT_IDS = new Set(["csv-stock", "source", "default", "stock"]);
const PLACEHOLDER_VARIANT_NAMES = /^(csv\s*stock(\s*row)?|source\s*listing|default|in\s*stock)$/i;

function isPlaceholderVariant(variant: ProductVariant) {
  return PLACEHOLDER_VARIANT_IDS.has(variant.id.trim().toLowerCase())
    || PLACEHOLDER_VARIANT_NAMES.test(cleanText(variant.name).trim());
}

function normalizeVariant(row: MithronProductRow): ProductVariant[] {
  const variants = row.variants?.filter((variant) => !isPlaceholderVariant(variant)) ?? [];
  if (variants.length) return variants;

  const availability = customerFacingAvailability(row.source_availability);
  return [{ id: "availability", name: availability, tone: "#16a34a" }];
}

function normalizeBundleDescription(value: string, fallback: string) {
  const raw = cleanText(value, fallback);
  if (isSpecLikeBlob(raw)) return "";

  const clean = clipProductPreviewText(raw, 140);
  if (isSpecLikeBlob(clean)) return "";
  if (clean && isSpecLikeBlob(fallback)) return clean;

  const clippedFallback = clipProductPreviewText(fallback, 140);
  return clean || (isSpecLikeBlob(clippedFallback) ? "" : clippedFallback);
}

function normalizeBundles(row: MithronProductRow, description: string): Bundle[] {
  if (row.bundles?.length) {
    return row.bundles.map((bundle) => ({
      ...bundle,
      description: normalizeBundleDescription(bundle.description, description),
      price: toNumber(bundle.price),
      compareAt: bundle.compareAt ? toNumber(bundle.compareAt) : undefined
    }));
  }

  return [{
    id: "standard",
    name: "Standard configuration",
    price: toNumber(row.price),
    compareAt: row.compare_at ? toNumber(row.compare_at) : undefined,
    description: isSpecLikeBlob(description) ? "" : clipProductPreviewText(description, 140),
    includes: []
  }];
}

const INTERNAL_SPEC_KEYS = new Set(["Product ID", "Source", "Currency", "Category", "Availability"]);

function countCustomerFacingSpecs(specs: Record<string, string>) {
  return Object.entries(specs).filter(([key, value]) => !INTERNAL_SPEC_KEYS.has(key) && value.trim()).length;
}

function normalizeSpecs(row: MithronProductRow) {
  const specs = Object.fromEntries(
    Object.entries(row.specs ?? {}).map(([key, value]) => [key, cleanText(value)])
  );

  const merged: Record<string, string> = {
    "Product ID": row.source_catalog_id ?? row.slug,
    Category: row.category,
    Availability: formatAvailability(customerFacingAvailability(row.source_availability, specs.Availability ?? "Unknown")),
    Currency: row.source_currency ?? specs.Currency ?? "INR",
    ...specs,
    Source: row.source_url ?? specs.Source ?? "Mithron product database"
  };

  if (countCustomerFacingSpecs(merged) < 3) {
    const parsed = parseInlineSpecPairs(row.source_description ?? row.tagline ?? "");
    for (const [key, value] of Object.entries(parsed)) {
      if (!merged[key]?.trim()) merged[key] = value;
    }
  }

  return merged;
}

function normalizeStory(row: MithronProductRow, marketingTagline: string, hero: MediaAsset): StorySection[] {
  if (row.story?.length) {
    return row.story.map((section) => ({
      ...section,
      title: cleanText(section.title),
      body: clipProductPreviewText(cleanText(section.body), 1200),
      media: section.media ?? hero
    }));
  }

  const name = cleanText(row.name);

  return [{
    id: "overview",
    kicker: cleanText(row.category) || "Overview",
    title: name,
    body: marketingTagline,
    media: hero,
    align: "center"
  }];
}

function isCatalogCutoutSrc(src: string) {
  return src.includes("/catalog-cutouts/");
}

function resolveProductImage(
  row: Pick<MithronProductRow, "image" | "hero" | "gallery" | "source_images">,
  name: string,
  linkedMedia?: MediaAsset
) {
  const rowImage = selectPrimaryProductImage(row, name);
  if (linkedMedia && isCatalogCutoutSrc(linkedMedia.src)) return linkedMedia;
  if (rowImage) return rowImage;
  if (linkedMedia) return linkedMedia;
  return null;
}

function mapProductRow(row: MithronProductRow, linkedPrimaryImage?: MediaAsset): Product {
  const name = cleanText(row.name);
  const marketingTagline = getProductMarketingTagline({
    name,
    category: row.category,
    tagline: row.tagline,
    sourceDescription: row.source_description
  });
  const sourceImages = row.source_images ?? [];
  const image = resolveProductImage(row, name, linkedPrimaryImage);

  if (!image) {
    throw new Error(`Missing source image for Mithron product ${row.slug}.`);
  }

  const hero = mediaFromJson(row.hero, name) ?? image;
  const gallery = [
    image,
    ...(row.gallery ?? []).map((item) => mediaFromJson(item, name)).filter((item): item is MediaAsset => Boolean(item)),
    ...sourceImages.map((item) => mediaFromSourceImage(item, name)).filter((item): item is MediaAsset => Boolean(item))
  ];
  const dedupedGallery = dedupeMediaAssets(gallery);

  return {
    slug: row.slug,
    productUrl: row.product_url ?? `/product/${row.slug}`,
    workflowStatus: row.workflow_status ?? "published",
    publishedAt: row.published_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    isVisible: row.is_visible ?? true,
    name,
    tagline: marketingTagline,
    seoTitle: row.seo_title ?? undefined,
    seoDescription: row.seo_description ?? undefined,
    ogTitle: row.og_title ?? undefined,
    ogDescription: row.og_description ?? undefined,
    ogImage: mediaFromJson(row.og_image, name) ?? undefined,
    price: toNumber(row.price),
    compareAt: row.compare_at ? toNumber(row.compare_at) : undefined,
    badge: row.badge ?? undefined,
    category: row.category,
    interests: row.interests ?? [],
    image,
    hero,
    gallery: dedupedGallery.length ? dedupedGallery : [image],
    hotspots: row.hotspots ?? [],
    variants: normalizeVariant(row),
    bundles: normalizeBundles(row, marketingTagline),
    story: normalizeStory(row, marketingTagline, hero),
    specs: normalizeSpecs(row),
    anchors: row.anchors?.length ? row.anchors : ["Overview", "Specs", "FAQ"]
  };
}

function mapProductShellRow(row: MithronProductShellRow, linkedPrimaryImage?: MediaAsset): ProductShellItem {
  const name = cleanText(row.name);
  const tagline = getProductMarketingTagline({
    name,
    category: row.category,
    tagline: row.tagline,
    sourceDescription: row.source_description
  });
  const image = resolveProductImage(row, name, linkedPrimaryImage);

  if (!image) {
    throw new Error(`Missing source image for Mithron product ${row.slug}.`);
  }

  const interestsValue = row.interests ?? [];
  return {
    slug: row.slug,
    name,
    tagline,
    price: toNumber(row.price),
    badge: row.badge ?? undefined,
    category: row.category,
    interests: interestsValue,
    image,
    searchText: [
      name,
      tagline,
      row.category,
      row.slug,
      row.source_catalog_id ?? "",
      row.source_description ?? "",
      ...interestsValue
    ].join(" ").toLowerCase()
  };
}

export const getProductShellItems = cache(async (limit = CATALOG_LIST_LIMIT): Promise<ProductShellItem[]> => {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), CATALOG_LIST_LIMIT);
  const rows = await fetchCatalogRows<MithronProductShellRow>(
    `select=slug,name,tagline,price,badge,category,interests,image,hero,gallery,source_images,source_catalog_id,source_description&${publishedCatalogFilter}&order=sort_order.asc&limit=${boundedLimit}`
  );
  return mapRowsWithPrimaryMedia(rows, mapProductShellRow);
});

export async function getRelatedProductShellItems(slug: string, limit = 4): Promise<ProductShellItem[]> {
  const [products, currentRow] = await Promise.all([getProductShellItems(), getProductAffinityRowBySlug(slug)]);
  const currentProduct = products.find((product) => product.slug === slug);
  const fallback = products.filter((product) => product.slug !== slug);

  if (!currentRow || !currentProduct) return fallback.slice(0, limit);

  const shelfInputs = products as unknown as ProductShelfInput[];
  const shelfProducts = classifyProductShelf({
    slug: currentProduct.slug,
    name: currentProduct.name,
    tagline: currentProduct.tagline,
    category: currentProduct.category,
    interests: currentProduct.interests,
    specs: {}
  }) === "drone-care"
    ? filterDroneCareProducts(shelfInputs)
    : filterDroneWorldProducts(shelfInputs);
  const currentInterests = currentRow.interests ?? [];

  const related = shelfProducts.filter((product) => (
    product.slug !== slug && (
      product.category === currentRow.category ||
      product.interests.some((interest) => currentInterests.includes(interest))
    )
  ));

  return (related.length ? related : shelfProducts.filter((product) => product.slug !== slug)).slice(0, limit) as unknown as ProductShellItem[];
}

function getCatalogConfig(useServiceRole = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = useServiceRole ? serviceRoleKey ?? publicKey : publicKey;

  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required for the product catalog.");
  }

  return { url, key, hasServiceRoleKey: Boolean(serviceRoleKey) };
}

const catalogFetchAttempts = 3;

function isRetryableCatalogStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSupabaseRows<T>(table: string, query: string, useServiceRole = false): Promise<T[]> {
  const { url, key } = getCatalogConfig(useServiceRole);

  let lastError: unknown;
  for (let attempt = 1; attempt <= catalogFetchAttempts; attempt += 1) {
    try {
      const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        },
        next: { revalidate: 300, tags: ["catalog", "catalog-products"] }
      });

      if (!response.ok) {
        const error = new Error(`Failed to load ${table} from Supabase: ${response.status} ${response.statusText}`);
        if (attempt < catalogFetchAttempts && isRetryableCatalogStatus(response.status)) {
          lastError = error;
          await wait(250 * attempt * attempt);
          continue;
        }
        throw error;
      }

      return parseCatalogRows<T>(await response.text());
    } catch (error) {
      lastError = error;
      if (attempt >= catalogFetchAttempts) break;
      await wait(250 * attempt * attempt);
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Failed to load ${table} from Supabase after ${catalogFetchAttempts} attempts: ${message}`);
}

async function fetchCatalogRows<T>(query: string): Promise<T[]> {
  return fetchSupabaseRows<T>("mithron_products", query);
}

async function fetchMediaAssetsById(mediaIds: string[]) {
  const chunks = chunkItems(mediaIds, 40);
  const chunkResults = await Promise.all(
    chunks.map((chunk) => fetchSupabaseRows<MediaAssetRow>(
      "media_assets",
      `select=id,public_url,mime_type,width,height,alt,alt_text,caption&id=${encodeURIComponent(postgrestIn(chunk))}&limit=${chunk.length}`,
      true
    ))
  );

  const mediaRows = chunkResults.flat();
  return new Map(mediaRows.map((row) => [row.id, row]));
}

const getPrimaryProductMediaLookup = cache(async (): Promise<Map<string, MediaAsset>> => {
  const { hasServiceRoleKey } = getCatalogConfig(true);
  if (!hasServiceRoleKey) return new Map();

  const links = await fetchSupabaseRows<ProductMediaLinkRow>(
    "product_media_assets",
    `select=product_slug,media_asset_id,usage,is_primary,sort_order,alt_text,caption&usage=eq.primary&is_primary=eq.true&limit=${PRODUCT_MEDIA_LIMIT}`,
    true
  );
  const mediaIds = [...new Set(links.map((link) => link.media_asset_id).filter((id): id is string => Boolean(id)))];
  if (!mediaIds.length) return new Map();

  const mediaById = await fetchMediaAssetsById(mediaIds);
  const lookup = new Map<string, MediaAsset>();

  for (const link of links.sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))) {
    if (!link.product_slug || !link.media_asset_id || lookup.has(link.product_slug)) continue;
    const media = mediaFromMediaAssetRow(mediaById.get(link.media_asset_id), link.alt_text ?? link.caption ?? link.product_slug);
    if (media) lookup.set(link.product_slug, media);
  }

  return lookup;
});

const getCatalogCutoutMediaLookup = cache(async (): Promise<Map<string, MediaAsset>> => {
  const { hasServiceRoleKey } = getCatalogConfig(true);
  if (!hasServiceRoleKey) return new Map();

  const links = await fetchSupabaseRows<ProductMediaLinkRow>(
    "product_media_assets",
    `select=product_slug,media_asset_id,usage,variant_id,is_primary,sort_order,alt_text,caption&usage=eq.cms&variant_id=eq.catalog-cutout-v1&limit=${PRODUCT_MEDIA_LIMIT}`,
    true
  );
  const mediaIds = [...new Set(links.map((link) => link.media_asset_id).filter((id): id is string => Boolean(id)))];
  if (!mediaIds.length) return new Map();

  const mediaById = await fetchMediaAssetsById(mediaIds);
  const lookup = new Map<string, MediaAsset>();

  for (const link of links.sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0))) {
    if (!link.product_slug || !link.media_asset_id || lookup.has(link.product_slug)) continue;
    const media = mediaFromMediaAssetRow(mediaById.get(link.media_asset_id), link.alt_text ?? link.caption ?? link.product_slug);
    if (media) lookup.set(link.product_slug, media);
  }

  return lookup;
});

async function mapRowsWithPrimaryMedia<T extends Pick<MithronProductRow, "slug">, R>(
  rows: T[],
  mapper: (row: T, media?: MediaAsset) => R
) {
  const mediaLookup = await getPrimaryProductMediaLookup();
  return rows.map((row) => mapper(row, mediaLookup.get(row.slug)));
}

export const getHomepageProducts = cache(async (): Promise<Product[]> => {
  const rows = await fetchCatalogRows<MithronProductRow>(
    `select=${homepageProductSelect}&${publishedCatalogFilter}&order=sort_order.asc&limit=${HOMEPAGE_PRODUCT_LIMIT}`
  );
  const primaryMedia = await getPrimaryProductMediaLookup();
  let catalogCutouts = new Map<string, MediaAsset>();

  try {
    catalogCutouts = await getCatalogCutoutMediaLookup();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] catalog cutout media lookup failed; falling back to primary product images: ${message}`);
  }

  return rows.map((row) => mapHomepageProductRow(row, catalogCutouts.get(row.slug) ?? primaryMedia.get(row.slug)));
});

function mapHomepageProductRow(row: MithronProductRow, linkedPrimaryImage?: MediaAsset): Product {
  const shelfRow = {
    ...row,
    gallery: [] as MithronProductRow["gallery"],
    hotspots: [] as MithronProductRow["hotspots"],
    variants: [] as MithronProductRow["variants"],
    bundles: [] as MithronProductRow["bundles"],
    story: [] as MithronProductRow["story"],
    specs: {} as MithronProductRow["specs"],
    anchors: [] as MithronProductRow["anchors"],
    source_images: [] as MithronProductRow["source_images"]
  } satisfies MithronProductRow;
  const product = mapProductRow(shelfRow, linkedPrimaryImage);
  return {
    ...product,
    gallery: [product.image],
    variants: [],
    bundles: [],
    hotspots: [],
    story: product.story.slice(0, 1)
  };
}

export const getProducts = cache(async (): Promise<Product[]> => {
  // TODO: replace with cursor pagination
  const rows = await fetchCatalogRows<MithronProductRow>(`select=${catalogListSelect}&${publishedCatalogFilter}&order=sort_order.asc&limit=${CATALOG_LIST_LIMIT}`);
  return mapRowsWithPrimaryMedia(rows, mapProductRow);
});

export const getProductAffinityRowBySlug = cache(async (slug: string): Promise<ProductAffinityRow | null> => {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;
  const rows = await fetchCatalogRows<ProductAffinityRow>(
    `select=slug,category,interests&slug=eq.${encodeURIComponent(normalizedSlug)}&${publishedCatalogFilter}&limit=1`
  );
  return rows[0] ?? null;
});

export const getCatalogShowroomProducts = cache(async (): Promise<Product[]> => {
  // TODO: replace with cursor pagination
  const rows = await fetchCatalogRows<MithronProductRow>(`select=${catalogListSelect}&${publishedCatalogFilter}&order=sort_order.asc&limit=${CATALOG_LIST_LIMIT}`);
  const primaryMedia = await getPrimaryProductMediaLookup();
  let catalogCutouts = new Map<string, MediaAsset>();

  try {
    catalogCutouts = await getCatalogCutoutMediaLookup();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] catalog cutout media lookup failed; falling back to primary product images: ${message}`);
  }

  const products = rows.map((row) => mapProductRow(row, catalogCutouts.get(row.slug) ?? primaryMedia.get(row.slug)));
  return filterDroneWorldProducts(products);
});

export const getProductRowBySlug = cache(async (slug: string) => {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;
  const rows = await fetchCatalogRows<MithronProductRow>(
    `select=${productSelect}&slug=eq.${encodeURIComponent(normalizedSlug)}&${publishedCatalogFilter}&limit=1`
  );
  return rows[0] ?? null;
});

export async function getProductBySlug(slug: string) {
  const row = await getProductRowBySlug(slug);
  if (!row) return undefined;
  const primaryMedia = await getPrimaryProductMediaLookup();
  let catalogCutouts = new Map<string, MediaAsset>();

  try {
    catalogCutouts = await getCatalogCutoutMediaLookup();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] catalog cutout media lookup failed; falling back to primary product images: ${message}`);
  }

  return mapProductRow(row, catalogCutouts.get(row.slug) ?? primaryMedia.get(row.slug));
}

export async function getProductStaticSlugs() {
  // TODO: replace with cursor pagination
  const rows = await fetchCatalogRows<{ slug: string }>(
    `select=slug&${publishedCatalogFilter}&order=sort_order.asc&limit=${CATALOG_LIST_LIMIT}`
  );
  return rows.map((product) => product.slug).filter(Boolean);
}

export async function getFeaturedProducts() {
  const products = filterDroneWorldProducts(await getProducts());
  return products.filter((product) => product.category !== "Surveillance Drones").slice(0, 24);
}

export async function getDroneWorldProducts() {
  return filterDroneWorldProducts(await getProducts());
}

export async function getDroneCareProducts() {
  return filterDroneCareProducts(await getProducts());
}

export async function getProductsByInterest(interestSlug: string) {
  const products = await getProducts();
  const matched = products.filter((product) => product.interests.includes(interestSlug));
  if (interestSlug === "components") {
    return filterDroneCareProducts(matched);
  }
  return filterDroneWorldProducts(matched);
}

export async function getProductsByCategory(category: string) {
  const normalized = category.toLowerCase();
  const products = await getProducts();
  return products.filter((product) => product.category.toLowerCase().includes(normalized));
}

export async function searchProducts(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const products = await getProducts();
  return products.filter((product) => {
    const haystack = [
      product.name,
      product.tagline,
      product.category,
      product.slug,
      product.specs["Product ID"],
      ...product.interests
    ].join(" ").toLowerCase();
    return haystack.includes(normalized);
  });
}

export async function getProductsForCategorySlug(slug: string) {
  if (!isCatalogCategorySlug(slug)) return [];
  const products = await getProducts();
  return filterProductsForCategorySlug(products, slug);
}

export async function getGlobalProductsForCatalog() {
  return getProductsForCategorySlug("global-products");
}

export async function getProductsForCatalog(route: "agriculture" | "videoDrones" | "creativeDrones" | "accessories" | "industrial" | "mapping" | "surveillance") {
  const routeToSlug = {
    agriculture: "agri-drones",
    videoDrones: "video-drones",
    creativeDrones: "creative-drones",
    mapping: "survey-drones",
    surveillance: "surveillance-drones",
    accessories: "accessories",
    industrial: "global-products"
  } as const;

  return getProductsForCategorySlug(routeToSlug[route]);
}

export async function getRelatedProducts(slug: string, limit = 4) {
  const products = await getProducts();
  const current = products.find((product) => product.slug === slug);
  if (!current) return products.slice(0, limit);

  const shelfProducts = classifyProductShelf(current) === "drone-care"
    ? filterDroneCareProducts(products)
    : filterDroneWorldProducts(products);

  const related = shelfProducts.filter((product) => product.slug !== slug && (
    product.category === current.category ||
    product.interests.some((interest) => current.interests.includes(interest))
  ));
  return (related.length ? related : shelfProducts.filter((product) => product.slug !== slug)).slice(0, limit);
}
