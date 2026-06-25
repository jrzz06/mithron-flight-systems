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
  catalogCategoryDefinitions,
  filterProductsForCategorySlug,
  isCatalogCategorySlug,
  type CatalogCategoryDefinition
} from "@/lib/catalog-categories";
import { dedupeProductsBySlug } from "@/lib/catalog-shelf-layout";
import {
  getFeaturedFromCatalogIndex,
  searchCatalogIndex,
  type CatalogSearchIndexEntry
} from "@/lib/catalog-search-index";
import { formatAvailability, isSpecLikeBlob, parseInlineSpecPairs } from "@/lib/product-spec-text";
import { customerFacingAvailability } from "@/services/inventory-csv";
import type { OrderCatalogProduct } from "@/services/orders";
import { resolveStorefrontSrc } from "@/lib/media/resolve-storefront-src";
import { buildProductResponsiveAsset } from "@/lib/media/product-responsive";

export type CatalogDataErrorCode = "missing_source_image";

export type CatalogDataError = {
  code: CatalogDataErrorCode;
  slug: string;
  message: string;
};

export type EnterpriseMenuLoadResult = {
  products: Product[];
  errors: CatalogDataError[];
};

export type ProductPageLoadResult =
  | { status: "ready"; product: Product }
  | { status: "not_found" }
  | { status: "error"; error: CatalogDataError };

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
  description: string | null;
  on_sale: boolean | null;
  discount_type: "percent" | "amount" | null;
  discount_value: number | string | null;
  cost_of_goods: number | string | null;
  show_price_per_unit: boolean | null;
  charge_tax: boolean | null;
  tax_group: string | null;
  tax_rate: number | string | null;
  tax_included: boolean | null;
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

type EnterpriseMenuProductRow = Pick<
  MithronProductRow,
  "slug" | "name" | "tagline" | "price" | "badge" | "category" | "interests" | "image" | "source_catalog_id" | "source_description" | "source_images"
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
  bucket?: string | null;
  storage_path?: string | null;
  public_url: string | null;
  mime_type: string | null;
  width: number | string | null;
  height: number | string | null;
  alt: string | null;
  alt_text: string | null;
  caption: string | null;
  thumbnail_path?: string | null;
  webp_path?: string | null;
  variants?: unknown;
  responsive_variants?: unknown;
};

const MEDIA_ASSET_SELECT =
  "id,bucket,storage_path,public_url,mime_type,width,height,alt,alt_text,caption,responsive_variants,variants";
const MEDIA_ASSET_CHUNK_SIZE = 20;

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

export type CatalogSearchResult = {
  slug: string;
  name: string;
  tagline: string;
  price: number;
  badge?: string;
  category: string;
  image: MediaAsset;
};

export type { CatalogSearchIndexEntry } from "@/lib/catalog-search-index";

type CatalogSearchIndexRow = MithronProductShellRow & Pick<MithronProductRow, "sort_order">;

type CatalogSearchRow = {
  slug: string;
  name: string;
  tagline: string | null;
  price: number | string | null;
  badge: string | null;
  category: string;
  image: JsonRecord | null;
  hero: JsonRecord | null;
  rank?: number | null;
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
const CATALOG_PAGE_SIZE = 200;
const CATALOG_MAX_ROWS = 10_000;
const SHELL_PREVIEW_LIMIT = 120;
const ENTERPRISE_MENU_PER_CATEGORY_LIMIT = 16;
const PRODUCT_MEDIA_LIMIT = 2000;
const CHECKOUT_PRICING_SELECT = "slug,name,price,category,charge_tax,tax_group,tax_rate,tax_included";
const catalogSearchIndexSelect = "slug,name,tagline,price,badge,category,interests,image,hero,source_catalog_id,source_description,sort_order";
const LEGACY_WIX_INVENTORY_CATEGORY = "Imported Wix Inventory";
const publishedCatalogFilter = `workflow_status=eq.published&is_visible=eq.true&category=neq.${encodeURIComponent(LEGACY_WIX_INVENTORY_CATEGORY)}&slug=not.like.audit-trace-*`;

const enterpriseMenuSelect = [
  "slug",
  "name",
  "tagline",
  "price",
  "badge",
  "category",
  "interests",
  "image",
  "source_images",
  "source_catalog_id",
  "source_description"
].join(",");

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
  "description",
  "on_sale",
  "discount_type",
  "discount_value",
  "cost_of_goods",
  "show_price_per_unit",
  "charge_tax",
  "tax_group",
  "tax_rate",
  "tax_included",
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

function isSupabaseStorageSrc(src: string) {
  return /^https?:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(src);
}

function isExternalHttpsSrc(src: string) {
  return /^https:\/\//i.test(src.trim());
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
  const sourceRank = asset.src.includes("/storage/v1/object/public/")
    ? 3
    : asset.src.startsWith("/")
      ? 2
      : isExternalHttpsSrc(asset.src)
        ? 1.5
        : 1;
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

function enrichImageWithLinkedResponsive(image: MediaAsset, linked?: MediaAsset): MediaAsset {
  if (!linked?.responsive || image.responsive) return image;
  const normalizedImageSrc = image.src.split("?")[0];
  const normalizedLinkedSrc = linked.src.split("?")[0];
  if (normalizedImageSrc === normalizedLinkedSrc) {
    return { ...image, responsive: linked.responsive };
  }
  return image;
}

function normalizeMediaAssetRow(row: MediaAssetRow): MediaAssetRow {
  return {
    ...row,
    responsive_variants: row.responsive_variants ?? row.variants
  };
}

function mediaFromMediaAssetRow(row: MediaAssetRow | undefined, fallbackAlt: string): MediaAsset | null {
  if (!row) return null;
  const normalizedRow = normalizeMediaAssetRow(row);
  const src = typeof normalizedRow.public_url === "string" ? normalizedRow.public_url.trim() : "";
  if (!src) return null;
  const dimensions = trustedCatalogDimensions(src, normalizedRow.width, normalizedRow.height);
  if (!dimensions.width || !dimensions.height) return null;
  const kind = normalizedRow.mime_type?.startsWith("video/") ? "video" : "image";
  const responsive = buildProductResponsiveAsset(normalizedRow, fallbackAlt, process.env.NEXT_PUBLIC_SUPABASE_URL);

  return {
    id: typeof normalizedRow.id === "string" ? normalizedRow.id : undefined,
    src,
    alt: cleanText(normalizedRow.alt_text ?? normalizedRow.alt ?? normalizedRow.caption, fallbackAlt),
    kind,
    width: dimensions.width,
    height: dimensions.height,
    local: false,
    responsive
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

function resolveProductImage(
  row: Pick<MithronProductRow, "image" | "hero" | "gallery" | "source_images">,
  name: string,
  linkedMedia?: MediaAsset,
  slug?: string
) {
  const rowImage = selectPrimaryProductImage(row, name);
  const supabaseRowImage = rowImage && isSupabaseStorageSrc(rowImage.src) ? rowImage : null;
  const externalRowImage = rowImage && isExternalHttpsSrc(rowImage.src) ? rowImage : null;

  if (linkedMedia) {
    if (!linkedMedia.src.trim() && supabaseRowImage) return supabaseRowImage;
    if (!linkedMedia.src.trim() && externalRowImage) return externalRowImage;
    return linkedMedia;
  }

  if (supabaseRowImage) {
    return supabaseRowImage;
  }

  if (externalRowImage) {
    return externalRowImage;
  }

  return null;
}

function createMissingSourceImageError(slug: string): CatalogDataError {
  return {
    code: "missing_source_image",
    slug,
    message: `Missing source image for Mithron product ${slug}.`
  };
}

function isMissingSourceImageError(error: unknown): error is Error {
  return error instanceof Error && error.message.startsWith("Missing source image for Mithron product");
}

function resolveHydratedProductImage(
  row: Pick<MithronProductRow, "image" | "hero" | "gallery" | "source_images">,
  name: string,
  linkedPrimaryImage?: MediaAsset,
  slug?: string
): MediaAsset {
  const image = resolveProductImage(row, name, linkedPrimaryImage, slug);
  if (!image) {
    throw new Error(`Missing source image for Mithron product ${slug ?? "unknown"}.`);
  }
  return enrichImageWithLinkedResponsive(image, linkedPrimaryImage);
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
  const image = resolveHydratedProductImage(row, name, linkedPrimaryImage, row.slug);

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
    description: (() => {
      const rawDescription = row.description ? cleanText(row.description) : undefined;
      return rawDescription && !isSpecLikeBlob(rawDescription) ? rawDescription : undefined;
    })(),
    sourceDescription: row.source_description ? cleanText(row.source_description) : undefined,
    onSale: row.on_sale ?? undefined,
    discountType: row.discount_type ?? undefined,
    discountValue: row.discount_value ? toNumber(row.discount_value) : undefined,
    costOfGoods: row.cost_of_goods ? toNumber(row.cost_of_goods) : undefined,
    showPricePerUnit: row.show_price_per_unit ?? undefined,
    chargeTax: row.charge_tax ?? undefined,
    taxGroup: row.tax_group ?? undefined,
    taxRate: row.tax_rate ? toNumber(row.tax_rate) : undefined,
    taxIncluded: row.tax_included ?? undefined,
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
    anchors: row.anchors?.length ? row.anchors : ["Overview", "Specs", "FAQ"],
    sourceCatalogId: row.source_catalog_id ?? undefined
  };
}

function mapEnterpriseMenuProduct(
  row: EnterpriseMenuProductRow,
  linkedPrimaryImage: MediaAsset | undefined,
  errors: CatalogDataError[]
): Product | null {
  const name = cleanText(row.name);
  const marketingTagline = getProductMarketingTagline({
    name,
    category: row.category,
    tagline: row.tagline,
    sourceDescription: row.source_description
  });
  const image = resolveProductImage(
    { ...row, hero: null, gallery: null },
    name,
    linkedPrimaryImage,
    row.slug
  );

  if (!image) {
    const error = createMissingSourceImageError(row.slug);
    errors.push(error);
    console.warn(`[catalog] ${error.message}`);
    return null;
  }

  const hydratedImage = enrichImageWithLinkedResponsive(image, linkedPrimaryImage);

  return {
    slug: row.slug,
    productUrl: `/product/${row.slug}`,
    workflowStatus: "published",
    isVisible: true,
    name,
    tagline: marketingTagline,
    price: toNumber(row.price),
    badge: row.badge ?? undefined,
    category: row.category,
    interests: row.interests ?? [],
    image: hydratedImage,
    hero: hydratedImage,
    gallery: [hydratedImage],
    hotspots: [],
    variants: [],
    bundles: [],
    story: [],
    specs: {},
    anchors: ["Overview"],
    sourceCatalogId: row.source_catalog_id ?? undefined
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
  const image = resolveHydratedProductImage(row, name, linkedPrimaryImage, row.slug);

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

function mapProductShellRowOrNull(row: MithronProductShellRow, linkedPrimaryImage?: MediaAsset): ProductShellItem | null {
  const name = cleanText(row.name);
  const tagline = getProductMarketingTagline({
    name,
    category: row.category,
    tagline: row.tagline,
    sourceDescription: row.source_description
  });
  const resolved = resolveProductImage(row, name, linkedPrimaryImage, row.slug);
  if (!resolved) return null;

  const interestsValue = row.interests ?? [];
  return {
    slug: row.slug,
    name,
    tagline,
    price: toNumber(row.price),
    badge: row.badge ?? undefined,
    category: row.category,
    interests: interestsValue,
    image: enrichImageWithLinkedResponsive(resolved, linkedPrimaryImage),
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

function mapSearchIndexEntry(row: CatalogSearchIndexRow): CatalogSearchIndexEntry | null {
  const item = mapProductShellRowOrNull(row);
  if (!item) return null;

  return {
    slug: item.slug,
    name: item.name,
    tagline: item.tagline,
    price: item.price,
    badge: item.badge,
    category: item.category,
    image: item.image,
    searchText: [
      item.name,
      item.tagline,
      item.category,
      item.slug,
      row.source_catalog_id ?? "",
      ...item.interests
    ].join(" ").toLowerCase(),
    sortOrder: row.sort_order ?? Number.MAX_SAFE_INTEGER
  };
}

export const getCatalogSearchIndex = cache(async (): Promise<CatalogSearchIndexEntry[]> => {
  try {
    const rows = await fetchAllCatalogRows<CatalogSearchIndexRow>(catalogSearchIndexSelect);
    const index: CatalogSearchIndexEntry[] = [];

    for (const row of rows) {
      const entry = mapSearchIndexEntry(row);
      if (entry) index.push(entry);
    }

    return index;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] failed to build in-memory search index; Supabase fallback will be used: ${message}`);
    return [];
  }
});

async function searchCatalogProductsFallback(query: string, limit: number): Promise<CatalogSearchResult[]> {
  const rows = await fetchCatalogSearchRows(query, limit);
  return mapSearchRowsToCatalogResults(rows);
}

export const getProductShellItems = cache(async (limit = SHELL_PREVIEW_LIMIT): Promise<ProductShellItem[]> => {
  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), SHELL_PREVIEW_LIMIT);
  const rows = await fetchCatalogRows<MithronProductShellRow>(
    `select=slug,name,tagline,price,badge,category,interests,image,hero,gallery,source_images,source_catalog_id,source_description&${publishedCatalogFilter}&order=sort_order.asc&limit=${boundedLimit}`
  );
  return mapRowsWithCatalogMedia(rows, mapProductShellRow);
});

export const getFeaturedSearchProducts = cache(async (limit = 4): Promise<CatalogSearchResult[]> => {
  const index = await getCatalogSearchIndex();
  if (index.length) return getFeaturedFromCatalogIndex(index, limit);

  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 12);
  const rows = await fetchCatalogRows<MithronProductShellRow>(
    `select=slug,name,tagline,price,badge,category,interests,image,hero,gallery,source_images,source_catalog_id,source_description&${publishedCatalogFilter}&order=sort_order.asc&limit=${boundedLimit}`
  );
  const results: CatalogSearchResult[] = [];
  for (const row of rows) {
    const item = mapProductShellRowOrNull(row);
    if (item) results.push(toCatalogSearchResult(item));
  }
  return results;
});

export const getCartDrawerSuggestions = cache(async (): Promise<CatalogSearchResult[]> => {
  const rows = await fetchCatalogRows<MithronProductShellRow>(
    `select=slug,name,tagline,price,badge,category,interests,image,hero,gallery,source_images,source_catalog_id,source_description&${publishedCatalogFilter}&or=(interests.cs.{agriculture},interests.cs.{components})&order=sort_order.asc&limit=12`
  );
  const items = await mapRowsWithCatalogMedia(rows, mapProductShellRow);
  return items.slice(0, 3).map(toCatalogSearchResult);
});

export async function getCheckoutPricingBySlugs(slugs: string[]): Promise<OrderCatalogProduct[]> {
  const normalized = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (!normalized.length) return [];

  const inFilter = `slug=in.(${normalized.map((slug) => encodeURIComponent(slug)).join(",")})`;
  const rows = await fetchCatalogRows<Pick<MithronProductRow, "slug" | "name" | "price" | "category" | "charge_tax" | "tax_group" | "tax_rate" | "tax_included">>(
    `select=${CHECKOUT_PRICING_SELECT}&${inFilter}&${publishedCatalogFilter}&limit=${normalized.length}`
  );

  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    price: toNumber(row.price),
    category: row.category,
    chargeTax: row.charge_tax ?? undefined,
    taxGroup: row.tax_group,
    taxRate: row.tax_rate !== null && row.tax_rate !== undefined ? toNumber(row.tax_rate) : null,
    taxIncluded: row.tax_included ?? undefined
  }));
}

export async function getRelatedProductShellItems(slug: string, limit = 4): Promise<ProductShellItem[]> {
  const currentRow = await getProductAffinityRowBySlug(slug);
  if (!currentRow) {
    const rows = await fetchCatalogRows<MithronProductShellRow>(
      `select=slug,name,tagline,price,badge,category,interests,image,hero,gallery,source_images,source_catalog_id,source_description&${publishedCatalogFilter}&slug=neq.${encodeURIComponent(slug)}&order=sort_order.asc&limit=${limit}`
    );
    return mapRowsWithCatalogMedia(rows, mapProductShellRow);
  }

  const categoryRows = await fetchCatalogRows<MithronProductShellRow>(
    `select=slug,name,tagline,price,badge,category,interests,image,hero,gallery,source_images,source_catalog_id,source_description&${publishedCatalogFilter}&category=eq.${encodeURIComponent(currentRow.category)}&slug=neq.${encodeURIComponent(slug)}&order=sort_order.asc&limit=${Math.max(limit * 4, 16)}`
  );
  const currentInterests = currentRow.interests ?? [];
  const shelfInputs = categoryRows as unknown as ProductShelfInput[];
  const shelfProducts = classifyProductShelf({
    slug,
    name: "",
    tagline: "",
    category: currentRow.category,
    interests: currentInterests,
    specs: {}
  }) === "drone-care"
    ? filterDroneCareProducts(shelfInputs)
    : filterDroneWorldProducts(shelfInputs);

  const related = shelfProducts.filter((product) => (
    product.slug !== slug && (
      product.category === currentRow.category ||
      product.interests.some((interest) => currentInterests.includes(interest))
    )
  ));

  const candidateRows = (related.length ? related : shelfProducts.filter((product) => product.slug !== slug))
    .slice(0, limit) as unknown as MithronProductShellRow[];

  if (!candidateRows.length) {
    const fallbackRows = await fetchCatalogRows<MithronProductShellRow>(
      `select=slug,name,tagline,price,badge,category,interests,image,hero,gallery,source_images,source_catalog_id,source_description&${publishedCatalogFilter}&slug=neq.${encodeURIComponent(slug)}&order=sort_order.asc&limit=${limit}`
    );
    return mapRowsWithCatalogMedia(fallbackRows, mapProductShellRow);
  }

  return mapRowsWithCatalogMedia(candidateRows, mapProductShellRow);
}

function getCatalogConfig(useServiceRole = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (useServiceRole && !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for privileged catalog reads.");
  }
  const key = useServiceRole ? serviceRoleKey! : publicKey;

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

async function fetchAllCatalogRows<T>(select: string): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (rows.length < CATALOG_MAX_ROWS) {
    const page = await fetchCatalogRows<T>(
      `select=${select}&${publishedCatalogFilter}&order=sort_order.asc,slug.asc&limit=${CATALOG_PAGE_SIZE}&offset=${offset}`
    );
    rows.push(...page);
    if (page.length < CATALOG_PAGE_SIZE) break;
    offset += CATALOG_PAGE_SIZE;
  }

  return rows;
}

async function fetchCatalogSearchRowsFallback(query: string, limit: number): Promise<CatalogSearchRow[]> {
  const token = query.trim().replace(/[*,()."]/g, " ").replace(/\s+/g, " ").trim();
  if (!token) return [];

  const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
  const pattern = `"*${token}*"`;
  const orClause = `(name.ilike.${pattern},tagline.ilike.${pattern},slug.ilike.${pattern},category.ilike.${pattern})`;
  const rows = await fetchCatalogRows<Pick<CatalogSearchRow, "slug" | "name" | "tagline" | "price" | "badge" | "category" | "image" | "hero">>(
    `select=slug,name,tagline,price,badge,category,image,hero&${publishedCatalogFilter}&or=${orClause}&order=sort_order.asc&limit=${boundedLimit}`
  );

  return rows.map((row) => ({ ...row, rank: null }));
}

async function fetchCatalogSearchRows(query: string, limit: number): Promise<CatalogSearchRow[]> {
  const { url, key } = getCatalogConfig();
  const response = await fetch(`${url}/rest/v1/rpc/search_published_products`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_query: query,
      p_limit: limit
    }),
    next: { revalidate: 60, tags: ["catalog", "catalog-search"] }
  });

  if (response.ok) {
    const rows = parseCatalogRows<CatalogSearchRow>(await response.text());
    if (rows.length) return rows;
    console.warn("[catalog] full-text search returned no matches; falling back to REST ilike search.");
    return fetchCatalogSearchRowsFallback(query, limit);
  }

  if (response.status === 404) {
    console.warn("[catalog] search_published_products RPC unavailable; falling back to REST ilike search.");
    return fetchCatalogSearchRowsFallback(query, limit);
  }

  throw new Error(`Failed to search catalog: ${response.status} ${response.statusText}`);
}

function toCatalogSearchResult(item: ProductShellItem): CatalogSearchResult {
  return {
    slug: item.slug,
    name: item.name,
    tagline: item.tagline,
    price: item.price,
    badge: item.badge,
    category: item.category,
    image: item.image
  };
}

async function mapSearchRowsToCatalogResults(rows: CatalogSearchRow[]): Promise<CatalogSearchResult[]> {
  if (!rows.length) return [];
  const primaryMedia = await getPrimaryProductMediaForSlugs(rows.map((row) => row.slug));
  const results: CatalogSearchResult[] = [];

  for (const row of rows) {
    const name = cleanText(row.name);
    const linkedPrimaryImage = primaryMedia.get(row.slug);
    const resolved = resolveProductImage(
      {
        image: row.image,
        hero: row.hero,
        gallery: null,
        source_images: null
      },
      name,
      linkedPrimaryImage,
      row.slug
    );

    if (!resolved) {
      console.warn(`[catalog] skipping search result without image: ${row.slug}`);
      continue;
    }

    results.push({
      slug: row.slug,
      name,
      tagline: cleanText(row.tagline),
      price: toNumber(row.price),
      badge: row.badge ?? undefined,
      category: row.category,
      image: enrichImageWithLinkedResponsive(resolved, linkedPrimaryImage)
    });
  }

  return results;
}

async function fetchMediaAssetChunk(chunk: string[]) {
  if (!chunk.length) return [] as MediaAssetRow[];

  try {
    return await fetchSupabaseRows<MediaAssetRow>(
      "media_assets",
      `select=${MEDIA_ASSET_SELECT}&id=${encodeURIComponent(postgrestIn(chunk))}&limit=${chunk.length}`,
      true
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] media_assets batch lookup failed (${chunk.length} ids): ${message}`);
  }

  const recovered: MediaAssetRow[] = [];
  for (const id of chunk) {
    try {
      const rows = await fetchSupabaseRows<MediaAssetRow>(
        "media_assets",
        `select=${MEDIA_ASSET_SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`,
        true
      );
      recovered.push(...rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[catalog] skipped media asset ${id}: ${message}`);
    }
  }

  return recovered;
}

async function fetchMediaAssetsById(mediaIds: string[]) {
  const uniqueIds = [...new Set(mediaIds.map((id) => id?.trim()).filter((id): id is string => Boolean(id)))];
  if (!uniqueIds.length) return new Map<string, MediaAssetRow>();

  const chunks = chunkItems(uniqueIds, MEDIA_ASSET_CHUNK_SIZE);
  const mediaRows = (await Promise.all(chunks.map((chunk) => fetchMediaAssetChunk(chunk)))).flat();
  return new Map(
    mediaRows
      .filter((row): row is MediaAssetRow & { id: string } => typeof row.id === "string" && row.id.length > 0)
      .map((row) => [row.id, normalizeMediaAssetRow(row)])
  );
}

async function fetchProductMediaLinks(query: string) {
  try {
    return await fetchSupabaseRows<ProductMediaLinkRow>("product_media_assets", query, true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] product_media_assets lookup failed; retrying with base columns: ${message}`);
    const baseQuery = query
      .replace(/,?alt_text/g, "")
      .replace(/,?caption/g, "")
      .replace(/,?variant_id/g, "")
      .replace(/&variant_id=eq\.[^&]+/g, "");
    return fetchSupabaseRows<ProductMediaLinkRow>("product_media_assets", baseQuery, true);
  }
}

const getPrimaryProductMediaLookup = cache(async (): Promise<Map<string, MediaAsset>> => {
  const { hasServiceRoleKey } = getCatalogConfig(true);
  if (!hasServiceRoleKey) return new Map();

  try {
    const links = await fetchProductMediaLinks(
      `select=product_slug,media_asset_id,usage,is_primary,sort_order,alt_text,caption&usage=eq.primary&is_primary=eq.true&limit=${PRODUCT_MEDIA_LIMIT}`
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] primary product media lookup failed; using inline JSON image fallback: ${message}`);
    return new Map();
  }
});

async function getPrimaryProductMediaForSlugs(slugs: string[]): Promise<Map<string, MediaAsset>> {
  const uniqueSlugs = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  if (!uniqueSlugs.length) return new Map();

  const { hasServiceRoleKey } = getCatalogConfig(true);
  if (!hasServiceRoleKey) return new Map();

  try {
    const links = await fetchProductMediaLinks(
      `select=product_slug,media_asset_id,usage,is_primary,sort_order,alt_text,caption&usage=eq.primary&is_primary=eq.true&product_slug=${postgrestIn(uniqueSlugs)}&limit=${uniqueSlugs.length}`
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] scoped primary media lookup failed; using inline JSON image fallback: ${message}`);
    return new Map();
  }
}

const getCatalogCutoutMediaLookup = cache(async (): Promise<Map<string, MediaAsset>> => {
  const { hasServiceRoleKey } = getCatalogConfig(true);
  if (!hasServiceRoleKey) return new Map();

  try {
    const links = await fetchProductMediaLinks(
      `select=product_slug,media_asset_id,usage,variant_id,is_primary,sort_order,alt_text,caption&usage=eq.cms&variant_id=eq.catalog-cutout-v1&limit=${PRODUCT_MEDIA_LIMIT}`
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] catalog cutout media lookup failed; falling back to primary product images: ${message}`);
    return new Map();
  }
});

async function mapRowsWithCatalogMedia<T extends Pick<MithronProductRow, "slug">, R>(
  rows: T[],
  mapper: (row: T, media?: MediaAsset) => R
) {
  const primaryMedia = await getPrimaryProductMediaLookup();
  let catalogCutouts = new Map<string, MediaAsset>();

  try {
    catalogCutouts = await getCatalogCutoutMediaLookup();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] catalog cutout media lookup failed; falling back to primary product images: ${message}`);
  }

  return rows.map((row) => mapper(row, catalogCutouts.get(row.slug) ?? primaryMedia.get(row.slug)));
}

export const getHomepageProducts = cache(async (): Promise<Product[]> => {
  const rows = await fetchCatalogRows<MithronProductRow>(
    `select=${homepageProductSelect}&${publishedCatalogFilter}&order=sort_order.asc&limit=${HOMEPAGE_PRODUCT_LIMIT}`
  );

  return rows.map((row) => mapHomepageProductRow(row));
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
  const rows = await fetchAllCatalogRows<MithronProductRow>(catalogListSelect);
  const products = await mapRowsWithCatalogMedia(rows, mapProductRow);
  return dedupeProductsBySlug(products);
});

async function fetchEnterpriseMenuCategoryRows(
  definition: CatalogCategoryDefinition
): Promise<EnterpriseMenuProductRow[]> {
  const categoryName = definition.categoryNames[0];
  if (!categoryName) return [];

  const query = [
    `select=${enterpriseMenuSelect}`,
    publishedCatalogFilter,
    `category=eq.${encodeURIComponent(categoryName)}`,
    "order=sort_order.asc,slug.asc",
    `limit=${ENTERPRISE_MENU_PER_CATEGORY_LIMIT}`
  ].join("&");

  return fetchCatalogRows<EnterpriseMenuProductRow>(query);
}

export const getEnterpriseMenuProducts = cache(async (): Promise<EnterpriseMenuLoadResult> => {
  const rowGroups = await Promise.all(
    catalogCategoryDefinitions.map((definition) => fetchEnterpriseMenuCategoryRows(definition))
  );

  const seen = new Set<string>();
  const rows = rowGroups.flat().filter((row) => {
    if (!row.slug || seen.has(row.slug)) return false;
    seen.add(row.slug);
    return true;
  });

  const errors: CatalogDataError[] = [];
  const products = await mapRowsWithCatalogMedia(rows, (row, media) => mapEnterpriseMenuProduct(row, media, errors));
  return {
    products: products.filter((product): product is Product => product !== null),
    errors
  };
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
  const rows = await fetchAllCatalogRows<MithronProductRow>(catalogListSelect);
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

  try {
    return mapProductRow(row, catalogCutouts.get(row.slug) ?? primaryMedia.get(row.slug));
  } catch (error) {
    if (isMissingSourceImageError(error)) {
      console.warn(`[catalog] ${error.message}`);
      return undefined;
    }
    throw error;
  }
}

export async function loadProductForPage(slug: string): Promise<ProductPageLoadResult> {
  const row = await getProductRowBySlug(slug);
  if (!row) return { status: "not_found" };

  const primaryMedia = await getPrimaryProductMediaLookup();
  let catalogCutouts = new Map<string, MediaAsset>();

  try {
    catalogCutouts = await getCatalogCutoutMediaLookup();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[catalog] catalog cutout media lookup failed; falling back to primary product images: ${message}`);
  }

  try {
    return {
      status: "ready",
      product: mapProductRow(row, catalogCutouts.get(row.slug) ?? primaryMedia.get(row.slug))
    };
  } catch (error) {
    if (isMissingSourceImageError(error)) {
      const catalogError = createMissingSourceImageError(slug);
      console.warn(`[catalog] ${catalogError.message}`);
      return { status: "error", error: catalogError };
    }
    throw error;
  }
}

export async function getProductStaticSlugs() {
  const rows = await fetchAllCatalogRows<{ slug: string }>("slug");
  return rows.map((product) => product.slug).filter(Boolean);
}

export type ProductSitemapEntry = {
  slug: string;
  productUrl: string | null;
  updatedAt: string | null;
};

export async function getPublishedProductSitemapEntries(): Promise<ProductSitemapEntry[]> {
  const rows = await fetchAllCatalogRows<{ slug: string; product_url: string | null; updated_at: string | null }>(
    "slug,product_url,updated_at"
  );

  return rows.map((row) => ({
    slug: row.slug,
    productUrl: row.product_url,
    updatedAt: row.updated_at
  }));
}

export async function countPublishedProductsWithoutPrimaryLink(): Promise<{
  publishedCount: number;
  linkedCount: number;
  missingCount: number;
}> {
  const [productRows, links] = await Promise.all([
    fetchAllCatalogRows<{ slug: string }>("slug"),
    fetchSupabaseRows<{ product_slug: string }>(
      "product_media_assets",
      `select=product_slug&usage=eq.primary&is_primary=eq.true&limit=${PRODUCT_MEDIA_LIMIT}`,
      true
    )
  ]);

  const linkedSlugs = new Set(links.map((link) => link.product_slug).filter(Boolean));
  const publishedCount = productRows.length;
  const linkedCount = productRows.filter((row) => linkedSlugs.has(row.slug)).length;

  return {
    publishedCount,
    linkedCount,
    missingCount: Math.max(0, publishedCount - linkedCount)
  };
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

export async function searchProducts(query: string, limit = 24) {
  const normalized = query.trim();
  if (!normalized) return [];
  const rows = await fetchCatalogSearchRows(normalized, limit);
  return mapRowsWithCatalogMedia(
    rows.map((row) => ({
      slug: row.slug,
      product_url: null,
      workflow_status: "published" as const,
      published_at: null,
      archived_at: null,
      is_visible: true,
      name: row.name,
      tagline: row.tagline,
      seo_title: null,
      seo_description: null,
      og_title: null,
      og_description: null,
      og_image: null,
      price: row.price,
      compare_at: null,
      badge: row.badge,
      description: null,
      on_sale: null,
      discount_type: null,
      discount_value: null,
      cost_of_goods: null,
      show_price_per_unit: null,
      charge_tax: null,
      tax_group: null,
      tax_rate: null,
      tax_included: null,
      category: row.category,
      interests: [],
      image: row.image,
      hero: row.hero,
      gallery: [],
      hotspots: [],
      variants: [],
      bundles: [],
      story: [],
      specs: {},
      anchors: [],
      sort_order: null,
      source_url: null,
      source_catalog_id: null,
      source_description: null,
      source_images: [],
      source_availability: null,
      source_currency: null
    })),
    mapProductRow
  );
}

export async function searchCatalogProducts(query: string, limit = 24): Promise<CatalogSearchResult[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const index = await getCatalogSearchIndex();
  if (index.length) {
    return searchCatalogIndex(index, normalized, limit);
  }

  console.warn("[catalog] in-memory search index empty; falling back to Supabase search.");
  return searchCatalogProductsFallback(normalized, limit);
}

export async function getProductsForCategorySlug(slug: string) {
  if (!isCatalogCategorySlug(slug)) return [];
  const products = await getProducts();
  return dedupeProductsBySlug(filterProductsForCategorySlug(products, slug));
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
