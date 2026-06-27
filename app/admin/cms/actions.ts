"use server";

import sharp from "sharp";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { assertWritableCmsTable } from "@/lib/cms/deprecated-tables";
import { assertOptionalCmsMediaSrc, assertValidCmsMediaSrc } from "@/lib/cms/media-validation";
import type { HomepageCmsContent, HomepageCmsSectionId, HomepageMissionCms, HomepageShelfCms } from "@/config/homepage-cms";
import { footerContent } from "@/config/storefront-content";
import { mergeHomepageCmsContent } from "@/services/homepage-cms";
import { upsertMediaAssetRecord } from "@/services/admin-actions";
import {
  buildCategoryMetadataDraftFromFormData,
  buildContentRevisionRecordFromFormData,
  buildContentRevisionRestoreFromFormData,
  buildCmsPageDraftFromFormData,
  buildCmsSectionDraftFromFormData,
  buildFaqDraftFromFormData,
  buildFooterColumnDraftFromFormData,
  buildFooterLinkDraftFromFormData,
  buildHeroBannerDraftFromFormData,
  buildHeroBannerStateFromFormData,
  buildHomepageOrderingDraftFromFormData,
  buildSectionVisibilityDraftFromFormData,
  buildPromotionalCampaignDraftFromFormData,
  buildProductReviewDraftFromFormData,
  buildSiteNavigationDraftFromFormData
} from "@/services/cms-admin-forms";
import {
  archiveCmsWorkflowRecord,
  archiveHeroBannerWorkflow,
  publishCmsWorkflowRecord,
  publishHeroBannerWorkflow,
  saveCmsWorkflowDraft,
  saveHeroBannerDraftWorkflow,
  type CmsWorkflowDraftInput,
  type CmsWorkflowStateInput,
  type HeroBannerDraftInput,
  type HeroBannerStateInput
} from "@/services/cms-admin-workflows";
import { recordCmsRevision, restoreCmsRevision } from "@/services/cms-crud";
import { getCurrentAuthContext, requireAdminPermission, requirePermission } from "@/services/auth";
import {
  assertCmsPublishPolicyAllowed,
  assertSectionVisibilityPolicyAllowed,
  getAdminSettingsPolicy
} from "@/services/admin-settings-policy";
import {
  assertAllowedMediaBucket,
  assertAllowedMediaMimeType,
  assertMediaUploadSize,
  buildMediaAssetId,
  buildMediaAssetRecordFromFormData,
  buildStorageObjectPath
} from "@/services/media-manager";
import {
  buildOptimizedVariantStoragePath,
  buildResponsiveVariantsMetadata,
  buildSupabasePublicObjectUrl,
  createOptimizedImageVariants,
  findStoredOptimizedVariant,
  findLargestStoredAvifVariant,
  selectPrimaryOptimizedVariant,
  type StoredOptimizedImageVariant
} from "@/services/media-optimization";

type HeroBannerDraftActionInput = Omit<HeroBannerDraftInput, "actorId">;
type HeroBannerStateActionInput = Omit<HeroBannerStateInput, "actorId">;
type CmsWorkflowDraftActionInput = Omit<CmsWorkflowDraftInput, "actorId">;
type CmsWorkflowStateActionInput = Omit<CmsWorkflowStateInput, "actorId">;

async function currentActorId() {
  const context = await getCurrentAuthContext();
  return context.userId;
}

function encodeObjectPath(path: string) {
  return path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function isUploadFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

function readText(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function readImageMetadata(buffer: Buffer, mimeType: string) {
  if (!mimeType.startsWith("image/")) {
    return { width: null as number | null, height: null as number | null };
  }

  try {
    const metadata = await sharp(buffer, { failOn: "none" }).metadata();
    return {
      width: typeof metadata.width === "number" ? metadata.width : null,
      height: typeof metadata.height === "number" ? metadata.height : null
    };
  } catch {
    return { width: null as number | null, height: null as number | null };
  }
}

async function uploadCmsStorageObject(bucket: string, storagePath: string, contentType: string, buffer: Buffer) {
  const config = assertSupabaseAdminConfig();
  const uploadBody = new Uint8Array(buffer.byteLength);
  uploadBody.set(buffer);

  const response = await fetch(`${config.url}/storage/v1/object/${bucket}/${encodeObjectPath(storagePath)}`, {
    method: "POST",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "x-upsert": "false"
    },
    body: uploadBody
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`CMS image upload failed for ${bucket}/${storagePath}: ${response.status} ${response.statusText} ${text}`);
  }

  return buildSupabasePublicObjectUrl(config.url, bucket, storagePath);
}

async function uploadCmsOptimizedVariants(bucket: string, storagePath: string, buffer: Buffer, mimeType: string) {
  const config = assertSupabaseAdminConfig();
  const variants = await createOptimizedImageVariants(buffer, mimeType);
  const storedVariants: StoredOptimizedImageVariant[] = [];

  for (const variant of variants) {
    const variantStoragePath = buildOptimizedVariantStoragePath(storagePath, variant);
    await uploadCmsStorageObject(bucket, variantStoragePath, variant.mimeType, variant.buffer);
    storedVariants.push({
      ...variant,
      storagePath: variantStoragePath,
      publicUrl: buildSupabasePublicObjectUrl(config.url, bucket, variantStoragePath)
    });
  }

  return storedVariants;
}

function buildCmsMediaRecordFormData(formData: FormData, overrides: Record<string, string>) {
  const recordForm = new FormData();
  for (const key of [
    "folder",
    "tags",
    "alt_text",
    "caption",
    "visibility",
    "usage_scope",
    "avif_path",
    "webp_path",
    "thumbnail_path",
    "responsive_variants",
    "upload_metadata",
    "content_hash"
  ]) {
    const value = formData.get(key);
    if (typeof value === "string") recordForm.set(key, value);
  }

  for (const [key, value] of Object.entries(overrides)) {
    recordForm.set(key, value);
  }

  return recordForm;
}

function revalidateCmsCutoverPaths(table?: string) {
  revalidateTag("cms", "max");
  revalidateTag("cms-public", "max");
  revalidateTag("homepage-cms", "max");
  revalidateTag("admin-settings", "max");
  revalidateTag("cms-footer-lead", "max");
  if (table) revalidateTag(`cms-${table}`, "max");
  revalidatePath("/admin/cms");
  revalidatePath("/", "layout");
  revalidatePath("/", "page");
  revalidatePath("/products");
  revalidatePath("/agriculture");
  revalidatePath("/video-drones");
  revalidatePath("/creative-drones");
  revalidatePath("/mapping");
  revalidatePath("/surveillance");
  revalidatePath("/accessories");
  revalidatePath("/industrial");
  revalidatePath("/product/[slug]", "page");
}

function cmsActionMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message.slice(0, 360);
  return "CMS mutation failed. Check the submitted fields and retry.";
}

function cmsRedirectUrl(status: "success" | "error", table: string, message: string, section?: string) {
  const params = new URLSearchParams({
    cms_status: status,
    cms_table: table,
    cms_message: message
  });
  if (section) params.set("section", section);
  return `/admin/cms?${params.toString()}#cms-status`;
}

async function runCmsFormMutation(table: string, successMessage: string, mutation: () => Promise<unknown>, section?: string) {
  if (table === "media_assets") {
    await requireAdminPermission("media.write");
  } else {
    await requirePermission("cms.write");
  }
  let status: "success" | "error" = "success";
  let message = successMessage;
  try {
    await mutation();
    revalidateCmsCutoverPaths(table);
    revalidateTag("homepage-cms", "max");
    revalidateTag("admin-settings", "max");
  } catch (error) {
    status = "error";
    message = cmsActionMessage(error);
  }

  redirect(cmsRedirectUrl(status, table, message, section));
}

type JsonRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function adminSettingsClient() {
  const config = assertSupabaseAdminConfig();
  return createClient(config.url, config.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

async function loadAdminSettingsPayload(): Promise<JsonRecord> {
  const supabase = adminSettingsClient();
  const { data, error } = await supabase.from("admin_settings").select("payload").eq("id", "global").maybeSingle();
  if (error) throw new Error(`Failed to load admin settings: ${error.message}`);
  const payload = data?.payload;
  return isPlainRecord(payload) ? payload : {};
}

async function saveHomepageSettingsContent(
  section: HomepageCmsSectionId,
  updater: (current: HomepageCmsContent) => HomepageCmsContent,
  successMessage: string
) {
  await runCmsFormMutation("homepage_cms", successMessage, async () => {
    const actorId = await currentActorId();
    const current = await loadAdminSettingsPayload();
    const homepageStored = isPlainRecord(current.homepage) ? current.homepage : {};
    const merged = updater(mergeHomepageCmsContent(homepageStored));
    const nextPayload = {
      ...current,
      homepage: merged,
      updated_by: actorId,
      updated_at: new Date().toISOString()
    };

    const supabase = adminSettingsClient();
    const { error } = await supabase.from("admin_settings").upsert(
      { id: "global", payload: nextPayload, updated_by: actorId, updated_at: nextPayload.updated_at },
      { onConflict: "id" }
    );
    if (error) throw new Error(`Failed to save homepage content: ${error.message}`);
  }, section);
}

export async function saveHomepageShelfFormAction(formData: FormData) {
  const shelfKey = readText(formData, "shelf_key", "droneWorld") as keyof HomepageCmsContent["shelves"];
  const sectionMap: Record<keyof HomepageCmsContent["shelves"], HomepageCmsSectionId> = {
    droneWorld: "shelf-drone-world",
    droneCare: "shelf-drone-care",
    globalProducts: "shelf-global-products"
  };
  const section = sectionMap[shelfKey] ?? "shelf-drone-world";
  const patch: Partial<HomepageShelfCms> = {
    eyebrow: readText(formData, "eyebrow"),
    title: readText(formData, "title"),
    href: readText(formData, "href"),
    viewAllLabel: readText(formData, "view_all_label"),
    guideLabel: readText(formData, "guide_label"),
    guideTitle: readText(formData, "guide_title"),
    guideHref: readText(formData, "guide_href"),
    heroEyebrow: readText(formData, "hero_eyebrow"),
    heroSubtitle: readText(formData, "hero_subtitle"),
    heroBody: readText(formData, "hero_body"),
    featureCta: readText(formData, "feature_cta"),
    heroCtaHref: readText(formData, "hero_cta_href"),
    heroImageSrc: assertOptionalCmsMediaSrc(readText(formData, "hero_image_src"), "Shelf hero image"),
    heroImageAlt: readText(formData, "hero_image_alt")
  };
  await saveHomepageSettingsContent(
    section,
    (current) => ({
      ...current,
      shelves: {
        ...current.shelves,
        [shelfKey]: { ...current.shelves[shelfKey], ...patch }
      }
    }),
    `${patch.title || "Shelf"} updated on the live homepage.`
  );
}

export async function saveHomepageMissionFormAction(formData: FormData) {
  const missionKey = readText(formData, "mission_key", "agri") as keyof HomepageCmsContent["missions"];
  const section = missionKey === "city" ? "mission-city" : "mission-agri";
  const tileCount = Number(readText(formData, "tile_count", "5"));
  const tiles = Array.from({ length: tileCount }, (_, index) => ({
    label: readText(formData, `tile_${index}_label`),
    body: readText(formData, `tile_${index}_body`),
    operator: readText(formData, `tile_${index}_operator`),
    model: readText(formData, `tile_${index}_model`),
    location: readText(formData, `tile_${index}_location`),
    imageSrc: assertOptionalCmsMediaSrc(readText(formData, `tile_${index}_image_src`), `Mission tile ${index + 1} image`),
    imageAlt: readText(formData, `tile_${index}_image_alt`),
    href: readText(formData, `tile_${index}_href`)
  }));
  const patch: Partial<HomepageMissionCms> = {
    eyebrow: readText(formData, "eyebrow"),
    title: readText(formData, "title"),
    body: readText(formData, "body"),
    href: readText(formData, "href"),
    cta: readText(formData, "cta"),
    mediaNote: readText(formData, "media_note"),
    tiles
  };
  await saveHomepageSettingsContent(
    section,
    (current) => ({
      ...current,
      missions: {
        ...current.missions,
        [missionKey]: {
          ...current.missions[missionKey],
          ...patch,
          tiles: current.missions[missionKey].tiles.map((tile, index) => ({
            ...tile,
            ...(tiles[index] ?? {})
          }))
        }
      }
    }),
    `${patch.title || "Mission section"} updated on the live homepage.`
  );
}

export async function saveHomepageTestimonialsHeaderFormAction(formData: FormData) {
  const patch = {
    eyebrow: readText(formData, "eyebrow"),
    title: readText(formData, "title"),
    lead: readText(formData, "lead"),
    linkLabel: readText(formData, "link_label"),
    linkHref: readText(formData, "link_href")
  };
  await saveHomepageSettingsContent(
    "testimonials",
    (current) => ({
      ...current,
      testimonials: { ...current.testimonials, ...patch }
    }),
    "Reviews header updated on the live homepage."
  );
}

export async function saveHomepageAboutFormAction(formData: FormData) {
  const patch = {
    eyebrow: readText(formData, "eyebrow"),
    title: readText(formData, "title"),
    body: readText(formData, "body"),
    primaryLabel: readText(formData, "primary_label"),
    primaryHref: readText(formData, "primary_href"),
    secondaryLabel: readText(formData, "secondary_label"),
    secondaryHref: readText(formData, "secondary_href")
  };
  await saveHomepageSettingsContent(
    "about",
    (current) => ({
      ...current,
      about: { ...current.about, ...patch }
    }),
    "About band updated on the live homepage."
  );
}

export async function saveHomepageFooterLeadFormAction(formData: FormData) {
  await runCmsFormMutation("footer", "Footer lead copy updated on the live homepage.", async () => {
    const actorId = await currentActorId();
    const current = await loadAdminSettingsPayload();
    const footer = {
      leadTitle: readText(formData, "footer_lead_title", footerContent.leadTitle),
      leadBody: readText(formData, "footer_lead_body"),
      contactEmail: readText(formData, "footer_contact_email", footerContent.contactEmail ?? ""),
      contactPhone: readText(formData, "footer_contact_phone", footerContent.contactPhone ?? ""),
      legalText: readText(formData, "footer_legal_text")
    };
    const nextPayload = {
      ...current,
      footer,
      updated_by: actorId,
      updated_at: new Date().toISOString()
    };
    const supabase = adminSettingsClient();
    const { error } = await supabase.from("admin_settings").upsert(
      { id: "global", payload: nextPayload, updated_by: actorId, updated_at: nextPayload.updated_at },
      { onConflict: "id" }
    );
    if (error) throw new Error(`Failed to save footer lead: ${error.message}`);
  }, "footer");
}

export async function saveHeroBannerDraftAction(input: HeroBannerDraftActionInput) {
  await requirePermission("cms.write");
  const record = await saveHeroBannerDraftWorkflow({
    ...input,
    actorId: await currentActorId()
  });
  revalidateCmsCutoverPaths("hero_banners");
  return record;
}

export async function publishHeroBannerAction(input: HeroBannerStateActionInput) {
  await requirePermission("cms.write");
  const record = await publishHeroBannerWorkflow({
    ...input,
    actorId: await currentActorId()
  });
  revalidateCmsCutoverPaths("hero_banners");
  return record;
}

export async function archiveHeroBannerAction(input: HeroBannerStateActionInput) {
  await requirePermission("cms.write");
  const record = await archiveHeroBannerWorkflow({
    ...input,
    actorId: await currentActorId()
  });
  revalidateCmsCutoverPaths("hero_banners");
  return record;
}

export async function saveCmsWorkflowDraftAction(input: CmsWorkflowDraftActionInput) {
  await requirePermission("cms.write");
  const record = await saveCmsWorkflowDraft({
    ...input,
    actorId: await currentActorId()
  });
  revalidateCmsCutoverPaths(input.table);
  return record;
}

export async function publishCmsWorkflowRecordAction(input: CmsWorkflowStateActionInput) {
  await requirePermission("cms.write");
  const record = await publishCmsWorkflowRecord({
    ...input,
    actorId: await currentActorId()
  });
  revalidateCmsCutoverPaths(input.table);
  return record;
}

export async function archiveCmsWorkflowRecordAction(input: CmsWorkflowStateActionInput) {
  await requirePermission("cms.write");
  const record = await archiveCmsWorkflowRecord({
    ...input,
    actorId: await currentActorId()
  });
  revalidateCmsCutoverPaths(input.table);
  return record;
}

export async function saveSectionVisibilityDraftFormAction(formData: FormData) {
  const policy = await getAdminSettingsPolicy();
  assertSectionVisibilityPolicyAllowed(policy);
  const draftInput = buildSectionVisibilityDraftFromFormData(formData);
  await runCmsFormMutation("section_visibility", "Section visibility draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function saveHomepageOrderingDraftFormAction(formData: FormData) {
  const draftInput = buildHomepageOrderingDraftFromFormData(formData);
  await runCmsFormMutation("homepage_ordering", "Homepage ordering draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function saveCmsPageDraftFormAction(formData: FormData) {
  const draftInput = buildCmsPageDraftFromFormData(formData);
  await runCmsFormMutation("cms_pages", "CMS page draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function saveCmsSectionDraftFormAction(formData: FormData) {
  const draftInput = buildCmsSectionDraftFromFormData(formData);
  await runCmsFormMutation("cms_sections", "CMS section draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function recordContentRevisionFormAction(formData: FormData) {
  const draftInput = buildContentRevisionRecordFromFormData(formData);
  await runCmsFormMutation("content_revisions", "Content revision recorded.", async () => {
    await recordCmsRevision({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function restoreContentRevisionAction(formData: FormData) {
  const draftInput = buildContentRevisionRestoreFromFormData(formData);
  await runCmsFormMutation(draftInput.table, "Content revision restored.", async () => {
    await restoreCmsRevision({
      ...draftInput,
      actorId: await currentActorId(),
      requestId: readText(formData, "publish_request_id")
    });
  });
}

export async function saveSiteNavigationDraftFormAction(formData: FormData) {
  const draftInput = buildSiteNavigationDraftFromFormData(formData);
  await runCmsFormMutation("site_navigation", "Navigation draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function saveFooterColumnDraftFormAction(formData: FormData) {
  const draftInput = buildFooterColumnDraftFromFormData(formData);
  await runCmsFormMutation("footer_columns", "Footer column draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function saveFooterLinkDraftFormAction(formData: FormData) {
  const draftInput = buildFooterLinkDraftFromFormData(formData);
  await runCmsFormMutation("footer_links", "Footer link draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function saveFaqDraftFormAction(formData: FormData) {
  const draftInput = buildFaqDraftFromFormData(formData);
  await runCmsFormMutation("faqs", "FAQ draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function saveProductReviewDraftFormAction(formData: FormData) {
  const draftInput = buildProductReviewDraftFromFormData(formData);
  await runCmsFormMutation("product_reviews", "Product review draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function savePromotionalCampaignDraftFormAction(formData: FormData) {
  const draftInput = buildPromotionalCampaignDraftFromFormData(formData);
  await runCmsFormMutation("promotional_campaigns", "Promotional campaign draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function saveCmsMediaUploadFormAction(formData: FormData) {
  await runCmsFormMutation("media_assets", "Image uploaded.", async () => {
    const actorId = await currentActorId();
    const bucket = assertAllowedMediaBucket(readText(formData, "bucket", "mithron-products"));
    const uploadedFiles = formData.getAll("files").filter(isUploadFile);
    const now = new Date().toISOString();

    if (!uploadedFiles.length) {
      throw new Error("Choose an image before uploading.");
    }

    for (let index = 0; index < uploadedFiles.length; index += 1) {
      const file = uploadedFiles[index];
      const mimeType = assertAllowedMediaMimeType(file.type || "application/octet-stream", bucket);
      assertMediaUploadSize(file);
      const uploadAt = new Date(Date.parse(now) + index).toISOString();
      const storagePath = buildStorageObjectPath({
        bucket,
        folder: readText(formData, "folder", "cms"),
        fileName: file.name,
        at: uploadAt
      });
      const buffer = Buffer.from(await file.arrayBuffer());
      const sourceDimensions = await readImageMetadata(buffer, mimeType);
      const optimizedVariants = await uploadCmsOptimizedVariants(bucket, storagePath, buffer, mimeType);
      const optimizedPrimary = selectPrimaryOptimizedVariant(optimizedVariants);
      const publicUrl = optimizedPrimary?.publicUrl ?? await uploadCmsStorageObject(bucket, storagePath, mimeType, buffer);
      const storedPath = optimizedPrimary?.storagePath ?? storagePath;
      const storedMimeType = optimizedPrimary?.mimeType ?? mimeType;
      const storedSizeBytes = optimizedPrimary?.sizeBytes ?? buffer.byteLength;
      const storedWidth = optimizedPrimary?.width ?? sourceDimensions.width;
      const storedHeight = optimizedPrimary?.height ?? sourceDimensions.height;
      const thumbnailVariant = findStoredOptimizedVariant(optimizedVariants, "thumbnail", "webp");
      const webpVariant = findStoredOptimizedVariant(optimizedVariants, "large", "webp");
      const avifVariant = findLargestStoredAvifVariant(optimizedVariants);
      const optimizedUploadedBytes = optimizedVariants.reduce((total, variant) => total + variant.sizeBytes, 0) || buffer.byteLength;
      const recordId = buildMediaAssetId(bucket, storedPath);

      const recordForm = buildCmsMediaRecordFormData(formData, {
        id: recordId,
        bucket,
        storage_path: storedPath,
        public_url: publicUrl,
        mime_type: storedMimeType,
        file_size_bytes: String(storedSizeBytes),
        width: storedWidth ? String(storedWidth) : "",
        height: storedHeight ? String(storedHeight) : "",
        thumbnail_path: thumbnailVariant?.storagePath ?? "",
        webp_path: webpVariant?.storagePath ?? "",
        avif_path: avifVariant?.storagePath ?? "",
        responsive_variants: JSON.stringify(buildResponsiveVariantsMetadata(optimizedVariants, {
          width: sourceDimensions.width,
          height: sourceDimensions.height,
          sizeBytes: file.size,
          mimeType,
          uploadedBytes: optimizedUploadedBytes
        })),
        upload_metadata: JSON.stringify({
          original_file_name: file.name,
          original_mime_type: mimeType,
          original_size_bytes: file.size,
          optimized_uploaded_bytes: optimizedUploadedBytes,
          usage_scope: readText(formData, "usage_scope", "cms"),
          source: "admin-cms-editor"
        })
      });

      await upsertMediaAssetRecord(
        buildMediaAssetRecordFromFormData(recordForm, { actorId, at: uploadAt }),
        actorId
      );
    }

    revalidatePath("/admin/cms");
    revalidatePath("/admin/media");
  });
}

export async function saveCategoryMetadataDraftFormAction(formData: FormData) {
  const draftInput = buildCategoryMetadataDraftFromFormData(formData);
  await runCmsFormMutation("category_metadata", "Category metadata draft saved. Publish to update the live website.", async () => {
    await saveCmsWorkflowDraft({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function saveHeroBannerDraftFormAction(formData: FormData) {
  const imageSrc = readText(formData, "image_src");
  if (imageSrc) {
    assertValidCmsMediaSrc(imageSrc, "Hero banner image");
  }
  const draftInput = buildHeroBannerDraftFromFormData(formData);
  await runCmsFormMutation("hero_banners", "Hero banner draft saved. Publish to update the live website.", async () => {
    await saveHeroBannerDraftWorkflow({
      ...draftInput,
      actorId: await currentActorId()
    });
  });
}

export async function publishHeroBannerFormAction(formData: FormData) {
  const policy = await getAdminSettingsPolicy();
  assertCmsPublishPolicyAllowed(policy);
  const stateInput = buildHeroBannerStateFromFormData(formData);
  await runCmsFormMutation("hero_banners", "Hero banner published and live website cache invalidated.", async () => {
    await publishHeroBannerWorkflow({
      ...stateInput,
      actorId: await currentActorId(),
      changeSummary: stateInput.changeSummary ?? `Publish hero banner ${stateInput.id}`
    });
  });
}

export async function archiveHeroBannerFormAction(formData: FormData) {
  const stateInput = buildHeroBannerStateFromFormData(formData);
  await runCmsFormMutation("hero_banners", "Hero banner archived.", async () => {
    await archiveHeroBannerWorkflow({
      ...stateInput,
      actorId: await currentActorId(),
      changeSummary: stateInput.changeSummary ?? `Archive hero banner ${stateInput.id}`
    });
  });
}

export async function publishCmsWorkspaceRecordFormAction(formData: FormData) {
  const policy = await getAdminSettingsPolicy();
  assertCmsPublishPolicyAllowed(policy);
  const table = readText(formData, "entity_table");
  const entityId = readText(formData, "entity_id");
  const requestId = readText(formData, "publish_request_id");
  const changeSummary = readText(formData, "change_summary", `Publish ${entityId}`);
  const relatedTables = formData.getAll("related_publish_table").map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean);
  const relatedEntityIds = formData.getAll("related_publish_entity_id").map((value) => (typeof value === "string" ? value.trim() : ""));
  const relatedChangeSummaries = formData.getAll("related_publish_change_summary").map((value) => (typeof value === "string" ? value.trim() : ""));
  if (!table || !entityId) throw new Error("CMS publish requires a section target.");
  assertWritableCmsTable(table);
  for (const relatedTable of relatedTables) {
    assertWritableCmsTable(relatedTable);
  }

  await runCmsFormMutation(table, "Section published and live website cache invalidated.", async () => {
    const actorId = await currentActorId();
    if (table === "hero_banners") {
      await publishHeroBannerWorkflow({
        id: entityId,
        actorId,
        changeSummary,
        requestId
      });
    } else {
      await publishCmsWorkflowRecord({
        table,
        entityId,
        actorId,
        changeSummary,
        requestId
      });
    }

    for (const [index, relatedTable] of relatedTables.entries()) {
      const relatedEntityId = relatedEntityIds[index] ?? "";
      if (!relatedEntityId) continue;
      const relatedSummary = relatedChangeSummaries[index] || `Publish ${relatedEntityId}`;
      const relatedRequestId = requestId ? `${requestId}:related:${index + 1}` : null;

      if (relatedTable === "hero_banners") {
        await publishHeroBannerWorkflow({
          id: relatedEntityId,
          actorId,
          changeSummary: relatedSummary,
          requestId: relatedRequestId
        });
        continue;
      }

      await publishCmsWorkflowRecord({
        table: relatedTable,
        entityId: relatedEntityId,
        actorId,
        changeSummary: relatedSummary,
        requestId: relatedRequestId
      });
    }
  });
}

export async function archiveCmsWorkspaceRecordFormAction(formData: FormData) {
  const table = readText(formData, "entity_table");
  const entityId = readText(formData, "entity_id");
  const requestId = readText(formData, "publish_request_id");
  const changeSummary = readText(formData, "change_summary", `Unpublish ${entityId}`);
  const relatedTables = formData.getAll("related_archive_table").map((value) => (typeof value === "string" ? value.trim() : "")).filter(Boolean);
  const relatedEntityIds = formData.getAll("related_archive_entity_id").map((value) => (typeof value === "string" ? value.trim() : ""));
  const relatedChangeSummaries = formData.getAll("related_archive_change_summary").map((value) => (typeof value === "string" ? value.trim() : ""));
  if (!table || !entityId) throw new Error("CMS unpublish requires a section target.");

  await runCmsFormMutation(table, "Section unpublished and live website cache invalidated.", async () => {
    const actorId = await currentActorId();
    if (table === "hero_banners") {
      await archiveHeroBannerWorkflow({
        id: entityId,
        actorId,
        changeSummary,
        requestId
      });
    } else {
      await archiveCmsWorkflowRecord({
        table,
        entityId,
        actorId,
        changeSummary,
        requestId
      });
    }

    for (const [index, relatedTable] of relatedTables.entries()) {
      const relatedEntityId = relatedEntityIds[index] ?? "";
      if (!relatedEntityId) continue;
      const relatedSummary = relatedChangeSummaries[index] || `Unpublish ${relatedEntityId}`;
      const relatedRequestId = requestId ? `${requestId}:related:${index + 1}` : null;

      if (relatedTable === "hero_banners") {
        await archiveHeroBannerWorkflow({
          id: relatedEntityId,
          actorId,
          changeSummary: relatedSummary,
          requestId: relatedRequestId
        });
        continue;
      }

      await archiveCmsWorkflowRecord({
        table: relatedTable,
        entityId: relatedEntityId,
        actorId,
        changeSummary: relatedSummary,
        requestId: relatedRequestId
      });
    }
  });
}
