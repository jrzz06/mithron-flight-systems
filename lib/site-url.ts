const LOCAL_DEV_SITE_URL = "http://127.0.0.1:3000";

/** Retired Vercel projects or domains that must never be used for auth or canonical URLs. */
const OBSOLETE_APP_HOSTS = new Set([
  "mithron-flight-systems-kbkbkh.vercel.app"
]);

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return LOCAL_DEV_SITE_URL;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function isObsoleteAppHost(hostname: string) {
  return OBSOLETE_APP_HOSTS.has(hostname.trim().toLowerCase());
}

export function sanitizeAppOrigin(value: string | null | undefined) {
  if (!value?.trim()) return null;

  try {
    const url = new URL(normalizeSiteUrl(value));
    if (isObsoleteAppHost(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function resolveSiteUrlString(env: Record<string, string | undefined> = process.env) {
  const candidates = [
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_BRANCH_URL,
    env.VERCEL_URL,
    env.NEXT_PUBLIC_SITE_URL
  ];

  for (const candidate of candidates) {
    const sanitized = sanitizeAppOrigin(candidate ? normalizeSiteUrl(candidate) : null);
    if (sanitized) return sanitized;
  }

  return LOCAL_DEV_SITE_URL;
}

export function getSiteUrl(env: Record<string, string | undefined> = process.env) {
  try {
    return new URL(resolveSiteUrlString(env));
  } catch {
    return new URL(LOCAL_DEV_SITE_URL);
  }
}

export function getSiteOrigin(env: Record<string, string | undefined> = process.env) {
  return getSiteUrl(env).origin;
}

export function toAbsoluteUrl(path: string, env: Record<string, string | undefined> = process.env) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, getSiteUrl(env)).toString();
}

export function hasConfiguredSiteUrl(env: Record<string, string | undefined> = process.env) {
  if (sanitizeAppOrigin(env.VERCEL_PROJECT_PRODUCTION_URL)) return true;
  if (sanitizeAppOrigin(env.VERCEL_BRANCH_URL)) return true;
  if (sanitizeAppOrigin(env.VERCEL_URL)) return true;
  return Boolean(sanitizeAppOrigin(env.NEXT_PUBLIC_SITE_URL));
}
