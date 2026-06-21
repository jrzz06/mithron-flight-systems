import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("admin operational UX", () => {
  it("provides shared operational admin controls without changing persistence architecture", () => {
    const modulePanel = source("components/admin/module-panel.tsx");
    const submitButton = source("components/admin/operational-submit-button.tsx");
    const nav = source("components/admin/admin-nav.tsx");
    const frame = source("components/admin/admin-frame.tsx");

    expect(modulePanel).toContain("export function StatusBadge");
    expect(modulePanel).toContain("export function OperationalRecordGrid");
    expect(modulePanel).toContain("export function OperationalFeedback");
    expect(submitButton).toContain("useFormStatus");
    expect(submitButton).toContain("aria-live=\"polite\"");
    expect(nav).toContain("usePathname");
    expect(nav).toContain("aria-current");
    expect(nav).toContain("/auth/logout");
    expect(frame).toContain("AdminNav");
    expect(frame).toContain("navGroups");
    expect(frame).toContain("Core");
    expect(frame).toContain("Dashboard");
    expect(frame).toContain("Content");
    expect(frame).toContain("System");
    expect(frame).toContain("AdminTopbar");
    expect(frame).toContain("data-admin-shell");
    expect(frame).toContain("lg:pl-[228px]");
    expect(frame).toContain("lg:fixed");
    expect(frame).toContain("lg:inset-y-0");
    expect(frame).toContain("lg:w-[228px]");
    expect(frame).toContain("lg:overscroll-contain");
    expect(frame).toContain("/admin/products#product-list");
    expect(frame).toContain("Users");
    expect(frame).toContain("/admin/users");
    expect(frame).toContain("/admin/settings");
    expect(frame).not.toContain("/admin/settings#users");
    expect(frame).toContain('icon: "dashboard"');
    expect(frame).not.toContain("Icon:");
    expect(frame).not.toContain("LucideIcon");
    expect(frame).not.toContain('href: "/warehouse"');
    expect(frame).not.toContain('href: "/warehouse/shipments"');
    expect(frame).not.toContain('href: "/admin/audit"');
    expect(frame).not.toContain("Storefront");
    expect(nav).toContain("AdminNavIconKey");
    expect(nav).toContain("iconByKey");
    expect(nav).toContain("Icon");
    expect(nav).toContain("aria-hidden=\"true\"");
  });

  it("uses compact production admin primitives instead of marketing hero panels", () => {
    const modulePanel = source("components/admin/module-panel.tsx");
    const controlShell = source("components/admin/control-shell.tsx");
    const topbar = source("components/admin/admin-topbar.tsx");

    expect(modulePanel).toContain("export function AdminMetricGrid");
    expect(modulePanel).toContain("export function AdminSection");
    expect(modulePanel).toContain("export function AdminTableShell");
    expect(modulePanel).toContain("export function AdminFormSection");
    expect(modulePanel).toContain("export function AdminStickyActionFooter");
    expect(modulePanel).not.toContain("text-[clamp(2.4rem,5vw,5.2rem)]");
    expect(controlShell).toContain("data-control-plane");
    expect(controlShell).not.toContain("min-h-[calc(100vh-5rem)]");
    expect(topbar).toContain("data-admin-topbar");
    expect(topbar).toContain("data-admin-command-search");
    expect(topbar).not.toContain("/warehouse/shipments");
  });

  it("surfaces obvious admin CRUD entry points from the overview page", () => {
    const page = source("app/admin/page.tsx");

    expect(page).toContain("data-admin-crud-actions");
    expect(page).toContain("Quick actions");
    expect(page).toContain("Create product");
    expect(page).toContain("/admin/products?tool=create#create-product");
    expect(page).toContain("Archive / restore");
    expect(page).toContain("/admin/products?tool=publish#archive-product");
    expect(page).toContain("Review orders");
    expect(page).toContain("/admin/orders");
    expect(page).toContain("Manage users");
    expect(page).toContain("/admin/users");
    expect(page).not.toContain("/admin/settings#users");
    expect(page).not.toContain("Hard delete");
    expect(page).not.toContain("Open storefront");
  });

  it("replaces the admin overview hero with operational dashboard widgets", () => {
    const page = source("app/admin/page.tsx");
    const adminService = source("services/admin.ts");

    expect(page).toContain("data-admin-dashboard");
    expect(page).toContain("data-admin-quick-actions");
    expect(page).toContain("Recent orders");
    expect(page).toContain("Low stock");
    expect(page).toContain("Activity");
    expect(page).not.toContain("Recent CMS changes");
    expect(page).not.toContain("Recent uploads");
    expect(page).not.toContain("Table counts");
    expect(page).not.toContain("Website control plane.");
    expect(page).not.toContain("Super admin command");
    expect(adminService).toContain("recentOrders");
    expect(adminService).toContain("recentNotifications");
    expect(adminService).toContain("recentActivity");
    expect(adminService).toContain("lowStockAlerts");
    expect(adminService).not.toContain("recentShipments");
    expect(adminService).not.toContain("pendingOperations");
  });

  it("makes product management searchable and status visible", () => {
    const page = source("app/admin/products/page.tsx");
    const grid = source("app/admin/products/product-catalog-grid.tsx");

    expect(page).toContain("data-product-search");
    expect(page).toContain("data-product-status-filter");
    expect(page).toContain("ProductCatalogGrid");
    expect(grid).toContain("data-product-operational-grid");
    expect(grid).toContain("data-product-stock-visibility");
    expect(page).toContain("data-product-tool-dock");
    expect(page).toContain("activeTool === \"create\"");
    expect(page).toContain("activeTool === \"variants\"");
    expect(page).toContain("activeTool === \"seo\"");
    expect(page).toContain("activeTool === \"publish\"");
    expect(page).toContain("activeTool === \"inventory\"");
    expect(page).toContain("activeTool === \"media\"");
    expect(page).toContain("id=\"create-product\"");
    expect(page).toContain("data-product-add-action");
    expect(page).toContain("data-product-add-category-shortcut");
    expect(page).toContain("tool=category#product-category");
    expect(page).toContain("activeTool === \"category\"");
    expect(page).toContain("data-product-create-toolbar");
    expect(page).toContain("data-product-create-panel");
    expect(page).toContain("data-product-create-primary-fields");
    expect(page).toContain("data-product-create-media-fields");
    expect(page).toContain("data-product-create-submit-bar");
    expect(page).toContain("data-product-category-create-panel");
    expect(page).toContain("data-product-category-name-input");
    expect(page).toContain("data-product-category-route-input");
    expect(page).toContain("data-product-category-submit-bar");
    expect(page).toContain("ProductCategoryField");
    expect(page).toContain("uniqueCategoryOptions");
    expect(page).toContain("snapshot.data.categories");
    expect(page).toContain("saveProductCategoryFormAction");
    expect(page).toContain("deleteProductCategoryFormAction");
    expect(page).toContain("data-product-local-image-upload");
    expect(page).toContain("name=\"image_file\"");
    expect(page).toContain("data-product-supabase-storage-note");
    expect(page).toContain("mithron-products Storage bucket");
    expect(page).toContain("border-emerald-400/45 bg-emerald-500/15 text-emerald-100");
    expect(page).not.toContain("border-slate-900 bg-slate-950 text-white");
    expect(grid).toContain("id=\"update-product\"");
    expect(grid).toContain("data-product-quick-edit");
    expect(grid).toContain("data-product-quick-edit-modal");
    expect(grid).toContain("Edit product");
    expect(grid).toContain("Save changes");
    expect(grid).toContain("name=\"product_slug\" value={editingProduct.id}");
    expect(grid).toContain("type=\"hidden\" name=\"change_summary\"");
    expect(page).toContain("id=\"publish-product\"");
    expect(page).toContain("id=\"product-media\"");
    expect(grid).toContain("Pencil");
    expect(grid).toContain("aria-label={`Edit ${product.title}`}");
    expect(grid).toContain("title=\"Edit product\"");
    expect(grid).toContain("data-product-row-action=\"delete\"");
    expect(grid).toContain("data-product-row-actions-menu");
    expect(grid).toContain("grid-cols-[minmax(0,1fr)_minmax(0,1fr)_36px]");
    expect(grid).toContain("grid grid-cols-2 gap-1.5");
    expect(grid).toContain("menuOpen ? \"z-40\" : \"z-0\"");
    expect(grid).toContain("top-[calc(100%+0.375rem)] z-[90]");
    expect(grid).toContain("Delete product");
    expect(grid).toContain("grid-cols-1 md:grid-cols-2 xl:grid-cols-4");
    expect(grid).toContain("data-product-card");
    expect(grid).toContain("data-product-delete-modal");
    expect(grid).toContain("loading=\"lazy\"");
    expect(grid).toContain("saveProductDuplicateFormAction");
    expect(grid).toContain("Archive");
    expect(grid).toContain("Publish");
    expect(grid).toContain("Unpublish");
    expect(page).not.toContain("Hard delete");
    expect(page).not.toContain("data-product-row-action=\"hard-delete\"");
    expect(page).not.toContain("hard-delete-product");
    expect(page).toContain("OperationalSubmitButton");
    expect(page).toContain("OperationalFeedback");
    const categoryField = source("app/admin/products/product-category-field.tsx");
    expect(categoryField).toContain("data-product-category-field");
    expect(categoryField).toContain("data-product-delete-category-action");
    expect(categoryField).toContain("data-product-category-usage");
    expect(categoryField).toContain("name=\"category\"");
    expect(categoryField).toContain("name=\"category_route_key\"");
    expect(categoryField).not.toContain("data-product-add-category-action");
    expect(categoryField).not.toContain("startAddingCategory");
    expect(categoryField).not.toContain("data-product-new-category-panel");
    expect(categoryField).not.toContain("name=\"new_category\"");
    expect(categoryField).not.toContain("name=\"category_mode\"");
    expect(categoryField).toContain("formAction={deleteCategoryAction}");
  });

  it("adds operational dashboards for inventory and orders", () => {
    const inventoryPage = source("app/warehouse/inventory/page.tsx");
    const adminInventoryPage = source("app/admin/inventory/page.tsx");
    const inventoryManager = source("components/admin/inventory-manager.tsx");
    const ordersPage = source("app/admin/orders/page.tsx");
    const ordersWorkspace = source("components/admin/admin-orders-workspace.tsx");
    const ordersUi = `${ordersPage}\n${ordersWorkspace}`;

    expect(inventoryPage).toContain("data-inventory-mutation-feedback");
    expect(inventoryPage).toContain("InventoryManager");
    expect(inventoryPage).toContain("getCsvInventoryRows");
    expect(inventoryPage).not.toContain("getWarehouseSnapshot");
    expect(inventoryPage).toContain("saveWarehouseInventoryWithFeedback");
    expect(adminInventoryPage).toContain("InventoryManager");
    expect(adminInventoryPage).toContain("getCsvInventoryRows");
    expect(adminInventoryPage).not.toContain("getWarehouseSnapshot");
    expect(inventoryManager).toContain("data-inventory-system");
    expect(inventoryManager).toContain("data-inventory-row");
    expect(inventoryManager).toContain("data-inventory-source-report");
    expect(inventoryManager).toContain("data-inventory-quick-edit-form");
    expect(inventoryManager).toContain("data-advanced-warehouse-details");
    expect(inventoryManager).toContain("Stock update");
    expect(inventoryManager).toContain("In stock");
    expect(inventoryManager).toContain("Low stock");
    expect(inventoryManager).toContain("Out of stock");
    expect(inventoryManager).toContain("Supabase inventory records are the source of truth.");
    expect(inventoryManager).toContain("OperationalSubmitButton");

    expect(ordersUi).toContain("data-order-status-board");
    expect(ordersUi).toContain("data-order-timeline");
    expect(ordersUi).toContain("data-order-transition-feedback");
    expect(ordersUi).toContain("OperationalSubmitButton");
  });

  it("keeps media and CMS operations visible and retry-safe", () => {
    const mediaPage = source("app/admin/media/page.tsx");
    const uploadPanel = source("app/admin/media/media-upload-panel.tsx");
    const cmsPage = source("app/admin/cms/page.tsx");
    const cmsWorkspace = source("features/admin/cms/cms-visual-workspace.tsx");

    expect(mediaPage).toContain("data-media-search");
    expect(mediaPage).toContain("data-media-thumbnail-grid");
    expect(mediaPage).toContain("data-media-delete-form");
    expect(mediaPage).toContain("OperationalFeedback");
    expect(uploadPanel).toContain("useFormStatus");
    expect(uploadPanel).toContain("disabled={pending || !files.length || rejectedCount > 0}");
    expect(uploadPanel).toContain("aria-live=\"polite\"");
    expect(cmsPage).not.toContain("Editable website systems.");
    expect(cmsPage).toContain("data-cms-operational-feedback");
    expect(cmsWorkspace).toContain("data-cms-visual-editor");
    expect(cmsWorkspace).toContain("data-cms-media-picker");
    expect(cmsWorkspace).toContain("data-cms-sticky-action-bar");
    expect(cmsPage).not.toContain("data-cms-workflow-grid");
  });

  it("surfaces global operator feedback across admin and role shells", () => {
    const toastBridge = source("components/admin/operator-toast-bridge.tsx");
    const frame = source("components/admin/admin-frame.tsx");
    const shell = source("components/admin/control-shell.tsx");
    const modulePanel = source("components/admin/module-panel.tsx");

    expect(toastBridge).toContain("toast.success");
    expect(toastBridge).toContain("toast.error");
    expect(toastBridge).toContain("toast.warning");
    expect(toastBridge).toContain("useRouter");
    expect(toastBridge).toContain("router.replace");
    expect(toastBridge).toContain("cleanedParams.delete(statusKey)");
    expect(toastBridge).toContain("cleanedParams.delete(messageKeyFor(statusKey))");
    expect(frame).toContain("OperatorToastBridge");
    expect(shell).toContain("OperatorToastBridge");
    expect(shell).toContain("data-operator-state-strip");
    expect(modulePanel).toContain("export function OperationalStateStrip");
  });

  it("keeps storefront chrome out of admin and role control-plane routes", () => {
    const shell = source("components/layout/store-shell.tsx");
    const routes = source("lib/ui/shell-routes.ts");

    expect(shell).toContain("shouldSkipStorefrontChrome");
    expect(routes).toContain("pathname.startsWith(\"/admin/\")");
    expect(routes).toContain("pathname.startsWith(\"/warehouse/\")");
    expect(routes).toContain("pathname.startsWith(\"/operations/\")");
    expect(routes).toContain("pathname.startsWith(\"/supplier/\")");
    expect(shell).toContain("if (skipsStorefrontChrome)");
  });

  it("keeps storefront chrome off auth entry routes so login controls stay clickable", () => {
    const shell = source("components/layout/store-shell.tsx");
    const routes = source("lib/ui/shell-routes.ts");

    expect(routes).toContain("isAuthEntryRoute");
    expect(routes).toContain('pathname === "/login"');
    expect(routes).toContain('pathname === "/signup"');
    expect(routes).toContain('pathname.startsWith("/invite/")');
    expect(shell).toContain("shouldSkipStorefrontChrome(pathname)");
  });

  it("matures warehouse sibling pages with lifecycle visibility and pending submit states", () => {
    const ordersPage = source("app/warehouse/orders/page.tsx");
    const fulfillmentPage = source("app/warehouse/fulfillment/page.tsx");
    const pickingPage = source("app/warehouse/picking/page.tsx");
    const packingPage = source("app/warehouse/packing/page.tsx");
    const dispatchPage = source("app/warehouse/dispatch/page.tsx");
    const shipmentsPage = source("app/warehouse/shipments/page.tsx");
    const movementsPage = source("app/warehouse/movements/page.tsx");

    expect(ordersPage).toContain("data-warehouse-order-feedback");
    expect(ordersPage).toContain("data-warehouse-order-lifecycle");
    expect(fulfillmentPage).toContain("redirect(\"/warehouse/picking\")");
    expect(pickingPage).toContain("data-picking-queue");
    expect(packingPage).toContain("data-packing-station");
    expect(dispatchPage).toContain("data-dispatch-handoff-center");
    expect(shipmentsPage).toContain("data-shipment-progress-board");
    expect(shipmentsPage).toContain("data-shipment-timeline-snippets");
    expect(movementsPage).toContain("data-ledger-delta-summary");
  });

  it("keeps the default admin chrome focused on admin and warehouse work", () => {
    const frame = source("components/admin/admin-frame.tsx");
    const page = source("app/admin/page.tsx");

    expect(frame).not.toContain('href: "/operations"');
    expect(frame).not.toContain('href: "/warehouse"');
    expect(page).not.toContain("Operations tasks");
    expect(page).not.toContain("Shipment workflow");
  });
});

