import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("CMS visual editor UX", () => {
  it("replaces database-style CMS forms with a section-based visual editor", () => {
    const page = source("app/admin/cms/page.tsx");
    const workspace = source("features/admin/cms/cms-visual-workspace.tsx");
    const homepageEditor = source("features/admin/cms/homepage-cms-editor.tsx");
    const homepageConfig = source("config/homepage-cms.ts");
    const registry = source("config/cms-workspace.ts");

    expect(page).toContain("CmsVisualWorkspace");
    expect(page).toContain("HomepageCmsEditor");
    expect(workspace).toContain("data-cms-visual-editor");
    expect(workspace).toContain("data-cms-page-sidebar");
    expect(workspace).toContain("data-cms-section-tree");
    expect(page).toContain("hero-banner");
    expect(page).toContain("homepage-features");
    expect(page).toContain("product-highlights");
    expect(page).toContain("homepage-testimonial");
    expect(page).toContain("footer");
    expect(page).toContain("navigation");
    expect(page).toContain("category-banner");
    expect(page).toContain("Hero Banner");
    expect(homepageEditor).toContain("homepageCmsSections");
    expect(homepageConfig).toContain("Drone World");
    expect(homepageConfig).toContain("Global Products");
    expect(registry).toContain("Category Banners");
    expect(registry).toContain("Product Reviews");
    expect(registry).toContain("Footer");
    expect(registry).toContain("Navigation");
    expect(registry).not.toContain("Campaigns");
    expect(workspace).not.toContain("data-cms-workflow-grid");
    expect(workspace).not.toContain("Hero workflow");
    expect(workspace).not.toContain("Draft module");
    expect(workspace).not.toContain("Hero image URL");
    expect(workspace).not.toContain("Hero video URL");
    expect(workspace).not.toContain("PATCH");
    expect(workspace).not.toContain("AUDITED");
    expect(workspace).not.toContain("WORKFLOW");
  });

  it("provides a visual hero editor with media picker and simple publishing actions", () => {
    const workspace = source("features/admin/cms/cms-visual-workspace.tsx");
    const actions = source("app/admin/cms/actions.ts");
    const adminService = source("services/admin.ts");

    expect(workspace).toContain("data-cms-section-controls");
    expect(workspace).toContain("data-cms-section-preview");
    expect(workspace).toContain("data-cms-desktop-preview");
    expect(workspace).toContain("data-cms-tablet-preview");
    expect(workspace).toContain("data-cms-mobile-preview");
    expect(workspace).toContain("data-cms-media-picker");
    expect(workspace).toContain("data-cms-upload-image");
    expect(workspace).toContain("Upload image");
    expect(workspace).toContain("Select from media library");
    expect(workspace).toContain("Save Draft");
    expect(workspace).toContain("Preview");
    expect(workspace).toContain("Publish");
    expect(workspace).toContain("data-cms-sticky-action-bar");
    expect(workspace).toContain("Draft");
    expect(workspace).toContain("Published");
    expect(workspace).toContain("saveCmsMediaUploadFormAction");
    expect(workspace).toContain("publishCmsWorkspaceRecordFormAction");
    expect(workspace).toContain("saveHeroBannerDraftFormAction");
    expect(workspace).toContain("saveCategoryMetadataDraftFormAction");
    expect(adminService).toContain("title_color,subtitle_color");
    expect(adminService).toContain("poster,video,theme,composition");
    expect(actions).toContain("saveCmsMediaUploadFormAction");
    expect(actions).toContain("mithron-products");
    expect(adminService).toContain("\"media_assets\"");
    expect(adminService).toContain("getCmsWorkspaceSnapshot");
  });
});

