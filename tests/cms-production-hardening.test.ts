import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertWritableCmsTable } from "@/lib/cms/deprecated-tables";
import { assertOptionalCmsMediaSrc, assertValidCmsMediaSrc } from "@/lib/cms/media-validation";
import { isCmsStrictMode } from "@/lib/cms/strict-mode";
import { mergeHomepageCmsContent } from "@/services/homepage-cms";
import { defaultHomepageCmsContent } from "@/config/homepage-cms";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("CMS production hardening", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("enables strict mode in production runtime or when MITHRON_CMS_STRICT=true", () => {
    expect(isCmsStrictMode({ NODE_ENV: "development" })).toBe(false);
    expect(isCmsStrictMode({ NODE_ENV: "development", MITHRON_CMS_STRICT: "true" })).toBe(true);
    expect(isCmsStrictMode({ NODE_ENV: "production" })).toBe(true);
    expect(isCmsStrictMode({ NODE_ENV: "production", NEXT_PHASE: "phase-production-build" })).toBe(false);
  });

  it("blocks writes to removed legacy storefront tables", () => {
    expect(() => assertWritableCmsTable("homepage_sections")).toThrow(/removed/i);
    expect(() => assertWritableCmsTable("testimonials")).toThrow(/removed/i);
    expect(() => assertWritableCmsTable("hero_banners")).not.toThrow();
  });

  it("validates CMS media paths on save", () => {
    expect(assertValidCmsMediaSrc("/media/hero.jpg", "Hero image")).toBe("/media/hero.jpg");
    expect(() => assertValidCmsMediaSrc("", "Hero image")).toThrow(/required/i);
    expect(() => assertValidCmsMediaSrc("http://evil.example/x.jpg", "Hero image")).toThrow(/HTTPS/i);
    expect(assertOptionalCmsMediaSrc("", "Hero image")).toBe("");
  });

  it("merges saved fields and uses empty strings instead of defaults in strict mode", () => {
    vi.stubEnv("MITHRON_CMS_STRICT", "true");
    vi.stubEnv("NODE_ENV", "development");

    const merged = mergeHomepageCmsContent({
      testimonials: { title: "Live testimonials title" }
    });

    expect(merged.testimonials.title).toBe("Live testimonials title");
    expect(merged.testimonials.eyebrow).toBe("");
    expect(merged.shelves.droneWorld.title).toBe("");
  });

  it("still merges TypeScript defaults in non-strict development", () => {
    vi.stubEnv("MITHRON_CMS_STRICT", "false");
    vi.stubEnv("NODE_ENV", "development");

    const merged = mergeHomepageCmsContent({});
    expect(merged.testimonials.eyebrow).toBe(defaultHomepageCmsContent.testimonials.eyebrow);
  });

  it("surfaces draft → publish UX in the homepage editor", () => {
    const editor = source("features/admin/cms/homepage-cms-editor.tsx");
    expect(editor).toContain("DraftPublishNotice");
    expect(editor).toContain("data-testid=\"hero-draft-status-hint\"");
    expect(editor).toContain("data-testid=\"review-draft-status-hint\"");
    expect(editor).toContain("Navigation lives in Advanced CMS");
    expect(editor).toContain("Footer content is split across two CMS stores");
  });

  it("disables deprecated CMS table actions in advanced workspace", () => {
    const workspace = source("features/admin/cms/cms-visual-workspace.tsx");
    expect(workspace).toContain("isDeprecatedCmsStorefrontTable");
    expect(workspace).toContain("data-cms-deprecated-actions-notice");
    expect(workspace).not.toContain("saveHomepageSectionDraftFormAction");
    expect(workspace).not.toContain("saveHomepageOrderingDraftFormAction");
  });
});
