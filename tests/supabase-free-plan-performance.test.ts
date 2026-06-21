import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Supabase free-plan performance contract", () => {
  it("compresses admin, CMS, and product uploads into generated image variants", () => {
    const optimizerPath = join(process.cwd(), "services", "media-optimization.ts");
    expect(existsSync(optimizerPath)).toBe(true);

    const optimizer = source("services/media-optimization.ts");
    expect(optimizer).toContain("MEDIA_VARIANT_WIDTHS");
    expect(optimizer).toContain("thumbnail: 320");
    expect(optimizer).toContain("medium: 960");
    expect(optimizer).toContain("large: 1600");
    expect(optimizer).toContain("xlarge: 2560");
    expect(optimizer).toContain("withoutEnlargement: true");
    expect(optimizer).toContain("createOptimizedImageVariants");

    for (const actionFile of [
      "app/admin/media/actions.ts",
      "app/admin/products/actions.ts",
      "app/admin/cms/actions.ts"
    ]) {
      const action = source(actionFile);
      expect(action).toContain("createOptimizedImageVariants");
      expect(action).toContain("thumbnail_path");
      expect(action).toContain("responsive_variants");
      expect(action).toContain("optimized_uploaded_bytes");
      expect(action).not.toContain("file_size_bytes: String(file.size)");
    }
  });

  it("keeps admin thumbnails on the optimized Next image pipeline", () => {
    for (const componentFile of [
      "app/admin/products/product-catalog-grid.tsx",
      "components/admin/inventory-manager.tsx",
      "features/admin/cms/cms-visual-workspace.tsx"
    ]) {
      const component = source(componentFile);
      expect(component).not.toContain("unoptimized");
      expect(component).toContain("loading=\"lazy\"");
    }
  });

  it("caps high-volume Supabase admin queries and avoids 500-row media fetches", () => {
    const admin = source("services/admin.ts");
    expect(admin).toContain("ADMIN_LIST_LIMIT");
    expect(admin).toContain("MEDIA_LIBRARY_LIMIT");
    expect(admin).toContain('method: "HEAD"');
    expect(admin).not.toContain("limit=500");
    expect(admin).toContain("select=id,bucket,folder,storage_path,public_url,mime_type");
    expect(admin).toContain("select=slug,name,category,price,image,hero,variants,workflow_status");
  });

  it("keeps admin dashboard summary queries off select star payloads", () => {
    const admin = source("services/admin.ts");
    const dashboardSnapshot = admin.match(/export const getAdminDashboardSnapshot[\s\S]*?export const getAuditObservabilitySnapshot/)?.[0] ?? "";

    expect(dashboardSnapshot).not.toContain("select=*");
    expect(admin).toContain("select=id,order_number,status,payment_status,fulfillment_status,total,currency,created_at,updated_at");
    expect(admin).toContain("select=id,title,status,created_at,read_at");
    expect(admin).toContain("select=id,action,entity_table,entity_id,severity,created_at");
    expect(admin).toContain("select=product_slug,sku,stock_status,quantity,reorder_threshold,updated_at");
  });

  it("keeps public CMS snapshot reads on explicit low-egress columns", () => {
    const cms = source("services/cms.ts");
    const publicSnapshotLoader = cms.match(/async function loadPublicCmsSnapshot[\s\S]*?export const getPublicCmsSnapshot/)?.[0] ?? "";

    expect(publicSnapshotLoader).not.toContain("select=*");
    expect(cms).not.toContain("revalidate: 0");
    expect(cms).toContain("revalidate: 60");
    expect(cms).toContain("tags: [\"cms\", \"cms-public\", `cms-${table}`]");
    expect(cms).toContain("publicCmsQueries");
    expect(cms).toContain("heroBanners: \"select=id,product_slug,title,subtitle,cta_label,href,image,poster,video,theme,composition,title_color,subtitle_color,sort_order,is_visible,status");
    expect(cms).toContain("siteNavigation: \"select=id,label,href,sort_order,is_visible,status");
    expect(cms).toContain("productReviews: \"select=id,reviewer_name,body,product_slug,rating,sort_order,is_visible,status");
    expect(cms).toContain("fetchFooterLeadSettings");
  });

  it("keeps operations command-center reads on shallow operational columns", () => {
    const admin = source("services/admin.ts");
    const operationsSnapshot = admin.match(/export async function getOperationsSnapshot[\s\S]*?^}/m)?.[0] ?? "";

    expect(operationsSnapshot).not.toContain("select=*");
    expect(admin).toContain("operationsQueries");
    expect(admin).toContain("operationRoutes: \"select=id,route_key,label,href,module_key,required_role,sort_order,is_visible,status");
    expect(admin).toContain("deploymentRequests: \"select=id,order_id,requester_email,region,mission_profile,status,assigned_to,created_at,updated_at");
    expect(admin).toContain("notifications: \"select=id,title,status,priority,entity_table,entity_id,created_at,read_at");
  });

  it("keeps audit observability reads on explicit forensic columns", () => {
    const admin = source("services/admin.ts");
    const auditSnapshot = admin.match(/export const getAuditObservabilitySnapshot[\s\S]*?export const getEnterpriseCleanupSnapshot/)?.[0] ?? "";

    expect(auditSnapshot).not.toContain("select=*");
    expect(admin).toContain("auditQueries");
    expect(admin).toContain("auditLogs: \"select=id,actor_id,action,entity_table,entity_id,metadata,created_at");
    expect(admin).toContain("securityEvents: \"select=id,actor_user_id,actor_role,event_type,attempted_resource,denial_reason,route_path,http_status,severity,metadata,created_at");
    expect(admin).toContain("activityLogs: \"select=id,actor_id,action,entity_table,entity_id,severity,metadata,created_at");
  });

  it("keeps user governance reads on explicit role-management columns", () => {
    const admin = source("services/admin.ts");
    const governanceSnapshot = admin.match(/export const getUserGovernanceSnapshot[\s\S]*?export async function getCmsWorkspaceSnapshot/)?.[0] ?? "";

    expect(governanceSnapshot).not.toContain("select=*");
    expect(admin).toContain("governanceQueries");
    expect(admin).toContain("profiles: \"select=id,email,display_name,default_role,created_at,updated_at");
    expect(admin).toContain("userRoles: \"select=user_id,role_key,created_at");
    expect(admin).toContain("adminInvites: \"select=id,email,role_key,status,expires_at,created_at,updated_at");
  });

  it("keeps admin CMS workspace reads on visual-editor columns only", () => {
    const admin = source("services/admin.ts");
    const cmsWorkspaceSnapshot = admin.match(/export async function getCmsWorkspaceSnapshot[\s\S]*?export async function getMediaLibrarySnapshot/)?.[0] ?? "";

    expect(cmsWorkspaceSnapshot).not.toContain("select=*");
    expect(admin).toContain("cmsWorkspaceQueries");
    expect(admin).toContain("heroBanners: \"select=id,product_slug,title,subtitle,cta_label,href,image,poster,video,theme,composition,title_color,subtitle_color,starts_at,ends_at,sort_order,is_visible,status,revision,updated_at,created_at");
    expect(admin).toContain("homepageSections: \"select=id,section_key,label,component_key,payload,sort_order,is_visible,status,revision,updated_at,created_at");
    expect(admin).toContain("mediaAssets: \"select=id,public_url,caption,alt,alt_text,width,height,usage_scope,metadata,updated_at");
  });

  it("keeps operational mutation helpers off broad select-star reads", () => {
    for (const file of [
      "services/shipments.ts",
      "services/warehouse-movements.ts",
      "services/security-observability.ts",
      "services/admin-actions.ts",
      "app/admin/settings/actions.ts",
      "app/warehouse/actions.ts",
      "app/operations/actions.ts"
    ]) {
      expect(source(file)).not.toContain("select=*");
    }
  });

  it("keeps realtime off static CMS/media tables by default", () => {
    const realtime = source("services/enterprise-realtime.ts");
    const cmsScope = realtime.match(/cms:\s*\{[\s\S]*?\n\s*\},\n\s*warehouse:/)?.[0] ?? "";
    expect(cmsScope).toContain("content_revisions");
    expect(cmsScope).toContain("notifications");
    expect(cmsScope).not.toContain("hero_banners");
    expect(cmsScope).not.toContain("homepage_sections");
    expect(cmsScope).not.toContain("media_assets");

    const adminScope = realtime.match(/admin:\s*\{[\s\S]*?\n\s*\},\n\s*cms:/)?.[0] ?? "";
    expect(adminScope).toContain("orders");
    expect(adminScope).toContain("inventory");
    expect(adminScope).toContain("warehouse_stock");
    expect(adminScope).not.toContain("product_media_assets");
  });

  it("adds database indexes for low-egress paginated admin workflows", () => {
    const migrationPath = join(process.cwd(), "supabase", "migrations", "20260525000200_free_plan_performance_indexes.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const migration = source("supabase/migrations/20260525000200_free_plan_performance_indexes.sql");
    for (const indexName of [
      "mithron_products_status_sort_idx",
      "inventory_status_updated_idx",
      "warehouse_stock_product_sku_idx",
      "media_assets_updated_idx",
      "content_revisions_entity_revision_idx",
      "orders_status_updated_idx"
    ]) {
      expect(migration).toContain(indexName);
    }
  });

  it("adds hot-path Supabase indexes and consolidates repeated RLS permission checks", () => {
    const migrationPath = join(process.cwd(), "supabase", "migrations", "20260608000100_supabase_performance_hot_path_indexes.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const migration = source("supabase/migrations/20260608000100_supabase_performance_hot_path_indexes.sql");

    for (const indexName of [
      "activity_logs_created_idx",
      "activity_logs_action_created_idx",
      "notifications_created_idx",
      "product_media_assets_primary_lookup_idx",
      "product_media_assets_usage_variant_lookup_idx",
      "orders_updated_idx",
      "shipments_updated_idx",
      "security_events_created_idx"
    ]) {
      expect(migration).toContain(indexName);
    }

    expect(migration).toContain("create or replace function public.has_any_cms_permission");
    expect(migration).toContain("using (public.has_any_cms_permission(array['warehouse.write', 'orders.write', 'operations.write', 'audit.read']))");
    expect(migration).toContain("notify pgrst, 'reload schema'");
  });

  it("loads product details and static slugs with targeted catalog queries", () => {
    const catalog = source("services/catalog.ts");
    expect(catalog).toContain("async function fetchCatalogRows");
    expect(catalog).toContain("getProductRowBySlug");
    expect(catalog).toContain("getProductAffinityRowBySlug");
    expect(catalog).toContain("getProductShellItems");
    expect(catalog).toContain("slug=eq.");
    expect(catalog).toContain("select=slug,category,interests");
    expect(catalog).toContain("select=slug");
    expect(catalog).not.toContain("\"Accept-Encoding\": \"identity\"");
    expect(catalog).not.toContain("const products = await getProducts();\n  return products.find((product) => product.slug === slug);");
  });

  it("keeps the shared storefront shell on lightweight product summaries", () => {
    const rootLayout = source("app/layout.tsx");
    const layout = source("app/(storefront)/layout.tsx");
    const storeShell = source("components/layout/store-shell.tsx");
    const searchOverlay = source("components/overlays/search-overlay.tsx");
    const cartDrawer = source("components/overlays/cart-drawer.tsx");

    expect(rootLayout).not.toContain("getProductShellItems");
    expect(layout).toContain("getProductShellItems");
    expect(layout).toContain("getProducts");
    expect(layout).toContain("buildEnterpriseMenuConfigs");
    expect(storeShell).toContain("ProductShellItem");
    expect(searchOverlay).toContain("ProductShellItem");
    expect(cartDrawer).toContain("ProductShellItem");
  });

  it("keeps product detail client islands on lightweight product props", () => {
    const catalog = source("services/catalog.ts");
    const page = source("app/(storefront)/product/[slug]/page.tsx");
    const mediaViewer = source("sections/product/product-media-viewer.tsx");
    const configurator = source("sections/product/product-configurator.tsx");
    const support = source("sections/product/specs-faq-reviews.tsx");

    expect(catalog).toContain("getRelatedProductShellItems");
    expect(page).toContain("buildProductMediaViewerModel");
    expect(page).toContain("buildProductConfiguratorModel");
    expect(page).toContain("gallery: product.gallery");
    expect(page).toContain("getRelatedProductShellItems");
    expect(page).not.toContain("getRelatedProducts");
    expect(mediaViewer).toContain("ProductMediaViewerModel");
    expect(mediaViewer).not.toContain("import type { Product }");
    expect(mediaViewer).not.toContain("{ product }: { product: Product }");
    expect(configurator).toContain("ProductConfiguratorModel");
    expect(configurator).not.toContain("import type { Bundle, Product }");
    expect(configurator).not.toContain("{ product }: { product: Product }");
    expect(support).toContain("ProductShellItem");
    expect(support).not.toContain("relatedProducts: Product[]");
  });
});

