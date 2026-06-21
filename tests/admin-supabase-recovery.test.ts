import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("admin Supabase-only workflow recovery", () => {
  it("removes storefront mock fallback from admin-managed hero content", () => {
    const cmsService = source("services/cms.ts");
    const heroCarousel = source("sections/home/hero-carousel.tsx");

    expect(cmsService).toContain("export const emptySupabaseOnlySnapshot");
    expect(cmsService).not.toContain("import { heroSlides");
    expect(cmsService).not.toContain("home: {\n    heroBanners: heroSlides");
    expect(cmsService).toContain("source: \"supabase\"");
    expect(heroCarousel).not.toContain("slides = heroSlides");
    expect(heroCarousel).toContain("slides.length ? slides : defaultHeroSlides");
    expect(heroCarousel).toContain('data-hero-slide-state="active"');
    expect(heroCarousel).toContain("<video");
  });

  it("loads full Supabase product and media visibility instead of first-page samples", () => {
    const adminService = source("services/admin.ts");

    expect(adminService).toContain("productCounts");
    expect(adminService).toContain("mediaCounts");
    expect(adminService).toContain("stockCoverage");
    expect(adminService).toContain("countTable(config, \"mithron_products\")");
    expect(adminService).toContain("countTable(config, \"media_assets\")");
    expect(adminService).toContain("fetchAdminRows(config, \"category_metadata\"");
    expect(adminService).toContain("PRODUCT_MANAGER_LIMIT");
    expect(adminService).toContain("MEDIA_LIBRARY_LIMIT");
    expect(adminService).not.toContain("limit=500");
  });

  it("uses a minimal dark admin chrome across control-plane shells", () => {
    const frame = source("components/admin/admin-frame.tsx");
    const shell = source("components/admin/control-shell.tsx");
    const primitives = source("components/admin/module-panel.tsx");
    const topbar = source("components/admin/admin-topbar.tsx");

    expect(frame).toContain("bg-[#070B14] text-slate-100");
    expect(shell).toContain('scope === "warehouse"');
    expect(shell).toContain("bg-[#070B14] px-4 py-4 text-slate-100");
    expect(shell).toContain("bg-[#080b10] px-4 py-4 text-slate-100");
    expect(primitives).toContain("border-slate-800 bg-[#0f141b]");
    expect(topbar).toContain("bg-[#0b1017]");
    expect(frame).not.toContain("bg-slate-50 text-slate-950");
    expect(shell).not.toContain("bg-slate-50 text-slate-950");
  });

  it("turns product and CMS forms into layman-editable structured media workflows", () => {
    const productsPage = source("app/admin/products/page.tsx");
    const cmsWorkspace = source("features/admin/cms/cms-visual-workspace.tsx");

    expect(productsPage).toContain("data-product-media-picker");
    expect(productsPage).toContain("Product name");
    expect(productsPage).toContain("ProductCategoryField");
    expect(productsPage).toContain("Image URL");
    expect(productsPage).toContain("Upload image");
    expect(productsPage).toContain("data-product-supabase-storage-note");
    expect(productsPage).not.toContain("data-product-spec-rows");
    expect(productsPage).not.toContain("data-product-advanced-json");
    expect(productsPage).not.toContain("<span className=\"text-white/70\">Variants</span>");
    expect(productsPage).not.toContain("defaultValue=\"[]\" rows={4} className=\"rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 font-mono");

    expect(cmsWorkspace).toContain("data-cms-media-picker");
    expect(cmsWorkspace).toContain("data-cms-section-preview");
    expect(cmsWorkspace).not.toContain("data-cms-advanced-json");
    expect(cmsWorkspace).toContain("composition_mode");
    expect(cmsWorkspace).not.toContain("Image JSON");
    expect(cmsWorkspace).not.toContain("Poster JSON");
    expect(cmsWorkspace).not.toContain("Video JSON");
    expect(cmsWorkspace).not.toContain("Composition JSON");
  });

  it("supports CMS/product video uploads and rejects unsupported files clearly", () => {
    const mediaManager = source("services/media-manager.ts");
    const uploadPanel = source("app/admin/media/media-upload-panel.tsx");

    expect(mediaManager).toContain("videoMimeTypes");
    expect(mediaManager).toContain("video/mp4");
    expect(mediaManager).toContain("video/webm");
    expect(mediaManager).toContain("video/quicktime");
    expect(uploadPanel).toContain("video/mp4,video/webm,video/quicktime");
    expect(uploadPanel).toContain("VideoIcon");
    expect(uploadPanel).toContain("file.type.startsWith(\"video/\")");
  });

  it("makes admin booking confirmation and warehouse handoff visible without JSON-first forms", () => {
    const ordersPage = source("app/admin/orders/page.tsx");
    const ordersWorkspace = source("components/admin/admin-orders-workspace.tsx");
    const warehouseActions = source("app/warehouse/actions.ts");

    expect(ordersPage).toContain("AdminOrdersWorkspace");
    expect(ordersWorkspace).toContain("data-booking-workflow-board");
    expect(ordersWorkspace).toContain("data-confirm-warehouse-handoff");
    expect(ordersWorkspace).toContain("Assign to warehouse");
    expect(ordersWorkspace).toContain("data-order-transition-feedback");
    expect(ordersWorkspace).toContain("data-inventory-allocation");
    expect(ordersPage).not.toContain("Order items JSON");
    expect(ordersPage).not.toContain("Metadata JSON");
    expect(ordersPage).not.toContain("Shipment tracking JSON");
    expect(warehouseActions).toContain("createShipmentWorkflow(input");
  });
});

