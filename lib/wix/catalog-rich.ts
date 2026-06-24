import { decodeHtml } from "./catalog-normalize.ts";
import type { StorySection } from "../../config/types.ts";

export type WixInfoSection = {
  id: string;
  uniqueName: string;
  title: string;
  html: string;
  plain: string;
  kind: "specs" | "features" | "downloads" | "applications" | "included" | "faq" | "general";
};

export type WixSeoSnapshot = {
  title: string;
  description: string;
};

export type WixVariantSnapshot = {
  id: string;
  name: string;
  sku: string;
  price: number;
  compareAt: number | null;
  visible: boolean;
};

export type WixRichProductContent = {
  description_html: string;
  info_sections: WixInfoSection[];
  seo: WixSeoSnapshot;
  categories: string[];
  variants: WixVariantSnapshot[];
  product_options: Array<{ name: string; choices: string[] }>;
  weight: string;
  sku: string;
  ribbon: string;
  media_urls: string[];
  video_urls: string[];
  document_urls: Array<{ url: string; label: string }>;
  specs: Record<string, string>;
  features: string[];
  story_chapters: StorySection[];
  downloads_html: string;
  applications_html: string;
  included_items: string[];
  faq_pairs: Array<[string, string]>;
};

function classifyInfoSection(title: string): WixInfoSection["kind"] {
  const value = title.toLowerCase();
  if (/spec|technical|parameter|dimension|performance/.test(value)) return "specs";
  if (/feature|highlight|benefit|advantage/.test(value)) return "features";
  if (/download|document|manual|brochure|datasheet|pdf/.test(value)) return "downloads";
  if (/application|use case|mission|industr/.test(value)) return "applications";
  if (/included|box|package|content|what.?s in/.test(value)) return "included";
  if (/faq|question|q\s*&\s*a/.test(value)) return "faq";
  return "general";
}

function stripTags(html: string) {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function parseTableSpecs(html: string) {
  const specs: Record<string, string> = {};
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const row of rows) {
    const cells = [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => stripTags(cell[1]).trim()).filter(Boolean);
    if (cells.length >= 2) specs[cells[0]] = cells.slice(1).join(" · ");
  }
  return specs;
}

function parseListItems(html: string) {
  const items = [...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]).trim())
    .filter(Boolean);
  return items.length ? items : stripTags(html).split(/\n+/).map((line) => line.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
}

function parseDocumentLinks(html: string) {
  const links: Array<{ url: string; label: string }> = [];
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = match[1].trim();
    const label = stripTags(match[2]).trim() || url;
    if (!url || /^#|javascript:/i.test(url)) continue;
    if (/\.(pdf|doc|docx|xls|xlsx|zip)(\?|$)/i.test(url) || /download|manual|brochure|datasheet/i.test(label)) {
      links.push({ url, label });
    }
  }
  return links;
}

function parseColonSpecPairs(text: string) {
  const pairs: Record<string, string> = {};
  const pattern = /([A-Z][A-Za-z0-9\s\-\/\(\)]{1,40}):\s*/g;
  const matches = [...text.matchAll(pattern)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = (match[1] ?? "").trim();
    if (!key) continue;
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const value = text.slice(start, end).trim();
    if (value) pairs[key] = value;
  }
  return pairs;
}

function parseFaqPairs(html: string) {
  const pairs: Array<[string, string]> = [];
  for (const match of html.matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>\s*([\s\S]*?)(?=<h[2-4]|$)/gi)) {
    const question = stripTags(match[1]).trim();
    const answer = stripTags(match[2]).trim();
    if (question && answer) pairs.push([question, answer]);
  }
  return pairs;
}

export function readSeoData(product: Record<string, unknown>): WixSeoSnapshot {
  const seoData = product.seoData as { tags?: Array<{ type?: string; props?: Record<string, string>; children?: string }> } | undefined;
  let title = "";
  let description = "";

  for (const tag of seoData?.tags ?? []) {
    const props = tag.props ?? {};
    if (tag.type === "title" && tag.children) title = decodeHtml(tag.children);
    if (tag.type === "meta" && props.name === "description" && props.content) description = decodeHtml(props.content);
    if (tag.type === "meta" && props.property === "og:title" && props.content) title ||= decodeHtml(props.content);
    if (tag.type === "meta" && props.property === "og:description" && props.content) description ||= decodeHtml(props.content);
  }

  return { title, description };
}

export function readInfoSections(product: Record<string, unknown>): WixInfoSection[] {
  const sections = product.infoSections as Array<Record<string, unknown>> | undefined;
  return (sections ?? [])
    .map((section, index) => {
      const title = decodeHtml(String(section.title ?? section.uniqueName ?? `Section ${index + 1}`));
      const html = String(section.plainDescription ?? "").trim();
      const plain = stripTags(html);
      return {
        id: String(section.id ?? section.uniqueName ?? `section-${index}`),
        uniqueName: String(section.uniqueName ?? ""),
        title,
        html,
        plain,
        kind: classifyInfoSection(title)
      };
    })
    .filter((section) => section.html.trim() || section.plain.trim());
}

export function readCategories(product: Record<string, unknown>, fallbackCategory: string) {
  const names = new Set<string>();
  const allCategories = product.allCategoriesInfo as { categories?: Array<{ name?: string }> } | undefined;
  const directCategories = product.directCategoriesInfo as { categories?: Array<{ name?: string }> } | undefined;
  for (const category of allCategories?.categories ?? directCategories?.categories ?? []) {
    const name = decodeHtml(category.name ?? "");
    if (name && !/product|all|store/i.test(name)) names.add(name);
  }
  const breadcrumbs = product.breadcrumbsInfo as { breadcrumbs?: Array<{ name?: string }> } | undefined;
  for (const crumb of breadcrumbs?.breadcrumbs ?? []) {
    const name = decodeHtml(crumb.name ?? "");
    if (name && !/product|all|store/i.test(name)) names.add(name);
  }
  if (!names.size && fallbackCategory) names.add(fallbackCategory);
  return [...names];
}

export function readVariants(product: Record<string, unknown>) {
  const variants: WixVariantSnapshot[] = [];
  const variantSummary = product.variantSummary as { variants?: Array<Record<string, unknown>> } | undefined;
  const minPriceVariant = variantSummary?.variants?.[0] ?? (product.variantSummary as { minPriceVariant?: Record<string, unknown> } | undefined)?.minPriceVariant;

  const sourceVariants = variantSummary?.variants?.length
    ? variantSummary.variants
    : minPriceVariant
      ? [minPriceVariant]
      : (product.variantsInfo as { variants?: Array<Record<string, unknown>> } | undefined)?.variants ?? [];

  for (const variant of sourceVariants) {
    const priceData = variant.price as Record<string, unknown> | undefined;
    const actual = Number(priceData?.actualPrice?.amount ?? priceData?.actualPrice ?? priceData?.price ?? 0);
    const compare = Number(priceData?.compareAtPrice?.amount ?? priceData?.compareAtPrice ?? 0);
    const optionNames = (variant.optionChoiceNames as { optionName?: string; choiceName?: string } | undefined);
    const label = [optionNames?.optionName, optionNames?.choiceName].filter(Boolean).join(": ") || decodeHtml(String(variant.name ?? "Variant"));
    variants.push({
      id: String(variant.id ?? variant.variantId ?? label),
      name: label,
      sku: String(variant.sku ?? ""),
      price: Number.isFinite(actual) ? actual : 0,
      compareAt: compare > actual ? compare : null,
      visible: variant.visible !== false
    });
  }

  return variants;
}

export function readProductOptions(product: Record<string, unknown>) {
  const options = product.options as Array<Record<string, unknown>> | undefined;
  return (options ?? []).map((option) => ({
    name: decodeHtml(String(option.name ?? "Option")),
    choices: ((option.choices as Array<Record<string, unknown>> | undefined) ?? [])
      .map((choice) => decodeHtml(String(choice.name ?? choice.value ?? "")))
      .filter(Boolean)
  })).filter((option) => option.choices.length);
}

function readMedia(product: Record<string, unknown>) {
  const mediaUrls: string[] = [];
  const videoUrls: string[] = [];
  const media = product.media as { items?: Array<Record<string, unknown>> } | undefined;
  for (const item of media?.items ?? []) {
    const image = item.image as Record<string, unknown> | undefined;
    const video = item.video as Record<string, unknown> | undefined;
    const imageUrl = String(image?.url ?? item.url ?? "").trim();
    const videoUrl = String(video?.url ?? video?.files?.[0]?.url ?? "").trim();
    if (imageUrl) mediaUrls.push(imageUrl);
    if (videoUrl) videoUrls.push(videoUrl);
  }
  return { mediaUrls: [...new Set(mediaUrls)], videoUrls: [...new Set(videoUrls)] };
}

export function extractRichProductContent(
  product: Record<string, unknown>,
  fallbackCategory: string,
  fallbackMediaUrls: string[]
): WixRichProductContent {
  const infoSections = readInfoSections(product);
  const seo = readSeoData(product);
  const { mediaUrls, videoUrls } = readMedia(product);
  const allMedia = [...new Set([...fallbackMediaUrls, ...mediaUrls])];
  const descriptionHtml = String(product.plainDescription ?? "").trim();
  const specs: Record<string, string> = {};
  const features: string[] = [];
  const storyChapters: StorySection[] = [];
  const includedItems: string[] = [];
  const documentUrls: Array<{ url: string; label: string }> = [];
  const faqPairs: Array<[string, string]> = [];
  let downloadsHtml = "";
  let applicationsHtml = "";

  for (const section of infoSections) {
    Object.assign(specs, parseTableSpecs(section.html));
    Object.assign(specs, parseColonSpecPairs(section.plain));

    if (section.kind === "features") features.push(...parseListItems(section.html));
    if (section.kind === "included") includedItems.push(...parseListItems(section.html));
    if (section.kind === "downloads") {
      downloadsHtml += section.html;
      documentUrls.push(...parseDocumentLinks(section.html));
    }
    if (section.kind === "applications") applicationsHtml += section.html;
    if (section.kind === "faq") faqPairs.push(...parseFaqPairs(section.html));

    if (section.kind === "general" || section.kind === "features" || section.kind === "applications") {
      if (section.plain.length > 40) {
        storyChapters.push({
          id: section.id,
          kicker: section.kind === "features" ? "Features" : section.title,
          title: section.title,
          body: section.plain,
          media: { src: allMedia[0] ?? "", alt: section.title, kind: "image" },
          align: "left"
        });
      }
    }
  }

  Object.assign(specs, parseColonSpecPairs(stripTags(descriptionHtml)));
  Object.assign(specs, parseTableSpecs(descriptionHtml));
  documentUrls.push(...parseDocumentLinks(descriptionHtml));

  const physical = product.physicalProperties as { weight?: number; sku?: string } | undefined;
  const ribbon = product.ribbon as { name?: string; text?: string } | undefined;

  return {
    description_html: descriptionHtml,
    info_sections: infoSections,
    seo,
    categories: readCategories(product, fallbackCategory),
    variants: readVariants(product),
    product_options: readProductOptions(product),
    weight: physical?.weight ? `${physical.weight}` : "",
    sku: String(physical?.sku ?? ""),
    ribbon: decodeHtml(String(ribbon?.name ?? ribbon?.text ?? "")),
    media_urls: allMedia,
    video_urls: videoUrls,
    document_urls: [...new Map(documentUrls.map((item) => [item.url, item])).values()],
    specs,
    features: [...new Set(features)],
    story_chapters: storyChapters,
    downloads_html: downloadsHtml,
    applications_html: applicationsHtml,
    included_items: [...new Set(includedItems)],
    faq_pairs: faqPairs
  };
}
