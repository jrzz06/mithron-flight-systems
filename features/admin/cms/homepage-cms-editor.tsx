"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  ExternalLink,
  LayoutTemplate,
  Megaphone,
  MessageSquareQuote,
  Package,
  Sparkles,
  Sprout,
  Building2
} from "lucide-react";
import {
  homepageCmsSections,
  type HomepageCmsContent,
  type HomepageCmsSectionId,
  type HomepageMissionCms,
  type HomepageShelfCms
} from "@/config/homepage-cms";
import { footerContent } from "@/config/storefront-content";
import { AdminStickyActionFooter } from "@/components/admin/module-panel";
import { CmsMediaField, type CmsMediaAssetOption } from "@/components/admin/cms-media-field";
import {
  publishCmsWorkspaceRecordFormAction,
  publishHeroBannerFormAction,
  saveHeroBannerDraftFormAction,
  saveHomepageAboutFormAction,
  saveHomepageFooterLeadFormAction,
  saveHomepageMissionFormAction,
  saveHomepageShelfFormAction,
  saveHomepageTestimonialsHeaderFormAction,
  saveProductReviewDraftFormAction
} from "@/app/admin/cms/actions";

type HeroBannerRecord = {
  id: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  href: string;
  imageSrc: string;
  imageAlt: string;
  status: string;
  sortOrder: number;
  isVisible: boolean;
};

type ProductReviewRecord = {
  id: string;
  reviewerName: string;
  body: string;
  productSlug: string;
  rating: number;
  status: string;
  sortOrder: number;
  isVisible: boolean;
};

type FooterLeadRecord = {
  leadTitle: string;
  leadBody: string;
  contactEmail: string;
  contactPhone: string;
  legalText: string;
};

export type HomepageCmsEditorProps = {
  homepageContent: HomepageCmsContent;
  heroBanners: HeroBannerRecord[];
  productReviews: ProductReviewRecord[];
  footerLead: FooterLeadRecord;
  mediaAssets: CmsMediaAssetOption[];
  initialSection?: HomepageCmsSectionId;
};

const sectionIcons: Record<HomepageCmsSectionId, React.ReactNode> = {
  hero: <Sparkles className="size-4" aria-hidden="true" />,
  "shelf-drone-world": <Package className="size-4" aria-hidden="true" />,
  "shelf-drone-care": <Package className="size-4" aria-hidden="true" />,
  "shelf-global-products": <Package className="size-4" aria-hidden="true" />,
  "mission-agri": <Sprout className="size-4" aria-hidden="true" />,
  "mission-city": <Building2 className="size-4" aria-hidden="true" />,
  testimonials: <MessageSquareQuote className="size-4" aria-hidden="true" />,
  "product-reviews": <MessageSquareQuote className="size-4" aria-hidden="true" />,
  about: <LayoutTemplate className="size-4" aria-hidden="true" />,
  footer: <Megaphone className="size-4" aria-hidden="true" />
};

function inputClass() {
  return "h-10 w-full rounded-lg border border-slate-800 bg-[#0b1017] px-3 text-sm text-slate-100 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20";
}

function textareaClass() {
  return "min-h-[96px] w-full rounded-lg border border-slate-800 bg-[#0b1017] px-3 py-2.5 text-sm leading-6 text-slate-100 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20";
}

function Field({
  label,
  name,
  defaultValue,
  hint,
  type = "text"
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-400">
      {label}
      <input type={type} name={name} defaultValue={defaultValue} className={inputClass()} />
      {hint ? <span className="text-[11px] font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  hint
}: {
  label: string;
  name: string;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-400">
      {label}
      <textarea name={name} defaultValue={defaultValue} className={textareaClass()} />
      {hint ? <span className="text-[11px] font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized === "published"
      ? "border-emerald-500/25 bg-emerald-950/30 text-emerald-200"
      : "border-amber-500/25 bg-amber-950/30 text-amber-200";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tone}`}>
      {status}
    </span>
  );
}

function WorkflowBadge({ label }: { label: string }) {
  const draftPublish = label === "Draft → Publish";
  const tone = draftPublish
    ? "border-amber-500/25 bg-amber-950/30 text-amber-200"
    : "border-emerald-500/25 bg-emerald-950/30 text-emerald-200";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${tone}`}>
      {label}
    </span>
  );
}

function DraftPublishNotice({ itemLabel }: { itemLabel: string }) {
  return (
    <div
      className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100"
      data-testid="cms-draft-publish-notice"
    >
      <p className="font-semibold">Draft → Publish workflow</p>
      <p className="mt-1 text-xs leading-5 text-amber-100/80">
        Saving a draft stores your changes but does not update the storefront. Click <strong>Publish {itemLabel}</strong> to make changes live.
      </p>
    </div>
  );
}

function CmsSplitNotice({
  title,
  body,
  href,
  linkLabel
}: {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#10151d] px-4 py-3 text-sm text-slate-300" data-testid="cms-split-source-notice">
      <p className="font-semibold text-slate-100">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{body}</p>
      <Link href={href} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200">
        {linkLabel}
        <ArrowUpRight className="size-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function ShelfEditor({
  shelfKey,
  shelf,
  mediaAssets
}: {
  shelfKey: keyof HomepageCmsContent["shelves"];
  shelf: HomepageShelfCms;
  mediaAssets: CmsMediaAssetOption[];
}) {
  return (
    <form action={saveHomepageShelfFormAction} className="grid gap-4">
      <input type="hidden" name="shelf_key" value={shelfKey} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Eyebrow" name="eyebrow" defaultValue={shelf.eyebrow} />
        <Field label="Section title" name="title" defaultValue={shelf.title} />
        <Field label="View all link" name="href" defaultValue={shelf.href} />
        <Field label="View all label" name="view_all_label" defaultValue={shelf.viewAllLabel} />
        <Field label="Guide label" name="guide_label" defaultValue={shelf.guideLabel} />
        <Field label="Guide title" name="guide_title" defaultValue={shelf.guideTitle} />
        <Field label="Guide link" name="guide_href" defaultValue={shelf.guideHref} />
        <Field label="Banner eyebrow" name="hero_eyebrow" defaultValue={shelf.heroEyebrow} />
        <Field
          label="Banner heading override (optional)"
          name="hero_subtitle"
          defaultValue={shelf.heroSubtitle}
        />
        <Field label="Banner description" name="hero_body" defaultValue={shelf.heroBody} />
        <Field label="Banner CTA label" name="feature_cta" defaultValue={shelf.featureCta} />
        <Field label="Banner CTA link" name="hero_cta_href" defaultValue={shelf.heroCtaHref} />
        <CmsMediaField
          label="Hero image"
          name="hero_image_src"
          altName="hero_image_alt"
          defaultValue={shelf.heroImageSrc}
          defaultAlt={shelf.heroImageAlt}
          mediaAssets={mediaAssets}
        />
      </div>
      <AdminStickyActionFooter>
        <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500">
          Save shelf copy
        </button>
      </AdminStickyActionFooter>
    </form>
  );
}

function MissionEditor({
  missionKey,
  mission,
  mediaAssets
}: {
  missionKey: keyof HomepageCmsContent["missions"];
  mission: HomepageMissionCms;
  mediaAssets: CmsMediaAssetOption[];
}) {
  return (
    <form action={saveHomepageMissionFormAction} className="grid gap-4">
      <input type="hidden" name="mission_key" value={missionKey} />
      <input type="hidden" name="tile_count" value={String(mission.tiles.length)} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Eyebrow" name="eyebrow" defaultValue={mission.eyebrow} />
        <Field label="Section title" name="title" defaultValue={mission.title} />
        <Field label="Section link" name="href" defaultValue={mission.href} />
        <Field label="Primary CTA" name="cta" defaultValue={mission.cta} />
      </div>
      <TextAreaField label="Intro body" name="body" defaultValue={mission.body} />
      <TextAreaField label="Media note" name="media_note" defaultValue={mission.mediaNote} hint="Shown as the fallback disclaimer under the mission copy." />
      <div className="grid gap-3">
        {mission.tiles.map((tile, index) => (
          <details key={`${missionKey}-tile-${index}`} className="rounded-xl border border-slate-800 bg-[#10151d] p-3" open={index === 0}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-200">{tile.label || `Mission tile ${index + 1}`}</summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field label="Tile label" name={`tile_${index}_label`} defaultValue={tile.label} />
              <Field label="Operator" name={`tile_${index}_operator`} defaultValue={tile.operator} />
              <Field label="Model" name={`tile_${index}_model`} defaultValue={tile.model} />
              <Field label="Location" name={`tile_${index}_location`} defaultValue={tile.location} />
              <Field label="Tile link" name={`tile_${index}_href`} defaultValue={tile.href} />
              <CmsMediaField
                label="Tile image"
                name={`tile_${index}_image_src`}
                altName={`tile_${index}_image_alt`}
                defaultValue={tile.imageSrc}
                defaultAlt={tile.imageAlt}
                mediaAssets={mediaAssets}
              />
              <div className="md:col-span-2">
                <TextAreaField label="Tile body" name={`tile_${index}_body`} defaultValue={tile.body} />
              </div>
            </div>
          </details>
        ))}
      </div>
      <AdminStickyActionFooter>
        <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500">
          Save mission section
        </button>
      </AdminStickyActionFooter>
    </form>
  );
}

function HeroEditor({ heroes, mediaAssets }: { heroes: HeroBannerRecord[]; mediaAssets: CmsMediaAssetOption[] }) {
  const [activeId, setActiveId] = useState(heroes[0]?.id ?? "");
  const active = heroes.find((hero) => hero.id === activeId) ?? heroes[0];

  if (!active) {
    return (
      <p className="rounded-xl border border-dashed border-slate-800 bg-[#10151d] px-4 py-8 text-sm text-slate-400">
        No hero banners yet. Add one from the advanced CMS editor or seed the database.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <DraftPublishNotice itemLabel="slide" />
      <div className="flex flex-wrap gap-2">
        {heroes.map((hero, index) => (
          <button
            key={hero.id}
            type="button"
            onClick={() => setActiveId(hero.id)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              hero.id === active.id
                ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
                : "border-slate-800 bg-[#10151d] text-slate-300 hover:border-slate-700"
            }`}
          >
            Slide {index + 1}
            <StatusPill status={hero.status} />
          </button>
        ))}
      </div>

      <form id={`hero-draft-${active.id}`} action={saveHeroBannerDraftFormAction} className="grid gap-4 rounded-xl border border-slate-800 bg-[#10151d] p-4">
        <input type="hidden" name="id" value={active.id} />
        <input type="hidden" name="sort_order" value={String(active.sortOrder)} />
        <input type="hidden" name="is_visible" value={active.isVisible ? "on" : "off"} />
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="relative aspect-[16/10] overflow-hidden rounded-lg border border-slate-800 bg-[#0b1017]">
            {active.imageSrc ? (
              <Image src={active.imageSrc} alt={active.imageAlt || active.title} fill sizes="220px" className="object-cover" />
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Headline" name="title" defaultValue={active.title} />
            <Field label="Subtitle" name="subtitle" defaultValue={active.subtitle} />
            <Field label="Button label" name="cta_label" defaultValue={active.ctaLabel} />
            <Field label="Button link" name="href" defaultValue={active.href} />
            <CmsMediaField
              label="Hero image"
              name="image_src"
              altName="image_alt"
              defaultValue={active.imageSrc}
              defaultAlt={active.imageAlt}
              mediaAssets={mediaAssets}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <button type="submit" form={`hero-draft-${active.id}`} className="inline-flex h-9 items-center rounded-lg border border-slate-700 bg-white/[0.03] px-4 text-sm font-semibold text-slate-100 transition hover:border-slate-600">
            Save draft
          </button>
          <button type="submit" form={`hero-publish-${active.id}`} className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500">
            Publish slide
          </button>
        </div>
      </form>
      <form id={`hero-publish-${active.id}`} action={publishHeroBannerFormAction} className="hidden">
        <input type="hidden" name="id" value={active.id} />
        <input type="hidden" name="change_summary" value={`Publish hero banner ${active.title}`} />
      </form>
      {active.status.toLowerCase() !== "published" ? (
        <p className="text-xs text-amber-200/90" data-testid="hero-draft-status-hint">
          This slide is currently <strong>{active.status}</strong> and will not appear on the homepage until published.
        </p>
      ) : null}
    </div>
  );
}

function ProductReviewsEditor({ reviews }: { reviews: ProductReviewRecord[] }) {
  const [activeId, setActiveId] = useState(reviews[0]?.id ?? "");
  const active = reviews.find((review) => review.id === activeId) ?? reviews[0];

  if (!active) {
    return (
      <p className="rounded-xl border border-dashed border-slate-800 bg-[#10151d] px-4 py-8 text-sm text-slate-400">
        No product reviews yet. Add reviews to populate the homepage cards.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <DraftPublishNotice itemLabel="review" />
      <div className="flex flex-wrap gap-2">
        {reviews.map((review) => (
          <button
            key={review.id}
            type="button"
            onClick={() => setActiveId(review.id)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              review.id === active.id
                ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
                : "border-slate-800 bg-[#10151d] text-slate-300 hover:border-slate-700"
            }`}
          >
            {review.reviewerName || "Review"}
            <StatusPill status={review.status} />
          </button>
        ))}
      </div>

      <form id={`review-draft-${active.id}`} action={saveProductReviewDraftFormAction} className="grid gap-4 rounded-xl border border-slate-800 bg-[#10151d] p-4">
        <input type="hidden" name="id" value={active.id} />
        <input type="hidden" name="sort_order" value={String(active.sortOrder)} />
        <input type="hidden" name="is_visible" value={active.isVisible ? "on" : "off"} />
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Reviewer name" name="reviewer_name" defaultValue={active.reviewerName} />
          <Field label="Product slug" name="product_slug" defaultValue={active.productSlug} hint="Links the review card to a catalog product." />
          <Field label="Rating" name="rating" type="number" defaultValue={String(active.rating)} />
        </div>
        <TextAreaField label="Review quote" name="body" defaultValue={active.body} />
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-3">
          <button type="submit" form={`review-draft-${active.id}`} className="inline-flex h-9 items-center rounded-lg border border-slate-700 bg-white/[0.03] px-4 text-sm font-semibold text-slate-100 transition hover:border-slate-600">
            Save draft
          </button>
          <button type="submit" form={`review-publish-${active.id}`} className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500">
            Publish review
          </button>
        </div>
      </form>
      <form id={`review-publish-${active.id}`} action={publishCmsWorkspaceRecordFormAction} className="hidden">
        <input type="hidden" name="entity_table" value="product_reviews" />
        <input type="hidden" name="entity_id" value={active.id} />
        <input type="hidden" name="change_summary" value={`Publish product review ${active.reviewerName}`} />
      </form>
      {active.status.toLowerCase() !== "published" ? (
        <p className="text-xs text-amber-200/90" data-testid="review-draft-status-hint">
          This review is currently <strong>{active.status}</strong> and will not appear on the homepage until published.
        </p>
      ) : null}
    </div>
  );
}

function FooterLeadEditor({ footerLead }: { footerLead: FooterLeadRecord }) {
  return (
    <div className="grid gap-4">
      <CmsSplitNotice
        title="Footer content is split across two CMS stores"
        body="Footer lead copy and contact details save here (admin_settings). Footer link columns are managed in Advanced CMS under footer_columns and footer_links."
        href="/admin/cms?view=advanced#footer-page"
        linkLabel="Edit footer columns in Advanced CMS"
      />
      <form action={saveHomepageFooterLeadFormAction} className="grid gap-4">
      <Field label="Footer title" name="footer_lead_title" defaultValue={footerLead.leadTitle || footerContent.leadTitle} />
      <TextAreaField label="Footer body" name="footer_lead_body" defaultValue={footerLead.leadBody || footerContent.leadBody} />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Contact email" name="footer_contact_email" type="email" defaultValue={footerLead.contactEmail || footerContent.contactEmail} />
        <Field label="Contact phone" name="footer_contact_phone" defaultValue={footerLead.contactPhone || footerContent.contactPhone} />
      </div>
      <TextAreaField label="Legal text" name="footer_legal_text" defaultValue={footerLead.legalText || footerContent.legalText} />
      <AdminStickyActionFooter>
        <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500">
          Save footer copy
        </button>
      </AdminStickyActionFooter>
      </form>
    </div>
  );
}

function renderSectionEditor(
  sectionId: HomepageCmsSectionId,
  props: HomepageCmsEditorProps
) {
  const { homepageContent, heroBanners, productReviews, footerLead, mediaAssets } = props;

  switch (sectionId) {
    case "hero":
      return <HeroEditor heroes={heroBanners} mediaAssets={mediaAssets} />;
    case "shelf-drone-world":
      return <ShelfEditor shelfKey="droneWorld" shelf={homepageContent.shelves.droneWorld} mediaAssets={mediaAssets} />;
    case "shelf-drone-care":
      return <ShelfEditor shelfKey="droneCare" shelf={homepageContent.shelves.droneCare} mediaAssets={mediaAssets} />;
    case "shelf-global-products":
      return <ShelfEditor shelfKey="globalProducts" shelf={homepageContent.shelves.globalProducts} mediaAssets={mediaAssets} />;
    case "mission-agri":
      return <MissionEditor missionKey="agri" mission={homepageContent.missions.agri} mediaAssets={mediaAssets} />;
    case "mission-city":
      return <MissionEditor missionKey="city" mission={homepageContent.missions.city} mediaAssets={mediaAssets} />;
    case "testimonials":
      return (
        <form action={saveHomepageTestimonialsHeaderFormAction} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Eyebrow" name="eyebrow" defaultValue={homepageContent.testimonials.eyebrow} />
            <Field label="Section title" name="title" defaultValue={homepageContent.testimonials.title} />
            <Field label="Browse link label" name="link_label" defaultValue={homepageContent.testimonials.linkLabel} />
            <Field label="Browse link URL" name="link_href" defaultValue={homepageContent.testimonials.linkHref} />
          </div>
          <TextAreaField label="Intro copy" name="lead" defaultValue={homepageContent.testimonials.lead} />
          <AdminStickyActionFooter>
            <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500">
              Save reviews header
            </button>
          </AdminStickyActionFooter>
        </form>
      );
    case "product-reviews":
      return <ProductReviewsEditor reviews={productReviews} />;
    case "about":
      return (
        <form action={saveHomepageAboutFormAction} className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Eyebrow" name="eyebrow" defaultValue={homepageContent.about.eyebrow} />
            <Field label="Headline" name="title" defaultValue={homepageContent.about.title} />
            <Field label="Primary button" name="primary_label" defaultValue={homepageContent.about.primaryLabel} />
            <Field label="Primary link" name="primary_href" defaultValue={homepageContent.about.primaryHref} />
            <Field label="Secondary button" name="secondary_label" defaultValue={homepageContent.about.secondaryLabel} />
            <Field label="Secondary link" name="secondary_href" defaultValue={homepageContent.about.secondaryHref} />
          </div>
          <TextAreaField label="Body copy" name="body" defaultValue={homepageContent.about.body} />
          <AdminStickyActionFooter>
            <button type="submit" className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500">
              Save about band
            </button>
          </AdminStickyActionFooter>
        </form>
      );
    case "footer":
      return <FooterLeadEditor footerLead={footerLead} />;
    default:
      return null;
  }
}

export function HomepageCmsEditor(props: HomepageCmsEditorProps) {
  const initial = props.initialSection && homepageCmsSections.some((section) => section.id === props.initialSection)
    ? props.initialSection
    : "hero";
  const [activeSection, setActiveSection] = useState<HomepageCmsSectionId>(initial);
  const activeMeta = useMemo(
    () => homepageCmsSections.find((section) => section.id === activeSection) ?? homepageCmsSections[0],
    [activeSection]
  );

  return (
    <section data-homepage-cms-editor className="overflow-hidden rounded-xl border border-slate-800 bg-[#0f141b] shadow-none">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-[#10151d] px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-400/90">Homepage editor</p>
          <h2 className="mt-1 text-base font-semibold text-slate-100">Edit the live homepage section by section</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-white/[0.03] px-3 text-sm font-semibold text-slate-100 transition hover:border-slate-600"
          >
            Preview homepage
            <ExternalLink className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/#${activeMeta.previewAnchor}`}
            target="_blank"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 text-sm font-semibold text-emerald-100 transition hover:border-emerald-500/50"
          >
            Jump to section
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-slate-800 lg:border-b-0 lg:border-r" data-homepage-cms-sidebar>
          <div className="grid gap-1 p-3">
            {homepageCmsSections.map((section) => {
              const active = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  data-homepage-cms-nav-item={section.id}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    active ? "bg-emerald-950/30 text-emerald-50 ring-1 ring-emerald-500/25" : "text-slate-300 hover:bg-white/[0.03]"
                  }`}
                >
                  <span className={`mt-0.5 ${active ? "text-emerald-300" : "text-slate-500"}`}>{sectionIcons[section.id]}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{section.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-5 text-slate-500">{section.description}</span>
                  </span>
                  <ChevronRight className={`ml-auto mt-1 size-4 shrink-0 ${active ? "text-emerald-300" : "text-slate-600"}`} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div className="p-3 pt-0">
            <CmsSplitNotice
              title="Navigation lives in Advanced CMS"
              body="Top navigation items are stored in site_navigation and require draft → publish. Use Advanced CMS to edit menu labels and links."
              href="/admin/cms?view=advanced#navigation-page"
              linkLabel="Open navigation editor"
            />
          </div>
        </aside>

        <div className="grid min-w-0 content-start gap-4 p-4" data-homepage-cms-panel>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Editing</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-slate-100">{activeMeta.label}</h3>
              <WorkflowBadge label={activeMeta.workflowLabel} />
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">{activeMeta.description}</p>
          </div>
          {renderSectionEditor(activeSection, props)}
        </div>
      </div>
    </section>
  );
}
