import { CmsVisualWorkspaceLoader } from "@/components/admin/cms-visual-workspace-loader";
import type { CmsRestoreRevision, CmsWorkspaceMedia, CmsWorkspacePage, CmsWorkspaceSection } from "@/features/admin/cms/cms-visual-workspace";
import { HomepageCmsEditor } from "@/components/admin/homepage-cms-editor-loader";
import { CMS_WORKSPACE_ANCHORS, CMS_WORKSPACE_PAGES } from "@/config/cms-workspace";
import { homepageCmsSections as homepageSectionDefinitions, type HomepageCmsSectionId } from "@/config/homepage-cms";
import { footerContent } from "@/config/storefront-content";
import { ModulePanel, OperationalFeedback } from "@/components/admin/module-panel";
import { getCmsAdvancedWorkspaceSnapshot, getCmsCoreSnapshot } from "@/services/admin";
import { getHomepageCmsContent } from "@/services/homepage-cms";

export const dynamic = "force-dynamic";

type AdminRow = Record<string, unknown>;

type ContentRevisionRow = {
  entity_table?: string;
  entity_id?: string;
  revision?: number;
  snapshot?: Record<string, unknown>;
  change_summary?: string | null;
  created_at?: string | null;
};

type CmsPageProps = {
  searchParams?: Promise<{
    cms_status?: string;
    cms_table?: string;
    cms_message?: string;
    section?: string;
    view?: string;
  }>;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown) {
  return isPlainRecord(value) ? value : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function tableRows(snapshot: { data: { tables: Array<{ table: string; rows: AdminRow[] }> } }, table: string) {
  return snapshot.data.tables.find((entry) => entry.table === table)?.rows ?? [];
}

function mergeCmsSnapshots(
  core: Awaited<ReturnType<typeof getCmsCoreSnapshot>>,
  advanced: Awaited<ReturnType<typeof getCmsAdvancedWorkspaceSnapshot>> | null
) {
  if (!advanced) return core;
  return {
    status: core.status === "LIVE" && advanced.status === "LIVE" ? "LIVE" as const : "PARTIAL" as const,
    source: "supabase-admin" as const,
    blockedReason: core.blockedReason ?? advanced.blockedReason,
    data: { tables: [...core.data.tables, ...advanced.data.tables] }
  };
}

function statusLabel(row: AdminRow) {
  const value = text(row.status) || text(row.workflow_status) || (row.published_at ? "published" : "draft");
  return value.toLowerCase() === "published" ? "Published" : "Draft";
}

function formatDate(value: unknown) {
  const source = text(value);
  if (!source) return "Not updated yet";
  const parsed = new Date(source);
  if (Number.isNaN(parsed.getTime())) return source;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function publicMediaUrl(asset: AdminRow) {
  return text(asset.public_url) || text(asset.url) || text(asset.src);
}

function mediaLabel(asset: AdminRow, index: number) {
  return text(asset.caption) || text(asset.alt_text) || text(asset.alt) || `Media item ${index + 1}`;
}

function heroImageSrc(hero: AdminRow) {
  return text(record(hero.image).src);
}

function heroImageAlt(hero: AdminRow) {
  return text(record(hero.image).alt, text(hero.title, "Homepage hero"));
}

function mediaSrc(row: AdminRow, key: string) {
  return text(record(row[key]).src);
}

function mediaAlt(row: AdminRow, key: string, fallback: string) {
  return text(record(row[key]).alt, fallback);
}

function jsonField(value: unknown) {
  if (isPlainRecord(value)) return JSON.stringify(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "{}";
}

function stringListField(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean).join(", ") : text(value);
}

function routePreviewHref(routeKey: string) {
  return routeKey ? `/${routeKey}` : "/products";
}

function fields(overrides: Partial<CmsWorkspaceSection["fields"]> = {}): CmsWorkspaceSection["fields"] {
  return {
    title: "",
    subtitle: "",
    body: "",
    ctaLabel: "",
    href: "",
    imageSrc: "",
    imageAlt: "",
    label: "",
    role: "",
    rating: "",
    componentKey: "",
    sectionKey: "",
    payloadJson: "{}",
    footerColumnId: "",
    footerColumnTitle: "",
    footerLinkId: "",
    footerLinkLabel: "",
    footerLinkHref: "",
    navPlacement: "primary",
    titleColor: "",
    subtitleColor: "",
    productSlug: "",
    posterSrc: "",
    posterAlt: "",
    videoSrc: "",
    videoAlt: "",
    theme: "light",
    compositionMode: "full-bleed",
    compositionTextTone: "dark",
    compositionMediaPosition: "center",
    compositionMobileMediaPosition: "center",
    compositionProductDominance: "flagship",
    routeKey: "",
    showcaseImageSrc: "",
    showcaseImageAlt: "",
    showcaseImageJson: "{}",
    personality: "",
    featuredProductSlugs: "",
    ecosystemPayloadJson: "{}",
    mediaAssetId: "",
    startsAt: "",
    endsAt: "",
    ...overrides
  };
}

function updatedAt(row: AdminRow) {
  return formatDate(row.updated_at ?? row.created_at ?? row.published_at);
}

function sectionBase(row: AdminRow, fallbackEntityId: string) {
  return {
    entityId: text(row.id) || text(row.section_key) || fallbackEntityId,
    status: statusLabel(row),
    updatedAt: updatedAt(row),
    sortOrder: integer(row.sort_order),
    isVisible: row.is_visible !== false
  };
}

const homepageSectionAliases = {
  features: "homepage-features",
  products: "product-highlights",
  testimonials: "homepage-testimonial",
  campaign: "homepage-campaign"
};

function sectionIdsMatching(sections: CmsWorkspaceSection[], keywords: string[]) {
  return sections
    .filter((section) => {
      const haystack = [
        section.id,
        section.title,
        section.description,
        section.kind,
        section.fields.label,
        section.fields.sectionKey,
        section.fields.componentKey
      ].join(" ").toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    })
    .map((section) => section.id);
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function latestRestoreRevision(rows: ContentRevisionRow[]): CmsRestoreRevision {
  const sorted = [...rows]
    .filter((row) => text(row.entity_table) && text(row.entity_id) && integer(row.revision) > 0)
    .sort((left, right) => {
      const timeDelta = text(right.created_at).localeCompare(text(left.created_at));
      if (timeDelta !== 0) return timeDelta;
      return integer(right.revision) - integer(left.revision);
    });

  const latest = sorted[0];
  if (!latest) return null;

  const table = text(latest.entity_table);
  const entityId = text(latest.entity_id);

  return {
    table,
    entityId,
    revision: integer(latest.revision),
    snapshotJson: JSON.stringify(record(latest.snapshot)),
    label: text(latest.change_summary, `${table} revision ${integer(latest.revision)}`)
  };
}

export default async function CmsPage({ searchParams }: CmsPageProps) {
  const params = await searchParams;
  const advancedView = params?.view === "advanced";
  const [coreSnapshot, advancedSnapshot, homepageContent] = await Promise.all([
    getCmsCoreSnapshot(),
    advancedView ? getCmsAdvancedWorkspaceSnapshot() : Promise.resolve(null),
    getHomepageCmsContent()
  ]);
  const snapshot = mergeCmsSnapshots(coreSnapshot, advancedSnapshot);
  const cmsStatus = params?.cms_status === "error" ? "error" : params?.cms_status === "success" ? "success" : null;
  const cmsMessage = params?.cms_message ? decodeURIComponent(params.cms_message) : "";
  const cmsTable = params?.cms_table ? decodeURIComponent(params.cms_table) : "Website";
  const initialSection = params?.section as HomepageCmsSectionId | undefined;

  const heroRows = tableRows(snapshot, "hero_banners");
  const productReviewRows = tableRows(snapshot, "product_reviews");
  const footerColumns = advancedView ? tableRows(snapshot, "footer_columns") : [];
  const footerLinks = advancedView ? tableRows(snapshot, "footer_links") : [];
  const navigationRows = advancedView ? tableRows(snapshot, "site_navigation") : [];
  const categoryRows = advancedView ? tableRows(snapshot, "category_metadata") : [];
  const mediaRows = tableRows(snapshot, "media_assets").filter((asset) => publicMediaUrl(asset));
  const revisionRows = advancedView ? (tableRows(snapshot, "content_revisions") as ContentRevisionRow[]) : [];

  const heroSections: CmsWorkspaceSection[] = heroRows.map((hero, index) => {
    const heroBase = sectionBase(hero, `homepage-hero-${index + 1}`);
    const entityId = text(hero.id, heroBase.entityId);
    const composition = record(hero.composition);
    return {
      id: `hero-banner-${entityId}`,
      pageId: "homepage",
      anchor: index === 0 ? CMS_WORKSPACE_ANCHORS.hero : `cms-section-hero-${entityId}`,
      routePath: "/",
      previewHref: "/",
      kind: "hero",
      title: "Hero Banner",
      description: "Edit the main homepage image, message, and primary button.",
      table: "hero_banners",
      ...heroBase,
      entityId,
      fields: fields({
        title: text(hero.title),
        subtitle: text(hero.subtitle),
        ctaLabel: text(hero.cta_label),
        href: text(hero.href),
        imageSrc: heroImageSrc(hero),
        imageAlt: heroImageAlt(hero),
        productSlug: text(hero.product_slug),
        posterSrc: mediaSrc(hero, "poster"),
        posterAlt: mediaAlt(hero, "poster", text(hero.title, "Hero poster")),
        videoSrc: mediaSrc(hero, "video"),
        videoAlt: mediaAlt(hero, "video", text(hero.title, "Hero video")),
        theme: text(hero.theme, "light"),
        compositionMode: text(composition.mode, "full-bleed"),
        compositionTextTone: text(composition.textTone, "dark"),
        compositionMediaPosition: text(composition.mediaPosition, "center"),
        compositionMobileMediaPosition: text(composition.mobileMediaPosition, "center"),
        compositionProductDominance: text(composition.productDominance, "flagship"),
        titleColor: text(hero.title_color),
        subtitleColor: text(hero.subtitle_color),
        startsAt: text(hero.starts_at),
        endsAt: text(hero.ends_at)
      })
    };
  });

  const productReviewSections: CmsWorkspaceSection[] = productReviewRows.map((review, index) => {
    const reviewBase = sectionBase(review, `product-review-${index + 1}`);
    const entityId = text(review.id, reviewBase.entityId);
    return {
      id: `product-review-${entityId}`,
      pageId: "product-reviews",
      anchor: `cms-section-product-review-${entityId}`,
      routePath: "/",
      previewHref: "/",
      kind: "product_review",
      title: text(review.reviewer_name, `Product review ${index + 1}`),
      description: "Edit the homepage product review quote, rating, and linked product.",
      table: "product_reviews",
      ...reviewBase,
      entityId,
      fields: fields({
        title: text(review.reviewer_name),
        label: text(review.reviewer_name),
        body: text(review.body),
        rating: String(review.rating ?? ""),
        productSlug: text(review.product_slug)
      })
    };
  });

  const categorySections: CmsWorkspaceSection[] = categoryRows.map((category, index) => {
    const routeKey = text(category.route_key, `category-${index + 1}`);
    const showcase = record(category.showcase_image);
    const categoryBase = sectionBase(category, routeKey);
    return {
      id: `category-banner-${routeKey}`,
      pageId: "category-banners",
      anchor: `cms-section-category-${routeKey}`,
      routePath: routePreviewHref(routeKey),
      previewHref: routePreviewHref(routeKey),
      kind: "category",
      title: text(category.title, `Category ${index + 1}`),
      description: `Control the category banner and route metadata for ${routePreviewHref(routeKey)}.`,
      table: "category_metadata",
      ...categoryBase,
      entityId: routeKey,
      stateEntityId: routeKey,
      fields: fields({
        routeKey,
        title: text(category.title),
        subtitle: text(category.subtitle),
        imageSrc: text(category.hero_image),
        imageAlt: text(category.title, routeKey),
        showcaseImageSrc: text(showcase.src),
        showcaseImageAlt: text(showcase.alt, text(category.title, routeKey)),
        showcaseImageJson: jsonField(category.showcase_image),
        personality: text(category.personality),
        featuredProductSlugs: stringListField(category.featured_product_slugs),
        ecosystemPayloadJson: jsonField(category.ecosystem_payload)
      })
    };
  });

  const footerSections: CmsWorkspaceSection[] = footerColumns.map((footerColumn, index) => {
    const footerLink = footerLinks.find((link) => text(link.column_id) === text(footerColumn.id)) ?? footerLinks[index] ?? {};
    const footerBase = sectionBase(footerColumn, `footer-column-${index + 1}`);
    const entityId = text(footerColumn.id, footerBase.entityId);
    return {
      id: `footer-${entityId}`,
      pageId: "footer-page",
      anchor: `cms-section-footer-${entityId}`,
      routePath: "/",
      previewHref: "/",
      kind: "footer",
      title: text(footerColumn.title, `Footer CTA ${index + 1}`),
      description: "Edit a real footer group and its visible footer link.",
      table: "footer_columns",
      ...footerBase,
      entityId,
      relatedPublishTargets: text(footerLink.id)
        ? [
            {
              table: "footer_links",
              entityId: text(footerLink.id),
              changeSummary: `Publish footer link ${text(footerLink.id)}`
            }
          ]
        : [],
      fields: fields({
        title: text(footerColumn.title),
        label: text(footerColumn.title),
        body: text(footerLink.label),
        href: text(footerLink.href),
        footerColumnId: entityId,
        footerColumnTitle: text(footerColumn.title),
        footerLinkId: text(footerLink.id),
        footerLinkLabel: text(footerLink.label),
        footerLinkHref: text(footerLink.href)
      })
    };
  });

  const navigationSections: CmsWorkspaceSection[] = navigationRows.map((navItem, index) => {
    const navBase = sectionBase(navItem, `navigation-${index + 1}`);
    const entityId = text(navItem.id, navBase.entityId);
    return {
      id: `navigation-${entityId}`,
      pageId: "navigation-page",
      anchor: `cms-section-navigation-${entityId}`,
      routePath: "/",
      previewHref: text(navItem.href, "/"),
      kind: "navigation",
      title: text(navItem.label, `Navigation item ${index + 1}`),
      description: "Edit a real navigation item without route metadata.",
      table: "site_navigation",
      ...navBase,
      entityId,
      fields: fields({
        title: text(navItem.label),
        label: text(navItem.label),
        href: text(navItem.href),
        navPlacement: text(navItem.placement, "primary")
      })
    };
  });

  const sections: CmsWorkspaceSection[] = advancedView
    ? [
        ...heroSections,
        ...categorySections,
        ...productReviewSections,
        ...footerSections,
        ...navigationSections
      ]
    : [];
  const homepageSectionIds = [...heroSections, ...productReviewSections, ...footerSections].map((section) => section.id);
  const productSectionIds = sectionIdsMatching(productReviewSections, ["product", "catalog", "featured", homepageSectionAliases.products]);
  const aboutSectionIds = sectionIdsMatching(heroSections, ["about", "story", "mission"]);
  const contactSectionIds = uniqueIds([
    ...sectionIdsMatching(footerSections, ["contact", "cta"]),
    ...footerSections.map((section) => section.id)
  ]);
  const footerSectionIds = footerSections.map((section) => section.id);
  const sectionIdsByPage: Record<string, string[]> = {
    homepage: homepageSectionIds,
    "category-banners": categorySections.map((section) => section.id),
    "products-page": productSectionIds,
    "product-detail-pages": productSectionIds,
    "navigation-page": navigationSections.map((section) => section.id),
    "footer-page": footerSectionIds,
    about: aboutSectionIds,
    contact: contactSectionIds,
    "product-reviews": productReviewSections.map((section) => section.id)
  };
  const workspacePages: CmsWorkspacePage[] = CMS_WORKSPACE_PAGES
    .map((page) => ({ ...page, sectionIds: sectionIdsByPage[page.id] ?? [] }))
    .filter((page) => page.sectionIds.length > 0);
  const hero = heroRows[0] ?? {};

  const media: CmsWorkspaceMedia[] = mediaRows.map((asset, index) => ({
    id: text(asset.id, `media-${index}`),
    label: mediaLabel(asset, index),
    src: publicMediaUrl(asset),
    alt: text(asset.alt_text) || text(asset.alt) || mediaLabel(asset, index),
    width: integer(asset.width ?? record(asset.metadata).width),
    height: integer(asset.height ?? record(asset.metadata).height),
    usage: text(asset.usage_scope) || text(asset.caption)
  }));

  const homepageMediaAssets = media.map((item) => ({
    id: item.id,
    label: item.label,
    src: item.src,
    alt: item.alt,
    width: item.width || undefined,
    height: item.height || undefined,
    usage: item.usage
  }));

  const metrics = [
    { label: "Homepage sections", value: String(homepageSectionDefinitions.length) },
    { label: "Hero slides", value: String(heroSections.length) },
    { label: "Reviews", value: String(productReviewSections.length) },
    { label: "State", value: statusLabel(hero) }
  ];

  const homepageHeroRecords = heroSections.map((section) => ({
    id: section.entityId,
    title: section.fields.title,
    subtitle: section.fields.subtitle,
    ctaLabel: section.fields.ctaLabel,
    href: section.fields.href,
    imageSrc: section.fields.imageSrc,
    imageAlt: section.fields.imageAlt,
    status: section.status,
    sortOrder: section.sortOrder,
    isVisible: section.isVisible
  }));

  const homepageReviewRecords = productReviewSections.map((section) => ({
    id: section.entityId,
    reviewerName: section.fields.title,
    body: section.fields.body,
    productSlug: section.fields.productSlug,
    rating: Number(section.fields.rating || 5),
    status: section.status,
    sortOrder: section.sortOrder,
    isVisible: section.isVisible
  }));

  const footerLead = {
    leadTitle: footerContent.leadTitle,
    leadBody: footerContent.leadBody,
    emailPlaceholder: footerContent.emailPlaceholder,
    ctaLabel: footerContent.ctaLabel,
    legalText: footerContent.legalText
  };

  return (
    <div id={CMS_WORKSPACE_ANCHORS.root} data-admin-cms-route className="grid gap-4">
      <ModulePanel
        eyebrow="CMS editor"
        title="Homepage content."
        description={snapshot.blockedReason ?? "Edit the live homepage in the same order visitors see it — hero, shelves, mission worlds, reviews, about, and footer."}
        status={snapshot.status}
        metrics={metrics}
      />

      <div id="cms-status" data-cms-operational-feedback>
        <OperationalFeedback
          status={cmsStatus}
          message={cmsMessage}
          context={cmsTable}
          idle="Save, publish, and homepage copy updates appear here."
        />
      </div>

      <HomepageCmsEditor
        homepageContent={homepageContent}
        heroBanners={homepageHeroRecords}
        productReviews={homepageReviewRecords}
        footerLead={footerLead}
        mediaAssets={homepageMediaAssets}
        initialSection={initialSection}
      />

      <details className="rounded-xl border border-slate-800 bg-[#0f141b] p-4 shadow-none" open={advancedView}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-200">
          Advanced CMS — navigation, category banners, revisions
        </summary>
        <div className="mt-4">
          {advancedView ? (
            <CmsVisualWorkspaceLoader
              pages={workspacePages}
              sections={sections}
              media={media}
              restoreRevision={latestRestoreRevision(revisionRows)}
            />
          ) : (
            <p className="rounded-xl border border-dashed border-slate-800 bg-[#10151d] px-4 py-6 text-sm text-slate-400">
              Advanced workspace data loads on demand. Add <code className="text-emerald-300">?view=advanced</code> to the URL to open navigation, category banners, footer columns, FAQs, and revision restore tools.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
