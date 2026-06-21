"use client";

import Link from "next/link";
import Image from "next/image";
import { Copy, Crop, Eye, EyeOff, GripVertical, History, ImageIcon, ImagePlus, Monitor, RotateCcw, Save, Search, Send, Smartphone, Tablet } from "lucide-react";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { StatusBadge } from "@/components/admin/module-panel";
import {
  archiveCmsWorkspaceRecordFormAction,
  publishCmsWorkspaceRecordFormAction,
  restoreContentRevisionAction,
  saveCmsMediaUploadFormAction,
  saveCategoryMetadataDraftFormAction,
  saveFooterColumnDraftFormAction,
  saveFooterLinkDraftFormAction,
  saveHeroBannerDraftFormAction,
  saveProductReviewDraftFormAction,
  saveSiteNavigationDraftFormAction
} from "@/app/admin/cms/actions";
import { isDeprecatedCmsStorefrontTable } from "@/config/cms-deprecations";

export type CmsWorkspaceMedia = {
  id: string;
  label: string;
  src: string;
  alt: string;
  width?: number;
  height?: number;
  usage?: string;
};

export type CmsRestoreRevision = {
  table: string;
  entityId: string;
  revision: number;
  snapshotJson: string;
  label: string;
} | null;

export type CmsWorkspaceSection = {
  id: string;
  pageId: string;
  anchor: string;
  routePath: string;
  previewHref: string;
  kind: "hero" | "homepage" | "product" | "product_review" | "footer" | "navigation" | "category";
  title: string;
  description: string;
  table: string;
  entityId: string;
  stateEntityId?: string;
  relatedPublishTargets?: Array<{
    table: string;
    entityId: string;
    changeSummary?: string;
  }>;
  status: string;
  updatedAt: string;
  sortOrder: number;
  isVisible: boolean;
  fields: {
    title: string;
    subtitle: string;
    body: string;
    ctaLabel: string;
    href: string;
    imageSrc: string;
    imageAlt: string;
    label: string;
    role: string;
    rating: string;
    componentKey: string;
    sectionKey: string;
    payloadJson: string;
    footerColumnId: string;
    footerColumnTitle: string;
    footerLinkId: string;
    footerLinkLabel: string;
    footerLinkHref: string;
    navPlacement: string;
    /** CSS color override for headline text. Empty string means "use theme default". */
    titleColor: string;
    /** CSS color override for subtitle/body text. Empty string means "use theme default". */
    subtitleColor: string;
    productSlug: string;
    posterSrc: string;
    posterAlt: string;
    videoSrc: string;
    videoAlt: string;
    theme: string;
    compositionMode: string;
    compositionTextTone: string;
    compositionMediaPosition: string;
    compositionMobileMediaPosition: string;
    compositionProductDominance: string;
    routeKey: string;
    showcaseImageSrc: string;
    showcaseImageAlt: string;
    showcaseImageJson: string;
    personality: string;
    featuredProductSlugs: string;
    ecosystemPayloadJson: string;
    mediaAssetId: string;
    startsAt: string;
    endsAt: string;
  };
};

export type CmsWorkspacePage = {
  id: string;
  label: string;
  anchor: string;
  routePath: string;
  previewHref: string;
  description: string;
  order: number;
  sectionIds: string[];
};

type CmsVisualWorkspaceProps = {
  pages: CmsWorkspacePage[];
  sections: CmsWorkspaceSection[];
  media: CmsWorkspaceMedia[];
  restoreRevision: CmsRestoreRevision;
};

type Viewport = "desktop" | "tablet" | "mobile";

const viewportOptions: Array<{ id: Viewport; label: string; Icon: typeof Monitor }> = [
  { id: "desktop", label: "Desktop", Icon: Monitor },
  { id: "tablet", label: "Tablet", Icon: Tablet },
  { id: "mobile", label: "Mobile", Icon: Smartphone }
];

function generatePublishRequestId(operation: string, entityId: string) {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${operation}-${entityId}-${Date.now()}-${values[0].toString(16)}${values[1].toString(16)}`;
  }
  return `${operation}-${entityId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function PublishRequestField({ operation, entityId }: { operation: string; entityId: string }) {
  const requestId = useMemo(() => generatePublishRequestId(operation, entityId), [operation, entityId]);
  return <input type="hidden" name="publish_request_id" value={requestId} />;
}

function sectionText(section: CmsWorkspaceSection) {
  return `${section.title} ${section.description} ${section.routePath} ${section.fields.title} ${section.fields.label} ${section.fields.routeKey}`.toLowerCase();
}

function getWorkspaceHashAnchor(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash.replace(/^#/, "");
}

function resolveInitialWorkspaceSelection(pages: CmsWorkspacePage[], sections: CmsWorkspaceSection[]) {
  const fallbackPage = pages[0] ?? null;
  const fallbackSectionId = fallbackPage?.sectionIds[0] ?? sections[0]?.id ?? "";
  const anchor = getWorkspaceHashAnchor();

  if (anchor) {
    const section = sections.find((item) => item.anchor === anchor || item.id === anchor);
    if (section) {
      return {
        pageId: section.pageId,
        sectionId: section.id
      };
    }

    const page = pages.find((item) => item.anchor === anchor || item.id === anchor);
    if (page) {
      return {
        pageId: page.id,
        sectionId: page.sectionIds[0] ?? ""
      };
    }
  }

  return {
    pageId: fallbackPage?.id ?? "",
    sectionId: fallbackSectionId
  };
}

function previewWidth(viewport: Viewport) {
  if (viewport === "mobile") return "max-w-[360px]";
  if (viewport === "tablet") return "max-w-[720px]";
  return "max-w-full";
}

function sectionImage(section: CmsWorkspaceSection) {
  return section.fields.imageSrc;
}

function sectionDisplayTitle(section: CmsWorkspaceSection) {
  return section.fields.title || section.fields.label || section.title;
}

function mediaDimensions(item?: CmsWorkspaceMedia) {
  if (item?.width && item.height) return `${item.width} x ${item.height}`;
  return "Dimensions unavailable";
}

function showcaseImageValue(fields: CmsWorkspaceSection["fields"]) {
  const existing = parsePayloadJson(fields.showcaseImageJson);
  if (!fields.showcaseImageSrc) return JSON.stringify(existing);
  return JSON.stringify({
    ...existing,
    src: fields.showcaseImageSrc,
    alt: fields.showcaseImageAlt || fields.title || fields.routeKey || "Category showcase"
  });
}

function PublishRecordFields({ section }: { section: CmsWorkspaceSection }) {
  const entityId = section.stateEntityId ?? section.entityId;
  return (
    <>
      <input type="hidden" name="entity_table" value={section.table} />
      <input type="hidden" name="entity_id" value={entityId} />
      <PublishRequestField operation="publish" entityId={entityId} />
      <input type="hidden" name="change_summary" value={`Publish ${section.title}`} />
      {section.relatedPublishTargets?.map((target, index) => (
        <div key={`${target.table}-${target.entityId}-${index}`}>
          <input type="hidden" name="related_publish_table" value={target.table} />
          <input type="hidden" name="related_publish_entity_id" value={target.entityId} />
          <input type="hidden" name="related_publish_change_summary" value={target.changeSummary ?? `Publish ${section.title}`} />
        </div>
      ))}
    </>
  );
}

function inputClass() {
  return "h-10 rounded-lg border border-slate-700 bg-[#0b1017] px-3 text-sm text-slate-100 outline-none transition focus:border-slate-500";
}

function textareaClass() {
  return "min-h-24 rounded-lg border border-slate-700 bg-[#0b1017] px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-slate-500";
}

function plainRecord(value: unknown): Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function parsePayloadJson(value: string) {
  try {
    return plainRecord(JSON.parse(value) as unknown);
  } catch {
    return {};
  }
}

function VisibilityToggle({ section }: { section: CmsWorkspaceSection }) {
  return (
    <label data-cms-section-visibility-toggle className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-[#10151d] px-3 py-2">
      <span>
        <span className="block text-xs font-semibold text-slate-100">Visible on site</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">Hide this section without deleting its draft.</span>
      </span>
      <input name="is_visible" type="checkbox" defaultChecked={section.isVisible} className="mt-1 h-4 w-4 accent-emerald-500" />
      <input type="hidden" name="is_visible" value="off" />
    </label>
  );
}

function HiddenBase({ section }: { section: CmsWorkspaceSection }) {
  return (
    <>
      <input type="hidden" name="id" value={section.entityId} />
      <input type="hidden" name="sort_order" value={section.sortOrder} />
      <input type="hidden" name="change_summary" value={`Visual edit ${section.title}`} />
      <VisibilityToggle section={section} />
    </>
  );
}

function EditorGroup({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div data-cms-editor-group={title.toLowerCase().replaceAll(" ", "-")} className="grid gap-3 rounded-xl border border-slate-800 bg-[#10151d] p-3">
      <div>
        <p className="text-xs font-semibold text-slate-200">{title}</p>
        {description ? <p className="mt-1 text-[11px] leading-4 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  name,
  multiline = false,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-slate-400">
      {label}
      {multiline ? (
        <textarea
          name={name}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          className={textareaClass()}
        />
      ) : (
        <input
          name={name}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          placeholder={placeholder}
          className={inputClass()}
        />
      )}
    </label>
  );
}

/** Renders an inline color picker (native <input type="color">) paired with a hex text input. */
function ColorField({
  label,
  value,
  onChange,
  name,
  hint
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  name: string;
  hint?: string;
}) {
  // Normalise to a colour usable by <input type="color"> (must be a 6-digit hex).
  // Falls back to #ffffff when empty so the picker always has a valid value.
  const pickerValue = /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";

  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      {hint && <span className="text-[11px] leading-4 text-slate-600">{hint}</span>}
      <div className="flex items-center gap-2">
        {/* Native colour swatch for instant visual feedback. */}
        <label
          className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-700 shadow-inner transition hover:border-slate-500"
          title="Pick a colour"
        >
          <input
            type="color"
            value={pickerValue}
            onChange={(e) => onChange(e.currentTarget.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <span
            className="block h-full w-full rounded-lg"
            style={{ background: value || pickerValue }}
          />
        </label>
        {/* Hex text input lets editors paste exact values or clear the override. */}
        <input
          type="text"
          name={name}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
          placeholder="#ffffff - leave empty for theme default"
          className={`${inputClass()} flex-1 font-mono`}
          maxLength={32}
          spellCheck={false}
        />
        {/* Clear button */}
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="shrink-0 rounded-lg border border-slate-700 bg-[#0b1017] px-2 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-100"
            title="Reset to theme default"
          >
            x
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SectionPreview({
  section,
  viewport
}: {
  section: CmsWorkspaceSection;
  viewport: Viewport;
}) {
  const headline = sectionDisplayTitle(section);
  const body = section.fields.subtitle || section.fields.body || section.description;

  return (
    <div data-cms-live-preview data-cms-debounced-preview data-cms-section-preview className={`mx-auto w-full ${previewWidth(viewport)}`}>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#0b1017] shadow-none">
        <div
          className={`relative grid min-h-[340px] gap-4 p-5 ${viewport === "desktop" ? "md:grid-cols-[1.1fr_0.9fr] md:p-6" : ""}`}
        >
          <div className="relative z-10 flex flex-col justify-end">
            <StatusBadge status={section.status} />
            <h3 className="mt-4 text-2xl font-semibold leading-tight text-slate-100 md:text-3xl" style={section.fields.titleColor ? { color: section.fields.titleColor } : undefined}>{headline}</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400" style={section.fields.subtitleColor ? { color: section.fields.subtitleColor } : undefined}>{body}</p>
            {section.fields.ctaLabel ? (
              <span className="mt-5 inline-flex w-fit rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950">
                {section.fields.ctaLabel}
              </span>
            ) : null}
          </div>
          <div className="relative min-h-[190px] overflow-hidden rounded-xl border border-slate-800 bg-[#10151d]">
            {section.fields.imageSrc ? (
              <Image
                src={section.fields.imageSrc}
                alt={section.fields.imageAlt}
                fill
                sizes={viewport === "mobile" ? "320px" : viewport === "tablet" ? "680px" : "50vw"}
                loading="lazy"
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-sm font-medium text-slate-500">Image preview</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  section,
  isActive,
  onSelect,
  onReorder
}: {
  section: CmsWorkspaceSection;
  isActive: boolean;
  onSelect: () => void;
  onReorder: (draggedId: string, targetId: string) => void;
}) {
  const imageSrc = sectionImage(section);

  return (
    <article
      id={section.anchor}
      data-cms-section-card
      data-cms-section-tree-item
      data-cms-drag-reorder
      data-cms-sort-order={section.sortOrder}
      data-cms-route-path={section.routePath}
      data-cms-active-section={isActive ? "true" : "false"}
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", section.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onReorder(event.dataTransfer.getData("text/plain"), section.id)}
      className={`rounded-xl border p-2 transition ${isActive ? "border-emerald-400/30 bg-emerald-500/10" : "border-slate-800 bg-[#0b1017] hover:border-slate-700 hover:bg-[#111827]"}`}
    >
      <button type="button" data-cms-section-quick-edit onClick={onSelect} className="grid w-full grid-cols-[48px_minmax(0,1fr)] gap-3 text-left">
        <span className="relative block h-12 overflow-hidden rounded-lg border border-slate-800 bg-[#10151d]">
          {imageSrc ? (
            <Image src={imageSrc} alt={section.fields.imageAlt || section.title} fill sizes="48px" loading="lazy" className="object-cover" />
          ) : (
            <span className="grid h-full place-items-center">
              <ImageIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden="true" />
            <span className="truncate text-xs font-semibold text-slate-100">{section.title}</span>
          </span>
          <span className="mt-1 block truncate text-[11px] text-slate-500">{sectionDisplayTitle(section)}</span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={section.status} />
            <span className="text-[10px] font-medium text-slate-600">{section.updatedAt}</span>
          </span>
        </span>
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button type="button" data-cms-section-hide-show onClick={onSelect} className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-800 bg-white/[0.03] px-2 text-[11px] font-semibold text-slate-300 hover:border-slate-700">
          {section.isVisible ? <Eye className="h-3 w-3" aria-hidden="true" /> : <EyeOff className="h-3 w-3" aria-hidden="true" />}
          {section.isVisible ? "Visible" : "Hidden"}
        </button>
        <button type="button" data-cms-section-duplicate aria-disabled="true" className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-800 bg-white/[0.03] px-2 text-[11px] font-semibold text-slate-500">
          <Copy className="h-3 w-3" aria-hidden="true" />
          Duplicate
        </button>
        <form action={publishCmsWorkspaceRecordFormAction} data-cms-section-card-publish data-cms-publish-confirmation>
          <PublishRecordFields section={section} />
          <OperationalSubmitButton
            pendingLabel="Publishing"
            confirmMessage={`Publish ${section.title} to the live website?`}
            className="inline-flex h-7 items-center rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-2 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
          >
            Publish
          </OperationalSubmitButton>
        </form>
      </div>
    </article>
  );
}

export function CmsVisualWorkspace({ pages, sections, media, restoreRevision }: CmsVisualWorkspaceProps) {
  const workspacePages = useMemo(() => {
    return [...pages].sort((left, right) => left.order - right.order);
  }, [pages]);
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => sections.map((section) => section.id));
  const [activePageId, setActivePageId] = useState(() => resolveInitialWorkspaceSelection(workspacePages, sections).pageId);
  const [activeSectionId, setActiveSectionId] = useState(() => resolveInitialWorkspaceSelection(workspacePages, sections).sectionId);
  const [sectionDrafts, setSectionDrafts] = useState<Record<string, CmsWorkspaceSection["fields"]>>(() => (
    Object.fromEntries(sections.map((section) => [section.id, section.fields]))
  ));
  const [query, setQuery] = useState("");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [dirtySections, setDirtySections] = useState<Set<string>>(() => new Set());
  const [recentSections, setRecentSections] = useState<string[]>([]);
  const [isSwitching, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const deferredSectionDrafts = useDeferredValue(sectionDrafts);
  const pageById = useMemo(() => new Map(workspacePages.map((page) => [page.id, page])), [workspacePages]);
  const sectionById = useMemo(() => new Map(sections.map((section) => [section.id, section])), [sections]);
  const orderedSections = useMemo(() => {
    const knownIds = new Set(sectionOrder);
    return [
      ...sectionOrder.map((id) => sectionById.get(id)).filter((section): section is CmsWorkspaceSection => Boolean(section)),
      ...sections.filter((section) => !knownIds.has(section.id))
    ];
  }, [sectionById, sectionOrder, sections]);
  const activePage = pageById.get(activePageId) ?? workspacePages[0] ?? null;
  const activeSectionBase = activeSectionId ? sectionById.get(activeSectionId) ?? null : null;
  const activeSortOrder = activeSectionBase ? Math.max(1, orderedSections.findIndex((section) => section.id === activeSectionBase.id) + 1) * 10 : 0;
  const activeSection = activeSectionBase ? {
    ...activeSectionBase,
    sortOrder: activeSortOrder || activeSectionBase.sortOrder,
    fields: sectionDrafts[activeSectionBase.id] ?? activeSectionBase.fields
  } : null;
  const previewSection = activeSectionBase ? {
    ...activeSectionBase,
    sortOrder: activeSortOrder || activeSectionBase.sortOrder,
    fields: deferredSectionDrafts[activeSectionBase.id] ?? activeSectionBase.fields
  } : null;
  const filteredSections = useMemo(() => {
    const ids = new Set(activePage?.sectionIds ?? []);
    const normalized = deferredQuery.trim().toLowerCase();
    return orderedSections
      .filter((section) => ids.has(section.id))
      .filter((section) => normalized ? sectionText(section).includes(normalized) : true);
  }, [activePage?.sectionIds, deferredQuery, orderedSections]);

  function replaceHash(anchor: string) {
    if (!anchor || typeof window === "undefined") return;
    window.history.replaceState(null, "", `#${anchor}`);
  }

  function activatePage(page: CmsWorkspacePage) {
    startTransition(() => {
      setActivePageId(page.id);
      setActiveSectionId(page.sectionIds[0] ?? "");
      replaceHash(page.anchor);
    });
  }

  function activateSection(id: string) {
    startTransition(() => {
      setActiveSectionId(id);
      const section = sectionById.get(id);
      if (section) replaceHash(section.anchor);
    });
  }

  function reorderSection(draggedId: string, targetId: string) {
    if (!draggedId || draggedId === targetId) return;
    setSectionOrder((current) => {
      const next = [...current];
      const from = next.indexOf(draggedId);
      const to = next.indexOf(targetId);
      if (from < 0 || to < 0) return current;
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      return next;
    });
    setDirtySections((current) => new Set([...current, draggedId, targetId]));
  }

  function updateField(key: keyof CmsWorkspaceSection["fields"], value: string) {
    if (!activeSection) return;
    setSectionDrafts((current) => ({
      ...current,
      [activeSection.id]: {
        ...(current[activeSection.id] ?? activeSection.fields),
        [key]: value
      }
    }));
    setDirtySections((current) => new Set([...current, activeSection.id]));
    setRecentSections((current) => [activeSection.id, ...current.filter((id) => id !== activeSection.id)].slice(0, 4));
  }

  function markSubmitted() {
    if (!activeSection) return;
    setDirtySections((current) => {
      const next = new Set(current);
      next.delete(activeSection.id);
      return next;
    });
  }

  function renderEditor(section: CmsWorkspaceSection) {
    const fields = section.fields;
    if (section.kind === "hero") {
      return (
        <form action={saveHeroBannerDraftFormAction} onSubmit={markSubmitted} data-cms-table="hero_banners" className="grid gap-3">
          <HiddenBase section={section} />
          <input type="hidden" name="product_slug" value={fields.productSlug} />
          <input type="hidden" name="poster_src" value={fields.posterSrc} />
          <input type="hidden" name="poster_alt" value={fields.posterAlt} />
          <input type="hidden" name="video_src" value={fields.videoSrc} />
          <input type="hidden" name="video_alt" value={fields.videoAlt} />
          <input type="hidden" name="theme" value={fields.theme || "light"} />
          <input type="hidden" name="composition_mode" value={fields.compositionMode || "full-bleed"} />
          <input type="hidden" name="composition_text_tone" value={fields.compositionTextTone || "dark"} />
          <input type="hidden" name="composition_media_position" value={fields.compositionMediaPosition || "center"} />
          <input type="hidden" name="composition_mobile_media_position" value={fields.compositionMobileMediaPosition || "center"} />
          <input type="hidden" name="composition_product_dominance" value={fields.compositionProductDominance || "flagship"} />
          <input type="hidden" name="starts_at" value={fields.startsAt} />
          <input type="hidden" name="ends_at" value={fields.endsAt} />
          <Field label="Title" name="title" value={fields.title} onChange={(value) => updateField("title", value)} />
          <Field label="Subtitle" name="subtitle" value={fields.subtitle} onChange={(value) => updateField("subtitle", value)} multiline />
          <div className="grid gap-3 rounded-xl border border-slate-800 bg-[#10151d] p-3">
            <p className="text-xs font-semibold text-slate-300">Text colour</p>
            <p className="-mt-1 text-[11px] leading-4 text-slate-500">
              Overrides the banner&apos;s theme colour. Leave empty to inherit the default light/dark palette.
            </p>
            <ColorField
              label="Title colour"
              name="title_color"
              value={fields.titleColor}
              onChange={(value) => updateField("titleColor", value)}
              hint="Sets the heading text colour for this banner."
            />
            <ColorField
              label="Subtitle colour"
              name="subtitle_color"
              value={fields.subtitleColor}
              onChange={(value) => updateField("subtitleColor", value)}
              hint="Sets the subtitle/body text colour for this banner."
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Button text" name="cta_label" value={fields.ctaLabel} onChange={(value) => updateField("ctaLabel", value)} />
            <Field label="Button destination" name="href" value={fields.href} onChange={(value) => updateField("href", value)} />
          </div>
          <MediaPicker section={section} media={media} onChange={updateField} />
          <OperationalSubmitButton className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
            <Save className="h-4 w-4" aria-hidden="true" />
            Save Draft
          </OperationalSubmitButton>
        </form>
      );
    }

    if (section.kind === "footer") {
      return (
        <div className="grid gap-3">
          <form action={saveFooterColumnDraftFormAction} onSubmit={markSubmitted} data-cms-table="footer_columns" className="grid gap-3 rounded-xl border border-slate-800 bg-[#10151d] p-3">
            <input type="hidden" name="id" value={fields.footerColumnId} />
            <input type="hidden" name="sort_order" value={section.sortOrder} />
            <input type="hidden" name="change_summary" value="Visual footer column edit" />
            <VisibilityToggle section={section} />
            <Field label="Footer group" name="title" value={fields.footerColumnTitle} onChange={(value) => updateField("footerColumnTitle", value)} />
            <OperationalSubmitButton className="inline-flex h-9 w-fit items-center rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-xs font-semibold text-white">Save group</OperationalSubmitButton>
          </form>
          <form action={saveFooterLinkDraftFormAction} onSubmit={markSubmitted} data-cms-table="footer_links" className="grid gap-3 rounded-xl border border-slate-800 bg-[#10151d] p-3">
            <input type="hidden" name="id" value={fields.footerLinkId} />
            <input type="hidden" name="column_id" value={fields.footerColumnId} />
            <input type="hidden" name="sort_order" value="1" />
            <input type="hidden" name="change_summary" value="Visual footer link edit" />
            <VisibilityToggle section={section} />
            <Field label="Link label" name="label" value={fields.footerLinkLabel} onChange={(value) => updateField("footerLinkLabel", value)} />
            <Field label="Link destination" name="href" value={fields.footerLinkHref} onChange={(value) => updateField("footerLinkHref", value)} />
            <OperationalSubmitButton className="inline-flex h-9 w-fit items-center rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-xs font-semibold text-white">Save link</OperationalSubmitButton>
          </form>
        </div>
      );
    }

    if (section.kind === "navigation") {
      return (
        <form action={saveSiteNavigationDraftFormAction} onSubmit={markSubmitted} data-cms-table="site_navigation" className="grid gap-3">
          <HiddenBase section={section} />
          <input type="hidden" name="placement" value={fields.navPlacement || "primary"} />
          <input type="hidden" name="parent_id" value="" />
          <input type="hidden" name="required_role" value="" />
          <Field label="Menu label" name="label" value={fields.label} onChange={(value) => updateField("label", value)} />
          <Field label="Link destination" name="href" value={fields.href} onChange={(value) => updateField("href", value)} />
          <OperationalSubmitButton className="inline-flex h-10 w-fit items-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white">Save Draft</OperationalSubmitButton>
        </form>
      );
    }

    if (section.kind === "product_review") {
      return (
        <form action={saveProductReviewDraftFormAction} onSubmit={markSubmitted} data-cms-table="product_reviews" className="grid gap-3">
          <HiddenBase section={section} />
          <Field label="Reviewer name" name="reviewer_name" value={fields.title} onChange={(value) => updateField("title", value)} />
          <Field label="Product slug" name="product_slug" value={fields.productSlug} onChange={(value) => updateField("productSlug", value)} />
          <Field label="Review" name="body" value={fields.body} onChange={(value) => updateField("body", value)} multiline />
          <Field label="Rating" name="rating" value={fields.rating} onChange={(value) => updateField("rating", value)} />
          <OperationalSubmitButton className="inline-flex h-10 w-fit items-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white">Save Draft</OperationalSubmitButton>
        </form>
      );
    }

    if (section.kind === "category") {
      return (
        <form action={saveCategoryMetadataDraftFormAction} onSubmit={markSubmitted} data-cms-table="category_metadata" className="grid gap-3">
          <input type="hidden" name="route_key" value={fields.routeKey} />
          <input type="hidden" name="sort_order" value={section.sortOrder} />
          <input type="hidden" name="hero_image" value={fields.imageSrc} />
          <input type="hidden" name="showcase_image" value={showcaseImageValue(fields)} />
          <input type="hidden" name="ecosystem_payload" value={fields.ecosystemPayloadJson || "{}"} />
          <input type="hidden" name="change_summary" value={`Visual edit ${section.title}`} />
          <VisibilityToggle section={section} />
          <EditorGroup title="Content" description={`Category route: ${section.routePath}`}>
            <Field label="Category title" name="title" value={fields.title} onChange={(value) => updateField("title", value)} />
            <Field label="Category subtitle" name="subtitle" value={fields.subtitle} onChange={(value) => updateField("subtitle", value)} multiline />
            <Field label="Personality" name="personality" value={fields.personality} onChange={(value) => updateField("personality", value)} />
            <Field label="Featured product slugs" name="featured_product_slugs" value={fields.featuredProductSlugs} onChange={(value) => updateField("featuredProductSlugs", value)} multiline />
          </EditorGroup>
          <EditorGroup title="Media" description="Hero image controls the category banner; showcase image controls the route feature image.">
            <MediaPicker section={section} media={media} onChange={updateField} />
            <Field label="Showcase image URL" name="showcase_image_src_visual" value={fields.showcaseImageSrc} onChange={(value) => updateField("showcaseImageSrc", value)} />
            <Field label="Showcase image description" name="showcase_image_alt_visual" value={fields.showcaseImageAlt} onChange={(value) => updateField("showcaseImageAlt", value)} />
          </EditorGroup>
          <OperationalSubmitButton className="inline-flex h-10 w-fit items-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white">Save Draft</OperationalSubmitButton>
        </form>
      );
    }

    return (
      <div className="rounded-xl border border-slate-800 bg-[#10151d] px-4 py-4 text-sm text-slate-400">
        <p className="font-semibold text-slate-200">Editor not available</p>
        <p className="mt-2 text-xs leading-5 text-slate-500">
          This section type is not editable in Advanced CMS. Use the Homepage editor or product admin tools instead.
        </p>
      </div>
    );
  }

  if (!activePage) {
    return <div data-cms-visual-editor className="rounded-xl border border-slate-800 bg-[#10151d] p-4 text-sm text-slate-400">No CMS sections available.</div>;
  }

  return (
    <section data-cms-visual-editor data-cms-lazy-editor className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
      <aside data-cms-page-sidebar data-cms-site-structure className="sticky top-20 self-start rounded-xl border border-slate-800 bg-[#10151d] p-3 shadow-none">
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0b1017] px-3 py-2">
          <Search className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search sections"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
          />
        </div>

        <nav className="mt-3 grid gap-1">
          {workspacePages.map((page) => (
            <button
              key={page.id}
              id={page.anchor}
              type="button"
              data-cms-page-nav-item
              data-cms-page-anchor={page.anchor}
              data-cms-route-path={page.routePath}
              aria-current={page.id === activePage.id ? "page" : undefined}
              onClick={() => activatePage(page)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-semibold transition ${page.id === activePage.id ? "bg-slate-100 text-slate-950" : "text-slate-300 hover:bg-[#151c26] hover:text-slate-100"}`}
            >
              <span className="block">{page.label}</span>
              <span className={`mt-0.5 block truncate text-[10px] font-medium ${page.id === activePage.id ? "text-slate-700" : "text-slate-500"}`}>{page.routePath}</span>
            </button>
          ))}
        </nav>

        <div data-cms-section-tree className="mt-4 border-t border-slate-800 pt-3">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Sections</p>
          <div className="mt-2 grid max-h-[46vh] gap-2 overflow-y-auto pr-1">
            {filteredSections.length ? filteredSections.map((section) => (
              <SectionCard
                key={section.id}
                section={section}
                isActive={section.id === activeSection?.id}
                onSelect={() => activateSection(section.id)}
                onReorder={reorderSection}
              />
            )) : (
              <p className="rounded-lg border border-slate-800 bg-[#0b1017] px-3 py-3 text-xs leading-5 text-slate-500">No editable sections for this page yet.</p>
            )}
          </div>
        </div>

        <div data-cms-recently-edited className="mt-4 border-t border-slate-800 pt-3">
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Recently edited</p>
          <div className="mt-2 grid gap-1">
            {recentSections.length ? recentSections.map((id) => (
              <button key={id} type="button" onClick={() => activateSection(id)} className="truncate rounded-lg px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-[#151c26]">
                {sectionById.get(id)?.title ?? id}
              </button>
            )) : (
              <p className="px-3 py-2 text-xs text-slate-600">No edits yet</p>
            )}
          </div>
        </div>
      </aside>

      <div data-cms-preview-canvas className="grid gap-3">
        <div data-cms-breadcrumbs className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>CMS</span>
          <span>/</span>
          <span className="text-slate-300">{activePage.label}</span>
          <span>/</span>
          <span className="text-slate-100">{activeSection?.title ?? "Select a section"}</span>
          {activeSection ? <span className="text-slate-600">{activeSection.routePath}</span> : null}
          {isSwitching ? <span className="text-amber-300">Switching...</span> : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#10151d] p-2">
          <div className="flex flex-wrap gap-1">
            {viewportOptions.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setViewport(id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold ${viewport === id ? "bg-slate-100 text-slate-950" : "text-slate-400 hover:bg-[#151c26] hover:text-slate-100"}`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <div data-cms-autosave-indicator className="text-xs text-slate-500">
            {activeSection && dirtySections.has(activeSection.id) ? "Unsaved local edits" : "No local edits"}
          </div>
        </div>

        <div data-cms-desktop-preview={viewport === "desktop" ? "active" : undefined} data-cms-tablet-preview={viewport === "tablet" ? "active" : undefined} data-cms-mobile-preview={viewport === "mobile" ? "active" : undefined}>
          {previewSection ? (
            <SectionPreview section={previewSection} viewport={viewport} />
          ) : (
            <div className="grid min-h-[340px] place-items-center rounded-xl border border-slate-800 bg-[#0b1017] p-6 text-center">
              <div>
                <p className="text-sm font-semibold text-slate-100">No editable sections for this page yet.</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">This site area has no CMS rows available in the current Supabase snapshot.</p>
              </div>
            </div>
          )}
        </div>

        <form action={saveCmsMediaUploadFormAction} data-cms-upload-image className="grid gap-3 rounded-xl border border-slate-800 bg-[#10151d] p-4">
          <input type="hidden" name="bucket" value="mithron-products" />
          <input type="hidden" name="folder" value="cms/editor" />
          <input type="hidden" name="tags" value="cms,visual-editor" />
          <input type="hidden" name="visibility" value="public" />
          <input type="hidden" name="usage_scope" value="cms-visual-editor" />
          <input type="hidden" name="caption" value="CMS visual editor upload" />
          <label data-cms-drag-drop-upload className="grid min-h-28 cursor-pointer place-items-center rounded-xl border border-dashed border-slate-700 bg-[#0b1017] px-4 py-6 text-center text-sm text-slate-400 hover:border-slate-500">
            <ImagePlus className="mb-2 h-5 w-5" aria-hidden="true" />
            Drop image here or choose a file
            <input name="files" type="file" accept="image/*" className="sr-only" />
          </label>
          <input name="alt_text" placeholder="Image description" className={inputClass()} />
          <OperationalSubmitButton pendingLabel="Uploading" className="inline-flex h-9 w-fit items-center rounded-lg border border-emerald-600 bg-emerald-600 px-4 text-sm font-semibold text-white">Upload image</OperationalSubmitButton>
        </form>

        <div data-cms-unsaved-warning className="rounded-xl border border-amber-500/20 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          {dirtySections.size ? `${dirtySections.size} section(s) have local preview changes. Save before leaving.` : "No unsaved visual edits."}
        </div>

        <details data-content-revision-timeline data-cms-section-history className="rounded-xl border border-slate-800 bg-[#10151d] px-4 py-3 text-sm text-slate-400">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-100">
            <History className="h-4 w-4" aria-hidden="true" />
            Section history
          </summary>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {restoreRevision ? `Restore point available: ${restoreRevision.label}` : "No restore point is available yet."}
          </p>
        </details>
      </div>

      <aside data-cms-editor-panel data-cms-section-controls className="sticky top-20 grid max-h-[calc(100vh-6rem)] gap-3 self-start overflow-y-auto rounded-xl border border-slate-800 bg-[#0f141b] p-4 shadow-none">
        {activeSection ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{activePage.label}</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-100">{activeSection.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">{activeSection.description}</p>
                <p className="mt-1 text-xs text-slate-600">{activePage.description}</p>
                <p className="mt-2 text-xs text-slate-500">Draft / Published</p>
              </div>
              <StatusBadge status={activeSection.status} />
            </div>
            {renderEditor(activeSection)}

            <div data-cms-sticky-action-bar data-cms-optimistic-save className="sticky bottom-0 z-30 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-slate-800 bg-[#0b1017] p-3 shadow-none">
          {!isDeprecatedCmsStorefrontTable(activeSection.table) ? (
            <>
          <button type="button" onClick={() => document.querySelector<HTMLFormElement>("[data-cms-section-controls] form")?.requestSubmit()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#151c26] px-3 text-xs font-semibold text-slate-100 hover:border-slate-600">
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            Save Draft
          </button>
          <Link href={activeSection.previewHref || activePage.previewHref} target="_blank" className="inline-flex h-9 items-center rounded-lg border border-slate-700 bg-[#151c26] px-3 text-xs font-semibold text-slate-100 hover:border-slate-600">
            Preview
          </Link>
          <form action={publishCmsWorkspaceRecordFormAction} data-cms-publish-confirmation>
            <PublishRecordFields section={activeSection} />
            <OperationalSubmitButton pendingLabel="Publishing" confirmMessage={`Publish ${activeSection.title} to the live website?`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700">
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Publish
            </OperationalSubmitButton>
          </form>
          <form action={archiveCmsWorkspaceRecordFormAction}>
            <input type="hidden" name="entity_table" value={activeSection.table} />
            <input type="hidden" name="entity_id" value={activeSection.stateEntityId ?? activeSection.entityId} />
            <PublishRequestField operation="archive" entityId={activeSection.stateEntityId ?? activeSection.entityId} />
            <input type="hidden" name="change_summary" value={`Unpublish ${activeSection.title}`} />
            {activeSection.relatedPublishTargets?.map((target, index) => (
              <div key={`${target.table}-${target.entityId}-${index}`}>
                <input type="hidden" name="related_archive_table" value={target.table} />
                <input type="hidden" name="related_archive_entity_id" value={target.entityId} />
                <input type="hidden" name="related_archive_change_summary" value={target.changeSummary?.replace(/^Publish/, "Unpublish") ?? `Unpublish ${activeSection.title}`} />
              </div>
            ))}
            <OperationalSubmitButton pendingLabel="Unpublishing" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#151c26] px-3 text-xs font-semibold text-slate-100 hover:border-slate-600">
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              Unpublish
            </OperationalSubmitButton>
          </form>
          {restoreRevision ? (
            <form action={restoreContentRevisionAction}>
              <input type="hidden" name="entity_table" value={restoreRevision.table} />
              <input type="hidden" name="entity_id" value={restoreRevision.entityId} />
              <input type="hidden" name="revision" value={restoreRevision.revision} />
              <PublishRequestField operation="restore" entityId={restoreRevision.entityId} />
              <input type="hidden" name="snapshot" value={restoreRevision.snapshotJson} />
              <input type="hidden" name="change_summary" value={`Restore ${restoreRevision.label}`} />
              <OperationalSubmitButton pendingLabel="Restoring" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-[#151c26] px-3 text-xs font-semibold text-slate-100 hover:border-slate-600">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Restore
              </OperationalSubmitButton>
            </form>
          ) : (
            <button disabled className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-800 bg-[#10151d] px-3 text-xs font-semibold text-slate-600">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restore
            </button>
          )}
            </>
          ) : (
            <p className="text-xs text-rose-100/80" data-cms-deprecated-actions-notice>
              This table is deprecated — draft, publish, and restore actions are disabled. Use the Homepage editor or active CMS tables instead.
            </p>
          )}
        </div>
          </>
        ) : (
          <div className="grid min-h-48 place-items-center text-center">
            <div>
              <p className="text-sm font-semibold text-slate-100">Select a website section</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">Use the site structure panel to edit live CMS content visually.</p>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}

function MediaPicker({
  section,
  media,
  onChange
}: {
  section: CmsWorkspaceSection;
  media: CmsWorkspaceMedia[];
  onChange: (key: keyof CmsWorkspaceSection["fields"], value: string) => void;
}) {
  const selectedMedia = media.find((item) => item.src === section.fields.imageSrc);
  const previewSrc = selectedMedia?.src ?? section.fields.imageSrc;

  return (
    <div data-cms-media-picker className="grid gap-3 rounded-xl border border-slate-800 bg-[#10151d] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">Section image</p>
          <p className="mt-1 text-xs text-slate-500">Replace image from uploaded media.</p>
        </div>
        <StatusBadge status={section.fields.imageSrc ? "ready" : "empty"} />
      </div>
      <div className="grid gap-2 sm:grid-cols-[96px_minmax(0,1fr)]">
        <div data-cms-media-preview className="relative h-24 overflow-hidden rounded-lg border border-slate-800 bg-[#0b1017]">
          {previewSrc ? (
            <Image src={previewSrc} alt={section.fields.imageAlt || selectedMedia?.alt || section.title} fill sizes="96px" loading="lazy" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center">
              <ImageIcon className="h-5 w-5 text-slate-500" aria-hidden="true" />
            </div>
          )}
        </div>
        <div className="grid content-center gap-2 rounded-lg border border-slate-800 bg-[#0b1017] px-3 py-2 text-xs text-slate-500">
          <p data-cms-media-dimensions>
            <span className="font-semibold text-slate-300">Dimensions:</span> {mediaDimensions(selectedMedia)}
          </p>
          <p data-cms-media-usage>
            <span className="font-semibold text-slate-300">Used in:</span> {selectedMedia?.usage || section.title}
          </p>
          <button type="button" data-cms-crop-image aria-disabled="true" className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg border border-slate-800 bg-white/[0.03] px-2 text-[11px] font-semibold text-slate-400">
            <Crop className="h-3.5 w-3.5" aria-hidden="true" />
            Crop image
          </button>
        </div>
      </div>
      <label className="grid gap-1.5 text-xs font-medium text-slate-400">
        Select from media library
        <select
          name="image_src"
          value={section.fields.imageSrc}
          onChange={(event) => onChange("imageSrc", event.currentTarget.value)}
          className={inputClass()}
        >
          {section.fields.imageSrc ? <option value={section.fields.imageSrc}>Current image</option> : <option value="">Choose image</option>}
          {media.map((item) => (
            <option key={item.id} value={item.src}>{item.label}</option>
          ))}
        </select>
      </label>
      <Field label="Image description" name="image_alt" value={section.fields.imageAlt} onChange={(value) => onChange("imageAlt", value)} />
    </div>
  );
}
