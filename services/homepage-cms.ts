import { cache } from "react";
import {
  defaultHomepageCmsContent,
  emptyHomepageCmsContent,
  type HomepageCmsContent,
  type HomepageMissionCms,
  type HomepageMissionTileCms,
  type HomepageShelfCms
} from "@/config/homepage-cms";
import { sanitizePublicCmsHref } from "@/lib/cms/safe-href";
import { resolveDroneCareStorefrontHref, isDroneCareLegacyCatalogHref, isDroneCareStorefrontAlias } from "@/lib/catalog-categories";
import { getSupabaseAdminConfig } from "@/lib/env";
import { isCmsStrictMode } from "@/lib/cms/strict-mode";

type JsonRecord = Record<string, unknown>;

function homepageCmsFallback() {
  return isCmsStrictMode() ? emptyHomepageCmsContent : defaultHomepageCmsContent;
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function mergeField(stored: string | undefined, fallback: string) {
  if (stored !== undefined) return stored;
  return isCmsStrictMode() ? "" : fallback;
}

function sanitizeCmsHref(value: unknown, fallback: string): string {
  return sanitizePublicCmsHref(value, fallback);
}

function mergeHrefField(stored: string | undefined, fallback: string) {
  const merged = mergeField(stored, fallback);
  return resolveDroneCareStorefrontHref(sanitizeCmsHref(merged, fallback), fallback);
}

function sanitizeTestimonialsTitle(title: string, fallback: string) {
  const normalized = title.replace(/\bjerus\b/gi, "fleet").trim();
  if (/what customers say about our/i.test(normalized)) {
    return fallback;
  }
  return normalized || fallback;
}

function sanitizeLegacyShelfBanner(shelf: HomepageShelfCms, fallback: HomepageShelfCms): HomepageShelfCms {
  const legacyEyebrows = new Set(["Mission Aircraft", "Parts & Service", "Import & Export"]);
  const legacyBodies = [
    "Welcome to India's 1st & Leading Drone Ecosystem Aggregator",
    "Sales / Rental Service / Troubleshooting",
    "A marketplace to connect for Global products"
  ];
  const legacySubtitles = new Set([
    "Drone is Mithron",
    "One Stop Drone Solution",
    "Global Drone Connect",
    "Systems Built for the Field",
    "Keep Every Flight Scheduled",
    "Source Across Borders"
  ]);

  return {
    ...shelf,
    heroEyebrow: legacyEyebrows.has(shelf.heroEyebrow) ? fallback.heroEyebrow : shelf.heroEyebrow,
    heroSubtitle: legacySubtitles.has(shelf.heroSubtitle) ? fallback.heroSubtitle : shelf.heroSubtitle,
    heroBody: legacyBodies.some((snippet) => shelf.heroBody.includes(snippet)) ? fallback.heroBody : shelf.heroBody,
    featureCta: shelf.featureCta === "Visit Mithron Smart" ? fallback.featureCta : shelf.featureCta,
    heroCtaHref:
      shelf.heroCtaHref === "https://www.mithronsmart.com"
      || isDroneCareLegacyCatalogHref(shelf.heroCtaHref)
      || isDroneCareStorefrontAlias(shelf.heroCtaHref)
        ? fallback.heroCtaHref
        : shelf.heroCtaHref
  };
}

function mergeShelf(partial: unknown, fallback: HomepageShelfCms): HomepageShelfCms {
  const row = isPlainRecord(partial) ? partial : {};
  return sanitizeLegacyShelfBanner(
    {
    eyebrow: mergeField(optionalString(row.eyebrow), fallback.eyebrow),
    title: mergeField(optionalString(row.title), fallback.title),
    href: mergeHrefField(optionalString(row.href), fallback.href),
    viewAllLabel: mergeField(optionalString(row.viewAllLabel), fallback.viewAllLabel),
    guideLabel: mergeField(optionalString(row.guideLabel), fallback.guideLabel),
    guideTitle: mergeField(optionalString(row.guideTitle), fallback.guideTitle),
    guideHref: mergeHrefField(optionalString(row.guideHref), fallback.guideHref),
    heroEyebrow: mergeField(optionalString(row.heroEyebrow), fallback.heroEyebrow),
    heroSubtitle: mergeField(optionalString(row.heroSubtitle), fallback.heroSubtitle),
    heroBody: mergeField(optionalString(row.heroBody), fallback.heroBody),
    featureCta: mergeField(optionalString(row.featureCta), fallback.featureCta),
    heroCtaHref: mergeHrefField(optionalString(row.heroCtaHref), fallback.heroCtaHref),
    heroImageSrc: mergeField(optionalString(row.heroImageSrc), fallback.heroImageSrc),
    heroImageAlt: mergeField(optionalString(row.heroImageAlt), fallback.heroImageAlt)
    },
    fallback
  );
}

function mergeMissionTile(partial: unknown, fallback: HomepageMissionTileCms): HomepageMissionTileCms {
  const row = isPlainRecord(partial) ? partial : {};
  return {
    label: mergeField(optionalString(row.label), fallback.label),
    body: mergeField(optionalString(row.body), fallback.body),
    operator: mergeField(optionalString(row.operator), fallback.operator),
    model: mergeField(optionalString(row.model), fallback.model),
    location: mergeField(optionalString(row.location), fallback.location),
    imageSrc: mergeField(optionalString(row.imageSrc), fallback.imageSrc),
    imageAlt: mergeField(optionalString(row.imageAlt), fallback.imageAlt),
    href: mergeHrefField(optionalString(row.href), fallback.href)
  };
}

function mergeMission(partial: unknown, fallback: HomepageMissionCms): HomepageMissionCms {
  const row = isPlainRecord(partial) ? partial : {};
  const tilePartials = Array.isArray(row.tiles) ? row.tiles : [];
  return {
    eyebrow: mergeField(optionalString(row.eyebrow), fallback.eyebrow),
    title: mergeField(optionalString(row.title), fallback.title),
    body: mergeField(optionalString(row.body), fallback.body),
    href: mergeHrefField(optionalString(row.href), fallback.href),
    cta: mergeField(optionalString(row.cta), fallback.cta),
    mediaNote: mergeField(optionalString(row.mediaNote), fallback.mediaNote),
    tiles: fallback.tiles.map((tile, index) => mergeMissionTile(tilePartials[index], tile))
  };
}

export function mergeHomepageCmsContent(stored: unknown): HomepageCmsContent {
  const fallback = homepageCmsFallback();
  const root = isPlainRecord(stored) ? stored : {};
  const shelves = isPlainRecord(root.shelves) ? root.shelves : {};
  const missions = isPlainRecord(root.missions) ? root.missions : {};
  const testimonials = isPlainRecord(root.testimonials) ? root.testimonials : {};
  const about = isPlainRecord(root.about) ? root.about : {};

  return {
    shelves: {
      droneWorld: mergeShelf(shelves.droneWorld, fallback.shelves.droneWorld),
      droneCare: mergeShelf(shelves.droneCare, fallback.shelves.droneCare),
      globalProducts: mergeShelf(shelves.globalProducts, fallback.shelves.globalProducts)
    },
    missions: {
      agri: mergeMission(missions.agri, fallback.missions.agri),
      city: mergeMission(missions.city, fallback.missions.city)
    },
    testimonials: {
      eyebrow: mergeField(optionalString(testimonials.eyebrow), fallback.testimonials.eyebrow),
      title: sanitizeTestimonialsTitle(
        mergeField(optionalString(testimonials.title), fallback.testimonials.title),
        fallback.testimonials.title
      ),
      lead: mergeField(optionalString(testimonials.lead), fallback.testimonials.lead),
      linkLabel: mergeField(optionalString(testimonials.linkLabel), fallback.testimonials.linkLabel),
      linkHref: mergeHrefField(optionalString(testimonials.linkHref), fallback.testimonials.linkHref)
    },
    about: {
      eyebrow: mergeField(optionalString(about.eyebrow), fallback.about.eyebrow),
      title: mergeField(optionalString(about.title), fallback.about.title),
      body: mergeField(optionalString(about.body), fallback.about.body),
      primaryLabel: mergeField(optionalString(about.primaryLabel), fallback.about.primaryLabel),
      primaryHref: mergeHrefField(optionalString(about.primaryHref), fallback.about.primaryHref),
      secondaryLabel: mergeField(optionalString(about.secondaryLabel), fallback.about.secondaryLabel),
      secondaryHref: mergeHrefField(optionalString(about.secondaryHref), fallback.about.secondaryHref)
    }
  };
}

export async function fetchHomepageCmsContent(): Promise<HomepageCmsContent> {
  const config = getSupabaseAdminConfig();
  const fallback = homepageCmsFallback();

  if (!config.configured) {
    if (isCmsStrictMode()) {
      throw new Error("Homepage CMS is unavailable: Supabase is not configured.");
    }
    return fallback;
  }

  try {
    const response = await fetch(`${config.url}/rest/v1/admin_settings?id=eq.global&select=payload,updated_at&limit=1`, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      next: {
        revalidate: 60,
        tags: ["cms", "homepage-cms", "admin-settings"]
      }
    });

    if (!response.ok || response.status === 404) {
      if (isCmsStrictMode()) {
        throw new Error("Homepage CMS admin_settings row is missing. Save homepage content in the admin editor first.");
      }
      return fallback;
    }

    const rows = (await response.json()) as Array<{ payload?: unknown }>;
    const payload = rows[0]?.payload;
    if (!isPlainRecord(payload) || !isPlainRecord(payload.homepage)) {
      if (isCmsStrictMode()) {
        throw new Error("Homepage CMS payload is empty. Save homepage content in the admin editor first.");
      }
      return fallback;
    }

    return mergeHomepageCmsContent(payload.homepage);
  } catch (error) {
    if (isCmsStrictMode()) {
      throw error instanceof Error ? error : new Error(String(error));
    }
    return fallback;
  }
}

export const getHomepageCmsContent = cache(fetchHomepageCmsContent);
