import type { PlatformNavGroup, PlatformRouteTitle, PlatformSearchItem, PlatformNavIconKey } from "@/components/platform/types";
import type { AdminSection, CmsRole } from "@/lib/auth/access-control";
import { canAccessAdminSection } from "@/lib/auth/access-control";

type AdminNavItemDef = {
  label: string;
  href: string;
  section: AdminSection;
  icon: PlatformNavIconKey;
  badgeCount?: number;
};

const adminNavGroups: Array<{ label: string; items: AdminNavItemDef[] }> = [
  {
    label: "Home",
    items: [{ label: "Overview", href: "/admin", section: "overview", icon: "dashboard" }]
  },
  {
    label: "Catalog",
    items: [
      { label: "Products", href: "/admin/products#product-list", section: "products", icon: "products" },
      { label: "Inventory", href: "/admin/inventory", section: "warehouse", icon: "inventory" },
      { label: "Media", href: "/admin/media", section: "media", icon: "media" }
    ]
  },
  {
    label: "Fulfillment",
    items: [{ label: "Orders", href: "/admin/orders", section: "orders", icon: "orders" }]
  },
  {
    label: "Partners",
    items: [
      { label: "Suppliers", href: "/admin/suppliers", section: "suppliers", icon: "suppliers" },
      { label: "Submissions", href: "/admin/suppliers/products", section: "suppliers", icon: "products" },
      { label: "Enquiries", href: "/admin/enquiries", section: "enquiries", icon: "enquiries" }
    ]
  },
  {
    label: "Content",
    items: [{ label: "Website", href: "/admin/cms", section: "cms", icon: "cms" }]
  },
  {
    label: "Insights",
    items: [
      { label: "Reports", href: "/admin/reports", section: "reports", icon: "reports" },
      { label: "Activity log", href: "/admin/audit", section: "audit", icon: "audit" }
    ]
  },
  {
    label: "Workspace",
    items: [
      { label: "Operations", href: "/operations", section: "operations", icon: "operations" },
      { label: "Field requests", href: "/operations/deployments", section: "operations", icon: "operations" },
      { label: "Tasks", href: "/operations/tasks", section: "tasks", icon: "operations" },
      { label: "Notifications", href: "/operations/notifications", section: "operations", icon: "enquiries" }
    ]
  },
  {
    label: "Settings",
    items: [
      { label: "General", href: "/admin/settings", section: "settings", icon: "settings" },
      { label: "Team", href: "/admin/users", section: "settings", icon: "users" }
    ]
  }
];

export function buildAdminNavGroups(role: CmsRole | null, pendingSupplierApprovals = 0): PlatformNavGroup[] {
  return adminNavGroups
    .map((group) => ({
      label: group.label,
      items: group.items
        .filter((item) => Boolean(role && canAccessAdminSection(role, item.section)))
        .map((item) => ({
          label: item.label,
          href: item.href,
          icon: item.icon,
          badgeCount: item.href === "/admin/suppliers/products" ? pendingSupplierApprovals : item.badgeCount
        }))
    }))
    .filter((group) => group.items.length > 0);
}

export function buildAdminSearchItems(groups: PlatformNavGroup[]): PlatformSearchItem[] {
  return groups.flatMap((group) => group.items.map((item) => ({ label: item.label, href: item.href, group: group.label })));
}

export const adminRouteTitles: PlatformRouteTitle[] = [
  { href: "/admin/products", title: "Products", kicker: "Catalog" },
  { href: "/admin/orders", title: "Orders", kicker: "Fulfillment" },
  { href: "/admin/inventory", title: "Inventory", kicker: "Catalog" },
  { href: "/admin/cms", title: "Website", kicker: "Content" },
  { href: "/admin/media", title: "Media", kicker: "Catalog" },
  { href: "/admin/suppliers", title: "Suppliers", kicker: "Partners" },
  { href: "/admin/suppliers/products", title: "Submissions", kicker: "Partners" },
  { href: "/admin/enquiries", title: "Enquiries", kicker: "Partners" },
  { href: "/admin/reports", title: "Reports", kicker: "Insights" },
  { href: "/admin/audit", title: "Activity log", kicker: "Insights" },
  { href: "/admin/users", title: "Team", kicker: "Settings" },
  { href: "/admin/settings", title: "Settings", kicker: "Workspace" },
  { href: "/operations", title: "Operations", kicker: "Workspace" },
  { href: "/operations/deployments", title: "Field requests", kicker: "Workspace" },
  { href: "/operations/tasks", title: "Tasks", kicker: "Workspace" },
  { href: "/operations/notifications", title: "Notifications", kicker: "Workspace" },
  { href: "/operations/orders", title: "Orders", kicker: "Fulfillment" },
  { href: "/admin", title: "Overview", kicker: "Home" }
];

export const warehouseNavGroups: PlatformNavGroup[] = [
  {
    label: "Warehouse",
    items: [
      { label: "Today", href: "/warehouse/dashboard", icon: "gauge" },
      { label: "Orders", href: "/warehouse/orders", icon: "orders" },
      { label: "Fulfillment", href: "/warehouse/fulfillment", icon: "fulfillment" },
      { label: "Shipments", href: "/warehouse/shipments", icon: "truck" },
      { label: "Stock", href: "/warehouse/inventory", icon: "inventory" },
      { label: "Returns", href: "/warehouse/returns", icon: "returns" },
      { label: "History", href: "/warehouse/activity", icon: "history" },
      { label: "Settings", href: "/warehouse/settings", icon: "settings" }
    ]
  }
];

export const supplierNavGroups: PlatformNavGroup[] = [
  {
    label: "Supplier",
    items: [
      { label: "Overview", href: "/supplier", icon: "gauge" },
      { label: "Products", href: "/supplier/products", icon: "products" },
      { label: "Stock levels", href: "/supplier/inventory", icon: "inventory" }
    ]
  }
];

export const warehouseRouteTitles: PlatformRouteTitle[] = [
  { href: "/warehouse/dashboard", title: "Today", kicker: "Warehouse" },
  { href: "/warehouse/orders", title: "Orders", kicker: "Warehouse" },
  { href: "/warehouse/fulfillment", title: "Fulfillment", kicker: "Warehouse" },
  { href: "/warehouse/picking", title: "Fulfillment", kicker: "Warehouse" },
  { href: "/warehouse/packing", title: "Fulfillment", kicker: "Warehouse" },
  { href: "/warehouse/dispatch", title: "Fulfillment", kicker: "Warehouse" },
  { href: "/warehouse/shipments", title: "Shipments", kicker: "Warehouse" },
  { href: "/warehouse/inventory", title: "Stock", kicker: "Warehouse" },
  { href: "/warehouse/movements", title: "Stock history", kicker: "Warehouse" },
  { href: "/warehouse/transfers", title: "Transfers", kicker: "Warehouse" },
  { href: "/warehouse/returns", title: "Returns", kicker: "Warehouse" },
  { href: "/warehouse/activity", title: "History", kicker: "Warehouse" },
  { href: "/warehouse/settings", title: "Settings", kicker: "Warehouse" }
];

export const supplierRouteTitles: PlatformRouteTitle[] = [
  { href: "/supplier", title: "Overview", kicker: "Supplier" },
  { href: "/supplier/products", title: "Products", kicker: "Supplier" },
  { href: "/supplier/products/new", title: "New product", kicker: "Supplier" },
  { href: "/supplier/inventory", title: "Stock levels", kicker: "Supplier" }
];
