import remoteMapData from "@/data/mithron-storefront-remote-map.generated.json";

const LOCAL_PATH_ALIASES: Record<string, string> = {
  "/media/mithron/hero/ag10-command.webp": "/assets/hero/hero-slide-01.webp",
  "/media/mithron/hero/mapping-flight.webp": "/assets/hero/hero-slide-02.webp",
  "/media/mithron/hero/security-grid.webp": "/assets/hero/hero-slide-04.webp",
  "/media/mithron/banners/ag10-command.webp": "/assets/hero/hero-slide-01.webp",
  "/media/mithron/banners/mapping-flight.webp": "/assets/hero/hero-slide-02.webp",
  "/media/mithron/banners/security-grid.webp": "/assets/hero/hero-slide-04.webp",
  "/media/mithron/carousel/ag10-command.webp": "/assets/hero/hero-slide-01.webp",
  "/media/mithron/carousel/mapping-flight.webp": "/assets/hero/hero-slide-02.webp",
  "/media/mithron/carousel/security-grid.webp": "/assets/hero/hero-slide-04.webp"
};

const HERO_FALLBACK_BY_ID: Record<string, string> = {
  "ag10-arrival": "/assets/hero/hero-slide-01.webp",
  "mapping-flight": "/assets/hero/hero-slide-02.webp",
  "drone-ecosystem": "/assets/hero/hero-slide-03.webp",
  "surveillance-grid": "/assets/hero/hero-slide-04.webp"
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

export function resolveStorefrontSrc(src: string, options?: { heroSlideId?: string }) {
  const trimmed = src?.trim();
  if (!trimmed) {
    const fallbackPath = options?.heroSlideId ? HERO_FALLBACK_BY_ID[options.heroSlideId] ?? "" : "";
    return remotePrimaryForPath(fallbackPath) ?? fallbackPath;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const canonical = canonicalStorefrontPath(trimmed);
  const remote = remotePrimaryForPath(canonical) ?? remotePrimaryForPath(trimmed);
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
