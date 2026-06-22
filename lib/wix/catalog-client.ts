import {
  decodeHtml,
  inferProductCategory,
  normalizeIdentity,
  parseMoney,
  sourceCatalogIdFromWixSlug,
  wixProductPageUrl
} from "./catalog-normalize.ts";

export type WixProductSnapshot = {
  wix_product_id: string;
  wix_slug: string;
  name: string;
  price: number;
  compare_at: number | null;
  description_plain: string;
  source_url: string;
  source_catalog_id: string;
  source_fingerprint: string;
  category: string;
  media_urls: string[];
  visible: boolean;
  updated_at: string;
};

export type WixCatalogSnapshot = {
  version: 1;
  source: "wix-stores-api-v3";
  site_id: string;
  extracted_at: string;
  product_count: number;
  products: WixProductSnapshot[];
};

type WixClientOptions = {
  apiKey: string;
  siteId: string;
  baseUrl?: string;
};

const DEFAULT_FIELDS = [
  "PLAIN_DESCRIPTION",
  "MEDIA_ITEMS_INFO",
  "BREADCRUMBS_INFO",
  "VARIANTS_INFO"
] as const;

function readNestedPrice(product: Record<string, unknown>) {
  const priceData = product.price as Record<string, unknown> | undefined;
  const range = priceData?.price as Record<string, unknown> | undefined;
  const discounted = parseMoney(range?.discountedPrice);
  const regular = parseMoney(range?.price);
  if (discounted !== null) {
    return {
      price: discounted,
      compare_at: regular !== null && regular > discounted ? regular : null
    };
  }

  const variant = (product.variantsInfo as { variants?: Array<Record<string, unknown>> } | undefined)?.variants?.[0];
  const variantPrice = variant?.price as Record<string, unknown> | undefined;
  const variantDiscounted = parseMoney(variantPrice?.discountedPrice);
  const variantRegular = parseMoney(variantPrice?.price);
  if (variantDiscounted !== null) {
    return {
      price: variantDiscounted,
      compare_at: variantRegular !== null && variantRegular > variantDiscounted ? variantRegular : null
    };
  }

  return { price: 0, compare_at: null };
}

function readMediaUrls(product: Record<string, unknown>) {
  const media = product.media as { items?: Array<Record<string, unknown>> } | undefined;
  const urls: string[] = [];
  for (const item of media?.items ?? []) {
    const image = item.image as Record<string, unknown> | undefined;
    const url = String(image?.url ?? item.url ?? "").trim();
    if (url) urls.push(url);
  }
  return [...new Set(urls)];
}

function readCategory(product: Record<string, unknown>, name: string) {
  const breadcrumbs = product.breadcrumbsInfo as { breadcrumbs?: Array<{ name?: string }> } | undefined;
  const names = (breadcrumbs?.breadcrumbs ?? []).map((item) => decodeHtml(item.name ?? "")).filter(Boolean);
  const leaf = names.at(-1);
  if (leaf && !/product|all/i.test(leaf)) return leaf;
  return inferProductCategory(name);
}

export function normalizeWixProduct(product: Record<string, unknown>, extractedAt: string): WixProductSnapshot | null {
  const wixSlug = String(product.slug ?? "").trim();
  const name = decodeHtml(String(product.name ?? ""));
  if (!wixSlug || !name) return null;

  const pricing = readNestedPrice(product);
  const descriptionPlain = decodeHtml(
    String(product.plainDescription ?? product.description ?? product.descriptionPlain ?? "")
  );

  return {
    wix_product_id: String(product.id ?? product._id ?? wixSlug),
    wix_slug: wixSlug,
    name,
    price: pricing.price,
    compare_at: pricing.compare_at,
    description_plain: descriptionPlain,
    source_url: wixProductPageUrl(wixSlug),
    source_catalog_id: sourceCatalogIdFromWixSlug(wixSlug),
    source_fingerprint: normalizeIdentity(name),
    category: readCategory(product, name),
    media_urls: readMediaUrls(product),
    visible: product.visible !== false,
    updated_at: String(product.updatedDate ?? product.lastUpdated ?? extractedAt)
  };
}

export async function fetchWixCatalog(options: WixClientOptions): Promise<WixCatalogSnapshot> {
  const baseUrl = options.baseUrl ?? "https://www.wixapis.com";
  const extractedAt = new Date().toISOString();
  const products: WixProductSnapshot[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetch(`${baseUrl}/stores/v3/products/query`, {
      method: "POST",
      headers: {
        Authorization: options.apiKey,
        "Content-Type": "application/json",
        "wix-site-id": options.siteId
      },
      body: JSON.stringify({
        query: {
          cursorPaging: { limit: 100, cursor }
        },
        fields: [...DEFAULT_FIELDS]
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Wix query products failed (${response.status}): ${body.slice(0, 400)}`);
    }

    const payload = (await response.json()) as {
      products?: Array<Record<string, unknown>>;
      pagingMetadata?: { cursors?: { next?: string } };
    };

    for (const product of payload.products ?? []) {
      const normalized = normalizeWixProduct(product, extractedAt);
      if (normalized) products.push(normalized);
    }

    cursor = payload.pagingMetadata?.cursors?.next || undefined;
  } while (cursor);

  const deduped = new Map<string, WixProductSnapshot>();
  for (const product of products) {
    deduped.set(product.wix_product_id, product);
  }

  return {
    version: 1,
    source: "wix-stores-api-v3",
    site_id: options.siteId,
    extracted_at: extractedAt,
    product_count: deduped.size,
    products: [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name))
  };
}

export function loadWixClientFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.WIX_STUDIO_API_KEY?.trim();
  const siteId = env.WIX_SITE_ID?.trim();
  if (!apiKey) throw new Error("WIX_STUDIO_API_KEY is required.");
  if (!siteId) throw new Error("WIX_SITE_ID is required.");
  return { apiKey, siteId };
}
