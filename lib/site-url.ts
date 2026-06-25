const DEFAULT_SITE_URL = "https://final-mithron-deploy.vercel.app";

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_SITE_URL;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

function resolveSiteUrlString() {
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) {
    return normalizeSiteUrl(vercelProduction);
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return normalizeSiteUrl(vercelUrl);
  }

  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredUrl) {
    return normalizeSiteUrl(configuredUrl);
  }

  return DEFAULT_SITE_URL;
}

export function getSiteUrl() {
  try {
    return new URL(resolveSiteUrlString());
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export function getSiteOrigin() {
  return getSiteUrl().origin;
}

export function toAbsoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, getSiteUrl()).toString();
}
