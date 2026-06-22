import pathAliases from "@/config/storefront-path-aliases.json";
import { getBestVariantUpToWidth, getResponsiveAssetForSrc } from "@/config/generated-assets";
import remoteMapData from "@/data/mithron-storefront-remote-map.generated.json";
import { storefrontMediaPaths } from "@/config/storefront-media-paths";

const LOCAL_PATH_ALIASES = pathAliases as Record<string, string>;

const HERO_FALLBACK_BY_ID: Record<string, string> = {
  "ag10-arrival": storefrontMediaPaths.hero.slide01,
  "mapping-flight": storefrontMediaPaths.hero.slide02,
  "drone-ecosystem": storefrontMediaPaths.hero.slide03,
  "surveillance-grid": storefrontMediaPaths.hero.slide04
};

type RemoteMapEntry = {
  primarySrc: string;
  assetId?: string;
  bucket?: string;
};

type RemoteMap = {
  assets?: Record<string, RemoteMapEntry>;
};

const remoteByPath = new Map(Object.entries((remoteMapData as RemoteMap).assets ?? {}));

function stripQuery(path: string) {
  return path.split("?")[0];
}

export function canonicalStorefrontPath(src: string) {
  const trimmed = stripQuery(src?.trim() ?? "");
  if (!trimmed) return "";
  const aliased = LOCAL_PATH_ALIASES[trimmed];
  if (aliased) return aliased;
  if (!trimmed.startsWith("/")) return trimmed;
  if (/\.(png|jpe?g)$/i.test(trimmed)) {
    return trimmed.replace(/\.(png|jpe?g)$/i, ".webp");
  }
  return trimmed;
}

function remotePrimaryForPath(path: string) {
  return remoteByPath.get(path)?.primarySrc ?? remoteByPath.get(canonicalStorefrontPath(path))?.primarySrc;
}

const STOREFRONT_PRIMARY_MAX_WIDTH = 1920;

function generatedPrimaryForPath(path: string) {
  const responsive = getResponsiveAssetForSrc(path);
  if (responsive?.status !== "generated") return undefined;
  return getBestVariantUpToWidth(responsive, STOREFRONT_PRIMARY_MAX_WIDTH, "webp")?.src;
}

export function resolveStorefrontSrc(src: string, options?: { heroSlideId?: string }) {
  const trimmed = src?.trim();
  if (!trimmed) {
    const fallbackPath = options?.heroSlideId ? HERO_FALLBACK_BY_ID[options.heroSlideId] ?? "" : "";
    return (
      remotePrimaryForPath(fallbackPath) ??
      generatedPrimaryForPath(fallbackPath) ??
      fallbackPath
    );
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const canonical = canonicalStorefrontPath(trimmed);
  const remote =
    remotePrimaryForPath(canonical) ??
    remotePrimaryForPath(trimmed) ??
    generatedPrimaryForPath(canonical) ??
    generatedPrimaryForPath(trimmed);
  if (remote) return remote;

  if (canonical.startsWith("/")) return canonical;
  return `/${canonical.replace(/^\/+/, "")}`;
}

export function resolveHeroSlideSrc(src: string, slideId: string) {
  const canonical = HERO_FALLBACK_BY_ID[slideId] ?? canonicalStorefrontPath(src);
  return remotePrimaryForPath(canonical) ?? remotePrimaryForPath(canonicalStorefrontPath(src)) ?? resolveStorefrontSrc(src, { heroSlideId: slideId }) ?? src;
}

export function isRemoteStorefrontSrc(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}
