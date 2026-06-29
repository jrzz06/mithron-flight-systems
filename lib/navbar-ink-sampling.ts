export type NavbarInkTone = "light" | "dark";

const FLUSH_HERO_LIGHT_NAV_ROUTES = new Set([
  "/agriculture",
  "/video-drones",
  "/creative-drones",
  "/mapping",
  "/surveillance",
  "/accessories",
  "/industrial"
]);

export function normalizeStorefrontPath(pathname: string | null) {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

/** SSR-safe navbar ink before client-side hero sampling runs. */
export function resolveInitialNavbarTone(pathname: string | null): NavbarInkTone {
  const normalized = normalizeStorefrontPath(pathname);
  if (normalized === "/") return "light";
  if (normalized === "/login") return "light";
  if (normalized.startsWith("/category/")) return "light";
  if (FLUSH_HERO_LIGHT_NAV_ROUTES.has(normalized)) return "light";
  return "dark";
}

const LUMINANCE_LIGHT_THRESHOLD = 0.58;

function luminanceFromRgb(r: number, g: number, b: number) {
  return 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
}

export function inkFromLuminance(luminance: number): NavbarInkTone {
  return luminance >= LUMINANCE_LIGHT_THRESHOLD ? "dark" : "light";
}

export function inkFromHexColor(hex: string | null | undefined): NavbarInkTone | null {
  if (!hex) return null;
  const normalized = hex.trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return inkFromLuminance(luminanceFromRgb(r, g, b));
}

export function resolveNavbarInkFromShowcase(
  showcase: { navbarInk?: NavbarInkTone },
  dominantColor?: string | null
): NavbarInkTone {
  return inkFromHexColor(dominantColor) ?? showcase.navbarInk ?? "light";
}

export function getNavbarSampleY() {
  const navRoot = document.querySelector(".TOP_NAVBAR");
  const bar = navRoot?.querySelector(".adaptive-navbar__bar");
  const barRect = bar?.getBoundingClientRect();

  if (barRect && barRect.height > 0) {
    return Math.min(Math.max(barRect.top + barRect.height * 0.52, 16), window.innerHeight - 1);
  }

  const navRect = navRoot?.getBoundingClientRect();
  return Math.min(Math.max((navRect?.bottom ?? 76) - 24, 16), window.innerHeight - 1);
}

function samplePixels(context: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = context.getImageData(0, 0, width, height).data;
  let total = 0;
  let count = 0;

  for (let index = 0; index < pixels.length; index += 4) {
    total += luminanceFromRgb(pixels[index], pixels[index + 1], pixels[index + 2]);
    count += 1;
  }

  return count > 0 ? total / count : null;
}

function sampleImageAtViewportY(image: HTMLImageElement, sampleY: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || image.naturalWidth <= 0 || image.naturalHeight <= 0) return null;

  const rect = image.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || sampleY < rect.top || sampleY > rect.bottom) return null;

  const sampleWidth = Math.min(180, image.naturalWidth);
  const sampleHeight = Math.min(56, image.naturalHeight);
  const relativeY = (sampleY - rect.top) / rect.height;
  const sourceX = Math.max(0, Math.round((image.naturalWidth - sampleWidth) / 2));
  const sourceY = Math.max(
    0,
    Math.min(Math.round(relativeY * image.naturalHeight - sampleHeight / 2), image.naturalHeight - sampleHeight)
  );

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;

  try {
    context.drawImage(image, sourceX, sourceY, sampleWidth, sampleHeight, 0, 0, sampleWidth, sampleHeight);
    return samplePixels(context, sampleWidth, sampleHeight);
  } catch {
    return null;
  }
}

function sampleVideoAtViewportY(video: HTMLVideoElement, sampleY: number) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || video.videoWidth <= 0 || video.videoHeight <= 0 || video.readyState < 2) return null;

  const rect = video.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0 || sampleY < rect.top || sampleY > rect.bottom) return null;

  const sampleWidth = Math.min(180, video.videoWidth);
  const sampleHeight = Math.min(56, video.videoHeight);
  const relativeY = (sampleY - rect.top) / rect.height;
  const sourceX = Math.max(0, Math.round((video.videoWidth - sampleWidth) / 2));
  const sourceY = Math.max(
    0,
    Math.min(Math.round(relativeY * video.videoHeight - sampleHeight / 2), video.videoHeight - sampleHeight)
  );

  canvas.width = sampleWidth;
  canvas.height = sampleHeight;

  try {
    context.drawImage(video, sourceX, sourceY, sampleWidth, sampleHeight, 0, 0, sampleWidth, sampleHeight);
    return samplePixels(context, sampleWidth, sampleHeight);
  } catch {
    return null;
  }
}

export function isNavbarWithinSection(section: Element, sampleY: number) {
  const rect = section.getBoundingClientRect();
  return rect.top <= sampleY && rect.bottom > rect.top;
}

function effectiveSampleYForMedia(mediaRect: DOMRect, sampleY: number) {
  if (sampleY < mediaRect.top) {
    return mediaRect.top + Math.min(16, Math.max(4, mediaRect.height * 0.08));
  }

  if (sampleY > mediaRect.bottom) {
    return mediaRect.bottom - Math.min(16, Math.max(4, mediaRect.height * 0.08));
  }

  return sampleY;
}

function toneFromMediaElement(element: HTMLImageElement | HTMLVideoElement, sampleY: number): NavbarInkTone | null {
  const rect = element.getBoundingClientRect();
  const effectiveSampleY = effectiveSampleYForMedia(rect, sampleY);
  const luminance =
    element instanceof HTMLVideoElement
      ? sampleVideoAtViewportY(element, effectiveSampleY)
      : sampleImageAtViewportY(element, effectiveSampleY);

  return luminance === null ? null : inkFromLuminance(luminance);
}

export function toneFromHeroMediaSampling(sampleY = getNavbarSampleY()): NavbarInkTone | null {
  const catalogSection = document.querySelector(".catalog-hero-section--showcase");
  const catalogImage = document.querySelector<HTMLImageElement>(
    ".catalog-hero-section--showcase .catalog-hero-image-section__asset"
  );
  if (catalogSection && catalogImage && isNavbarWithinSection(catalogSection, sampleY)) {
    const dominantTone = inkFromHexColor(catalogSection.getAttribute("data-hero-dominant-color"));
    if (dominantTone) return dominantTone;

    const tone = toneFromMediaElement(catalogImage, sampleY);
    if (tone) return tone;
  }

  const activeHomeSlide = document.querySelector('#hero [data-hero-slide-state="active"]');
  const homeHero = document.querySelector("#hero");
  if (activeHomeSlide && homeHero && isNavbarWithinSection(homeHero, sampleY)) {
    const video = activeHomeSlide.querySelector("video");
    const image = activeHomeSlide.querySelector("img");
    if (video) {
      const tone = toneFromMediaElement(video, sampleY);
      if (tone) return tone;
    }
    if (image) {
      const tone = toneFromMediaElement(image, sampleY);
      if (tone) return tone;
    }
  }

  const shelfHero = document.querySelector(".productShelfHero");
  const shelfImage = document.querySelector<HTMLImageElement>(".productShelfHero img");
  if (shelfHero && shelfImage && isNavbarWithinSection(shelfHero, sampleY)) {
    const tone = toneFromMediaElement(shelfImage, sampleY);
    if (tone) return tone;
  }

  const loginHero = document.querySelector("[data-login-hero-surface] .heroImage");
  const loginSurface = document.querySelector("[data-login-hero-surface]");
  if (loginHero instanceof HTMLImageElement && loginSurface && isNavbarWithinSection(loginSurface, sampleY)) {
    const tone = toneFromMediaElement(loginHero, sampleY);
    if (tone) return tone;
  }

  return null;
}
