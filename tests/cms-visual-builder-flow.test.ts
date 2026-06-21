import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("CMS visual builder flow", () => {
  it("organizes CMS pages around the storefront instead of database tables", () => {
    const page = source("app/admin/cms/page.tsx");
    const registry = source("config/cms-workspace.ts");
    const homepageEditor = source("features/admin/cms/homepage-cms-editor.tsx");
    const homepageConfig = source("config/homepage-cms.ts");

    for (const label of [
      "Homepage",
      "Products Page",
      "Product Detail Pages",
      "Navigation",
      "Footer",
      "About",
      "Contact",
      "Product Reviews"
    ]) {
      expect(registry).toContain(label);
    }

    expect(page).toContain("Hero Banner");
    expect(homepageEditor).toContain("HomepageCmsEditor");
    expect(homepageEditor).toContain("homepageCmsSections");
    expect(homepageEditor).toContain("shelf-drone-world");
    expect(homepageConfig).toContain("Drone World");
    expect(homepageConfig).toContain("Drone Care");
    expect(homepageConfig).toContain("Global Products");
    expect(homepageConfig).toContain("Trusted by pilots");
    expect(page).toContain("HomepageCmsEditor");
    expect(page).not.toContain("Supabase CMS homepage section");
  });

  it("renders a fast three-panel visual editor with section cards and live preview", () => {
    const workspace = source("features/admin/cms/cms-visual-workspace.tsx");

    expect(workspace).toContain("data-cms-site-structure");
    expect(workspace).toContain("data-cms-preview-canvas");
    expect(workspace).toContain("data-cms-editor-panel");
    expect(workspace).toContain("data-cms-section-card");
    expect(workspace).toContain("data-cms-section-quick-edit");
    expect(workspace).toContain("data-cms-section-duplicate");
    expect(workspace).toContain("data-cms-section-hide-show");
    expect(workspace).toContain("data-cms-section-card-publish");
    expect(workspace).toContain("data-cms-debounced-preview");
    expect(workspace).toContain("useDeferredValue");
    expect(workspace).toContain("No editable sections for this page yet");
  });

  it("keeps media and publishing controls visual, contextual, and non-technical", () => {
    const workspace = source("features/admin/cms/cms-visual-workspace.tsx");

    expect(workspace).toContain("data-cms-media-preview");
    expect(workspace).toContain("data-cms-media-dimensions");
    expect(workspace).toContain("data-cms-media-usage");
    expect(workspace).toContain("data-cms-crop-image");
    expect(workspace).toContain("data-cms-drag-drop-upload");
    expect(workspace).toContain("data-cms-publish-confirmation");
    expect(workspace).toContain("data-cms-section-history");
    expect(workspace).toContain("confirmMessage");
    expect(workspace).not.toContain("Payload JSON");
    expect(workspace).not.toContain("Storage path");
    expect(workspace).not.toContain("Bucket path");
    expect(workspace).not.toContain("UUID");
  });
});

