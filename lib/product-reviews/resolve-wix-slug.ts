const SOURCE_PREFIX = "source-";
const CATALOG_PREFIX = "mithron-";

export function resolveWixProductSlug(input: { slug: string; sourceCatalogId?: string | null }) {
  const catalogId = input.sourceCatalogId?.trim();
  if (catalogId?.startsWith(CATALOG_PREFIX)) {
    return catalogId.slice(CATALOG_PREFIX.length);
  }

  const slug = input.slug.trim();
  if (slug.startsWith(SOURCE_PREFIX)) {
    return slug.slice(SOURCE_PREFIX.length);
  }

  return slug;
}
