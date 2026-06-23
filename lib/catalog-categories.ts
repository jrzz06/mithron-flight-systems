import type { Product } from "@/config/types";
import {
  GLOBAL_PRODUCTS_CATEGORY,
  isGlobalProductsCategory,
  normalizeProductCategory
} from "@/lib/product-shelf-classification";

export const CATALOG_CATEGORY_SLUGS = [
  "agri-drones",
  "video-drones",
  "creative-drones",
  "survey-drones",
  "surveillance-drones",
  "accessories",
  "global-products"
] as const;

export type CatalogCategorySlug = (typeof CATALOG_CATEGORY_SLUGS)[number];

export type CatalogCategoryDefinition = {
  slug: CatalogCategorySlug;
  label: string;
  href: string;
  legacyHref: string;
  cmsRouteKey: string;
  menuKey: string;
  menuType: "mega" | "compact" | "franchise";
  categoryNames: string[];
};

export const catalogCategoryDefinitions: CatalogCategoryDefinition[] = [
  {
    slug: "agri-drones",
    label: "Agri Drones",
    href: "/category/agri-drones",
    legacyHref: "/agriculture",
    cmsRouteKey: "agriculture",
    menuKey: "agri",
    menuType: "mega",
    categoryNames: ["Agri Drones"]
  },
  {
    slug: "video-drones",
    label: "Video Drones",
    href: "/category/video-drones",
    legacyHref: "/video-drones",
    cmsRouteKey: "videoDrones",
    menuKey: "video",
    menuType: "mega",
    categoryNames: ["Video Drones"]
  },
  {
    slug: "creative-drones",
    label: "Creative Drones",
    href: "/category/creative-drones",
    legacyHref: "/creative-drones",
    cmsRouteKey: "creativeDrones",
    menuKey: "creative",
    menuType: "mega",
    categoryNames: ["Creative Drones"]
  },
  {
    slug: "survey-drones",
    label: "Survey Drones",
    href: "/category/survey-drones",
    legacyHref: "/mapping",
    cmsRouteKey: "mapping",
    menuKey: "survey",
    menuType: "mega",
    categoryNames: ["Survey Drones"]
  },
  {
    slug: "surveillance-drones",
    label: "Surveillance Drones",
    href: "/category/surveillance-drones",
    legacyHref: "/surveillance",
    cmsRouteKey: "surveillance",
    menuKey: "surveillance",
    menuType: "mega",
    categoryNames: ["Surveillance Drones"]
  },
  {
    slug: "accessories",
    label: "Accessories",
    href: "/category/accessories",
    legacyHref: "/accessories",
    cmsRouteKey: "accessories",
    menuKey: "accessories",
    menuType: "compact",
    categoryNames: ["Accessories"]
  },
  {
    slug: "global-products",
    label: "Global Products",
    href: "/category/global-products",
    legacyHref: "/industrial",
    cmsRouteKey: "industrial",
    menuKey: "franchise",
    menuType: "franchise",
    categoryNames: [GLOBAL_PRODUCTS_CATEGORY]
  }
];

const categoryBySlug = new Map(catalogCategoryDefinitions.map((definition) => [definition.slug, definition]));
const categoryByLabel = new Map(catalogCategoryDefinitions.map((definition) => [definition.label, definition]));
const categoryByLegacyHref = new Map(catalogCategoryDefinitions.map((definition) => [definition.legacyHref, definition]));

export function isCatalogCategorySlug(value: string): value is CatalogCategorySlug {
  return categoryBySlug.has(value as CatalogCategorySlug);
}

export function getCatalogCategoryDefinition(slug: CatalogCategorySlug) {
  const definition = categoryBySlug.get(slug);
  if (!definition) throw new Error(`Unknown catalog category slug: ${slug}`);
  return definition;
}

export function getCatalogCategoryByLabel(label: string) {
  return categoryByLabel.get(label);
}

export function getCatalogCategoryByLegacyHref(href: string) {
  return categoryByLegacyHref.get(href);
}

export function filterProductsForCategorySlug(products: Product[], slug: CatalogCategorySlug) {
  const definition = getCatalogCategoryDefinition(slug);

  if (slug === "global-products") {
    return products.filter(isGlobalProductsCategory);
  }

  if (!definition.categoryNames.length) {
    return [];
  }

  const normalizedNames = new Set(definition.categoryNames.map(normalizeProductCategory));
  return products.filter((product) => normalizedNames.has(normalizeProductCategory(product.category)));
}

export const interestSlugToCategorySlug: Partial<Record<string, CatalogCategorySlug>> = {
  agriculture: "agri-drones",
  "video-drones": "video-drones",
  "creative-drones": "creative-drones",
  mapping: "survey-drones",
  surveillance: "surveillance-drones",
  "smart-farming": "agri-drones",
  "defense-security": "surveillance-drones",
  "industrial-inspection": "global-products",
  components: "accessories"
};

export function resolveCategoryHrefForInterest(slug: string) {
  const categorySlug = interestSlugToCategorySlug[slug];
  return categorySlug ? getCatalogCategoryDefinition(categorySlug).href : `/interest/${slug}`;
}
