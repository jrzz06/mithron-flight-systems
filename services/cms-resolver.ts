import { cache } from "react";
import {
  contentSourcesForComponent,
  defaultHomepageContentSources,
  type CmsDomainContentSource
} from "@/config/cms-resolver-registry";
import { getSupabaseAdminConfig } from "@/lib/env";

/** Always loaded on `/` because `app/page.tsx` renders HomeLandingComposite unconditionally. */
const HOMEPAGE_PINNED_SOURCES: CmsDomainContentSource[] = ["admin_settings"];

export type CmsOrchestrationRow = Record<string, unknown>;

export type CmsPageOrchestration = {
  routePath: string;
  page: CmsOrchestrationRow | null;
  sections: CmsOrchestrationRow[];
  contentSources: CmsDomainContentSource[];
  resolverStatus: "orchestrated" | "default";
};

type EnvSource = Record<string, string | undefined>;

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function publishedSection(row: CmsOrchestrationRow) {
  const status = optionalString(row.status) || "published";
  return status === "published" && row.is_visible !== false;
}

async function fetchAdminRows(table: string, query: string, env: EnvSource = process.env) {
  const config = getSupabaseAdminConfig(env);
  if (!config.configured) return null;

  try {
    // Validate URL format to catch malformed URLs early
    new URL(`${config.url}/rest/v1/${table}?${query}`);

    // Create abort controller with 30s timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${config.url}/rest/v1/${table}?${query}`, {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`
        },
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        console.warn(`Supabase API returned ${response.status} for table ${table}`);
        return null;
      }
      return (await response.json()) as CmsOrchestrationRow[];
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch CMS data from ${table}:`, errorMessage);
    return null;
  }
}

function resolveContentSources(sections: CmsOrchestrationRow[]): CmsDomainContentSource[] {
  const active = sections.filter(publishedSection);
  const set = new Set<CmsDomainContentSource>();
  for (const section of active) {
    for (const source of contentSourcesForComponent(optionalString(section.component_key))) {
      set.add(source);
    }
  }
  if (!set.size) return defaultHomepageContentSources();
  return Array.from(set);
}

function pinHomepageSources(routePath: string, sources: CmsDomainContentSource[]) {
  if (routePath !== "/") return sources;
  const set = new Set(sources);
  for (const source of HOMEPAGE_PINNED_SOURCES) set.add(source);
  return Array.from(set);
}

export async function resolveCmsPageOrchestration(
  routePath: string,
  env: EnvSource = process.env
): Promise<CmsPageOrchestration> {
  const normalizedRoute = routePath.startsWith("/") ? routePath : `/${routePath}`;
  const [pages, allSections] = await Promise.all([
    fetchAdminRows(
      "cms_pages",
      `select=id,slug,title,route_path,sort_order,is_visible,status&route_path=eq.${encodeURIComponent(normalizedRoute)}&limit=1`,
      env
    ),
    fetchAdminRows(
      "cms_sections",
      "select=id,page_id,section_key,component_key,title,sort_order,is_visible,status&order=sort_order.asc&limit=80",
      env
    )
  ]);

  const page = pages?.[0] ?? null;
  const pageId = optionalString(page?.id);
  const sections = (allSections ?? [])
    .filter((row) => !pageId || optionalString(row.page_id) === pageId)
    .filter(publishedSection);

  const contentSources = pinHomepageSources(normalizedRoute, resolveContentSources(sections));

  return {
    routePath: normalizedRoute,
    page,
    sections,
    contentSources,
    resolverStatus: page && sections.length ? "orchestrated" : "default"
  };
}

export const getHomepageCmsOrchestration = cache(async () => resolveCmsPageOrchestration("/"));

export function shouldLoadCmsSource(
  orchestration: CmsPageOrchestration,
  source: CmsDomainContentSource
) {
  return orchestration.contentSources.includes(source);
}
