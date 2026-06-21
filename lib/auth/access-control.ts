import { normalizeCmsRole, type CmsRole } from "./permissions";

export type { CmsRole } from "./permissions";

export type AdminSection =
  | "overview"
  | "cms"
  | "products"
  | "media"
  | "warehouse"
  | "orders"
  | "operations"
  | "tasks"
  | "settings"
  | "audit"
  | "suppliers"
  | "enquiries"
  | "reports";

const protectedPrefixes = ["/admin", "/warehouse", "/operations", "/account", "/supplier"] as const;
const authPublicPrefixes = ["/login", "/auth/login", "/auth/callback", "/auth/logout", "/logout"] as const;

const roleAccess: Record<CmsRole, AdminSection[]> = {
  admin: ["overview", "cms", "products", "media", "warehouse", "orders", "operations", "tasks", "settings", "audit", "suppliers", "enquiries", "reports"],
  warehouse: ["warehouse", "orders"],
  supplier: ["products"],
  user: []
};

function normalizePath(pathname: string) {
  const [path] = pathname.split("?");
  if (!path || path === "/") return "/";
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAdminProtectedPath(pathname: string) {
  const normalized = normalizePath(pathname);
  return protectedPrefixes.some((prefix) => matchesPrefix(normalized, prefix));
}

export function isAuthPublicPath(pathname: string) {
  const normalized = normalizePath(pathname);
  return authPublicPrefixes.some((prefix) => matchesPrefix(normalized, prefix));
}

export function canAccessAdminSection(role: CmsRole | string | null | undefined, section: AdminSection) {
  const normalized = normalizeCmsRole(role);
  if (!normalized) return false;
  return roleAccess[normalized]?.includes(section) ?? false;
}

export function isStrictAdminRole(role: CmsRole | string | null | undefined) {
  return normalizeCmsRole(role) === "admin";
}

export function defaultPathForRole(role: CmsRole | string | null | undefined) {
  if (isStrictAdminRole(role)) return "/admin";
  if (normalizeCmsRole(role) === "warehouse") return "/warehouse/dashboard";
  if (normalizeCmsRole(role) === "supplier") return "/supplier";
  if (normalizeCmsRole(role) === "user") return "/account";
  return "/login";
}

export function workspaceLabelForRole(role: CmsRole | string | null | undefined) {
  if (isStrictAdminRole(role)) return "Admin workspace";
  if (normalizeCmsRole(role) === "warehouse") return "Warehouse operations";
  if (normalizeCmsRole(role) === "supplier") return "Supplier portal";
  return "Customer hub";
}

export function sectionFromPath(pathname: string): AdminSection {
  const normalized = normalizePath(pathname);
  if (normalized.startsWith("/warehouse")) return "warehouse";
  if (normalized.startsWith("/supplier")) return "products";
  if (normalized.startsWith("/operations/orders")) return "orders";
  if (normalized.startsWith("/operations/tasks")) return "tasks";
  if (normalized.startsWith("/operations")) return "operations";
  if (normalized.startsWith("/admin/suppliers")) return "suppliers";
  if (normalized.startsWith("/admin/enquiries")) return "enquiries";
  if (normalized.startsWith("/admin/reports")) return "reports";
  if (normalized.startsWith("/admin/cms")) return "cms";
  if (normalized.startsWith("/admin/products")) return "products";
  if (normalized.startsWith("/admin/inventory")) return "warehouse";
  if (normalized.startsWith("/admin/media")) return "media";
  if (normalized.startsWith("/admin/settings")) return "settings";
  if (normalized.startsWith("/admin/audit")) return "audit";
  if (normalized.startsWith("/admin/orders")) return "orders";
  return "overview";
}

export function isControlPanelRole(role: CmsRole | string | null | undefined) {
  const normalized = normalizeCmsRole(role);
  return normalized === "admin" || normalized === "warehouse" || normalized === "supplier";
}

export function isControlPanelPath(pathname: string) {
  const normalized = normalizePath(pathname);
  if (normalized.startsWith("/admin")) return true;
  if (normalized.startsWith("/warehouse")) return true;
  if (normalized.startsWith("/supplier")) return true;
  if (normalized.startsWith("/operations")) return true;
  if (normalized.startsWith("/account/security")) return true;
  return false;
}

/** Staff roles must not browse the customer storefront (home, catalog, cart, account, etc.). */
export function shouldConfineRoleToControlPanel(role: CmsRole | string | null | undefined, pathname: string) {
  if (!isControlPanelRole(role)) return false;

  const normalized = normalizePath(pathname);
  if (isAuthPublicPath(normalized)) return false;
  if (normalized.startsWith("/api")) return false;
  if (isControlPanelPath(normalized)) return false;

  return true;
}

export function canAccessProtectedPath(role: CmsRole | string | null | undefined, pathname: string) {
  const normalized = normalizePath(pathname);
  const canonicalRole = normalizeCmsRole(role);
  if (!canonicalRole) return false;
  if (normalized.startsWith("/admin")) return isStrictAdminRole(role);
  if (normalized.startsWith("/warehouse")) {
    return isStrictAdminRole(role) || canonicalRole === "warehouse";
  }
  if (normalized.startsWith("/supplier")) {
    return isStrictAdminRole(role) || canonicalRole === "supplier";
  }
  if (normalized.startsWith("/operations")) {
    return isStrictAdminRole(role);
  }
  if (normalized.startsWith("/account")) {
    return Boolean(canonicalRole);
  }
  return false;
}

export { normalizeCmsRole };
