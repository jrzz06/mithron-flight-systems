import {
  canAccessProtectedPath,
  defaultPathForRole,
  isAdminProtectedPath,
  isControlPanelPath,
  isControlPanelRole,
  normalizeCmsRole,
  type CmsRole
} from "./access-control";

export function getSafeAuthRedirectPath(value: string | null | undefined, fallback = "/admin") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;

  try {
    const parsed = new URL(value, "http://mithron.local");
    if (parsed.origin !== "http://mithron.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function getRoleAwareAuthRedirectPath(value: string | null | undefined, roleValue: CmsRole | string | null | undefined) {
  const role = normalizeCmsRole(roleValue);
  if (!role) return "/login?auth_status=role_required";

  const roleHome = defaultPathForRole(role);
  const requestedPath = getSafeAuthRedirectPath(value, "");
  if (!requestedPath || requestedPath === "/login") return roleHome;

  if (isControlPanelRole(role)) {
    if (canAccessProtectedPath(role, requestedPath) && isControlPanelPath(requestedPath)) {
      return requestedPath;
    }
    return roleHome;
  }

  if (isAdminProtectedPath(requestedPath)) {
    return canAccessProtectedPath(role, requestedPath) ? requestedPath : roleHome;
  }

  return requestedPath;
}
