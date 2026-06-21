import { catalogCategoryDefinitions } from "@/lib/catalog-categories";

/** CMS category_metadata.route_key → canonical storefront interest slug. */
const cmsRouteKeyToInterestSlug: Record<string, string> = {
  agriculture: "agriculture",
  videoDrones: "video-drones",
  creativeDrones: "creative-drones",
  mapping: "mapping",
  surveillance: "surveillance",
  accessories: "components",
  industrial: "industrial-inspection",
  "smart-farming": "smart-farming",
  "defense-security": "defense-security",
  "industrial-inspection": "industrial-inspection",
  components: "components"
};

for (const definition of catalogCategoryDefinitions) {
  if (definition.cmsRouteKey === definition.slug) {
    cmsRouteKeyToInterestSlug[definition.cmsRouteKey] ??= definition.slug;
    continue;
  }

  const kebabFromCms = definition.slug;
  cmsRouteKeyToInterestSlug[definition.cmsRouteKey] ??= kebabFromCms;
}

/** Normalize CMS route_key or legacy slug to the canonical interest slug used in URLs and product filters. */
export function normalizeInterestSlug(slug: string) {
  const trimmed = slug.trim();
  if (!trimmed) return trimmed;
  return cmsRouteKeyToInterestSlug[trimmed] ?? trimmed;
}
