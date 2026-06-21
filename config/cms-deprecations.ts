/** Legacy CMS tables dropped in migration 20260619000200_drop_legacy_cms_tables.sql */
export const CMS_REMOVED_STOREFRONT_TABLES = [
  "homepage_sections",
  "testimonials"
] as const;

export type CmsRemovedStorefrontTable = (typeof CMS_REMOVED_STOREFRONT_TABLES)[number];

/** @deprecated Use CMS_REMOVED_STOREFRONT_TABLES — tables no longer exist in the database. */
export const CMS_DEPRECATED_STOREFRONT_TABLES = CMS_REMOVED_STOREFRONT_TABLES;

export type CmsDeprecatedStorefrontTable = CmsRemovedStorefrontTable;

export const CMS_REMOVED_TABLE_NOTES: Record<CmsRemovedStorefrontTable, string> = {
  homepage_sections:
    "Removed: homepage_sections was dropped from the database. Use the Homepage editor (admin_settings + domain tables) or cms_sections orchestration instead.",
  testimonials:
    "Removed: testimonials was dropped from the database. The storefront uses product_reviews."
};

export const CMS_DEPRECATED_TABLE_NOTES = CMS_REMOVED_TABLE_NOTES;

export function isRemovedCmsStorefrontTable(table: string): table is CmsRemovedStorefrontTable {
  return (CMS_REMOVED_STOREFRONT_TABLES as readonly string[]).includes(table);
}

export function isDeprecatedCmsStorefrontTable(table: string): table is CmsDeprecatedStorefrontTable {
  return isRemovedCmsStorefrontTable(table);
}
