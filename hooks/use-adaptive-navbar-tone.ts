"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

export type NavbarInkTone = "light" | "dark";

type NavbarToneStyle = CSSProperties & Record<`--${string}`, string>;

const navbarToneStyles = {
  light: {
    "--adaptive-navbar-ink": "rgba(252, 253, 255, 0.98)",
    "--adaptive-navbar-hover": "rgba(255, 255, 255, 1)",
    "--adaptive-navbar-muted": "rgba(248, 250, 252, 0.72)",
    "--adaptive-navbar-underline": "rgba(255, 255, 255, 0.84)",
    "--adaptive-navbar-text-shadow": "none",
    "--adaptive-navbar-glass-start": "rgba(7, 10, 13, 0.62)",
    "--adaptive-navbar-glass-end": "rgba(7, 10, 13, 0.34)",
    "--adaptive-navbar-border": "rgba(255, 255, 255, 0.14)",
    "--adaptive-navbar-shadow": "0 10px 28px rgba(0, 0, 0, 0.18)",
    "--adaptive-navbar-menu-bg": "rgba(8, 10, 12, 0.72)",
    "--adaptive-navbar-menu-border": "rgba(255, 255, 255, 0.16)",
    "--adaptive-navbar-menu-control": "rgba(255, 255, 255, 0.07)"
  },
  dark: {
    "--adaptive-navbar-ink": "rgba(10, 12, 16, 0.97)",
    "--adaptive-navbar-hover": "rgba(10, 12, 16, 0.82)",
    "--adaptive-navbar-muted": "rgba(10, 12, 16, 0.62)",
    "--adaptive-navbar-underline": "rgba(10, 12, 16, 0.72)",
    "--adaptive-navbar-text-shadow": "none",
    "--adaptive-navbar-glass-start": "rgba(255, 255, 255, 0.9)",
    "--adaptive-navbar-glass-end": "rgba(255, 255, 255, 0.74)",
    "--adaptive-navbar-border": "rgba(17, 17, 19, 0.1)",
    "--adaptive-navbar-shadow": "0 10px 24px rgba(15, 23, 42, 0.08)",
    "--adaptive-navbar-menu-bg": "rgba(250, 252, 253, 0.76)",
    "--adaptive-navbar-menu-border": "rgba(17, 17, 19, 0.10)",
    "--adaptive-navbar-menu-control": "rgba(17, 17, 19, 0.055)"
  }
} satisfies Record<NavbarInkTone, NavbarToneStyle>;

const sampleXPositions = [0.12, 0.32, 0.5, 0.68, 0.88] as const;
const toneLuminanceCutoff = 0.45;
let samplerCanvas: HTMLCanvasElement | null = null;
let samplerContext: CanvasRenderingContext2D | null = null;

function getSamplerContext() {
  if (samplerContext || typeof document === "undefined") return samplerContext;
  samplerCanvas = document.createElement("canvas");
  samplerCanvas.width = 1;
  samplerCanvas.height = 1;
  samplerContext = samplerCanvas.getContext("2d", { willReadFrequently: true });
  return samplerContext;
}

function parseRgbChannel(value: string) {
  const rgba = value.match(/rgba?\(([^)]+)\)/i);
  if (!rgba) return null;

  const [r, g, b, alpha = "1"] = rgba[1].split(",").map((part) => part.trim());
  const red = Number.parseFloat(r);
  const green = Number.parseFloat(g);
  const blue = Number.parseFloat(b);
  const opacity = Number.parseFloat(alpha);

  if (![red, green, blue, opacity].every(Number.isFinite)) return null;

  return { r: red, g: green, b: blue, alpha: opacity };
}

function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const normalize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

function toneFromExplicitAttributes(element: Element): NavbarInkTone | null {
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const navbarInk = current.getAttribute("data-navbar-ink");
    if (navbarInk === "light" || navbarInk === "dark") return navbarInk;

    const activeHeroTheme = current.getAttribute("data-active-hero-theme");
    if (activeHeroTheme === "dark") return "light";
    if (activeHeroTheme === "light") return "dark";

    const backgroundTone = current.getAttribute("data-navbar-tone");
    if (backgroundTone === "dark") return "light";
    if (backgroundTone === "light") return "dark";

    current = current.parentElement;
  }

  return null;
}

function toneFromComputedBackground(element: Element): NavbarInkTone | null {
  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const channel = parseRgbChannel(style.backgroundColor);

    if (channel && channel.alpha > 0.08) {
      return luminance(channel) > toneLuminanceCutoff ? "dark" : "light";
    }

    current = current.parentElement;
  }

  return null;
}

function parseObjectPositionValue(token: string, axis: "x" | "y") {
  const normalized = token.trim().toLowerCase();
  if (normalized.endsWith("%")) {
    const value = Number.parseFloat(normalized.slice(0, -1));
    if (Number.isFinite(value)) return Math.min(1, Math.max(0, value / 100));
  }

  if (axis === "x") {
    if (normalized === "left") return 0;
    if (normalized === "right") return 1;
    if (normalized === "center") return 0.5;
    return 0.5;
  }

  if (normalized === "top") return 0;
  if (normalized === "bottom") return 1;
  if (normalized === "center") return 0.5;
  return 0.5;
}

function toneFromImageSample(image: HTMLImageElement, viewportX: number, viewportY: number): NavbarInkTone | null {
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return null;

  const rect = image.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  if (viewportX < rect.left || viewportX > rect.right || viewportY < rect.top || viewportY > rect.bottom) return null;

  const context = getSamplerContext();
  if (!context) return null;

  const localX = viewportX - rect.left;
  const localY = viewportY - rect.top;
  const style = window.getComputedStyle(image);
  const objectFit = style.objectFit || "fill";
  const [positionXToken = "50%", positionYToken = positionXToken] = style.objectPosition.split(/\s+/);
  const positionX = parseObjectPositionValue(positionXToken, "x");
  const positionY = parseObjectPositionValue(positionYToken, "y");

  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  let sampleX = 0;
  let sampleY = 0;

  if (objectFit === "cover" || objectFit === "contain") {
    const scale = objectFit === "cover"
      ? Math.max(rect.width / naturalWidth, rect.height / naturalHeight)
      : Math.min(rect.width / naturalWidth, rect.height / naturalHeight);
    const renderedWidth = naturalWidth * scale;
    const renderedHeight = naturalHeight * scale;
    const offsetX = (rect.width - renderedWidth) * positionX;
    const offsetY = (rect.height - renderedHeight) * positionY;
    const projectedX = (localX - offsetX) / scale;
    const projectedY = (localY - offsetY) / scale;

    if (
      projectedX < 0 ||
      projectedX > naturalWidth - 1 ||
      projectedY < 0 ||
      projectedY > naturalHeight - 1
    ) return null;

    sampleX = projectedX;
    sampleY = projectedY;
  } else {
    sampleX = (localX / rect.width) * naturalWidth;
    sampleY = (localY / rect.height) * naturalHeight;
  }

  const clampedX = Math.min(Math.max(0, Math.floor(sampleX)), naturalWidth - 1);
  const clampedY = Math.min(Math.max(0, Math.floor(sampleY)), naturalHeight - 1);

  try {
    context.clearRect(0, 0, 1, 1);
    context.drawImage(image, clampedX, clampedY, 1, 1, 0, 0, 1, 1);
    const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
    if (alpha < 24) return null;
    return luminance({ r, g, b }) > toneLuminanceCutoff ? "dark" : "light";
  } catch {
    return null;
  }
}

function resolveToneAtPoint(x: number, y: number, sampleImages: boolean): NavbarInkTone | null {
  const navRoot = document.querySelector(".TOP_NAVBAR");
  const stack = document.elementsFromPoint(x, y).filter((element) => !navRoot?.contains(element));

  for (const element of stack) {
    if (sampleImages) {
      if (element instanceof HTMLImageElement) {
        const sampledTone = toneFromImageSample(element, x, y);
        if (sampledTone) return sampledTone;
      } else if (element instanceof HTMLElement) {
        const nestedImage = element.querySelector("img");
        if (nestedImage instanceof HTMLImageElement) {
          const sampledTone = toneFromImageSample(nestedImage, x, y);
          if (sampledTone) return sampledTone;
        }
      }
    }

    const explicitTone = toneFromExplicitAttributes(element);
    if (explicitTone) return explicitTone;

    const computedTone = toneFromComputedBackground(element);
    if (computedTone) return computedTone;
  }

  return null;
}

function getNavbarSampleY() {
  const navRoot = document.querySelector(".TOP_NAVBAR");
  const bar = navRoot?.querySelector(".adaptive-navbar__bar");
  const barRect = bar?.getBoundingClientRect();

  if (barRect && barRect.height > 0) {
    return Math.min(Math.max(barRect.top + barRect.height * 0.52, 16), window.innerHeight - 1);
  }

  const navRect = navRoot?.getBoundingClientRect();
  return Math.min(Math.max((navRect?.bottom ?? 76) - 24, 16), window.innerHeight - 1);
}

function heroIntersectsNavbarSampleLine(sampleY: number) {
  const hero = document.querySelector("#hero");
  if (!hero) return false;

  const heroRect = hero.getBoundingClientRect();
  return heroRect.top <= sampleY && heroRect.bottom >= sampleY;
}

function measureNavbarTone(currentTone: NavbarInkTone, sampleImages: boolean): NavbarInkTone {
  const sampleY = getNavbarSampleY();
  const scores: Record<NavbarInkTone, number> = { light: 0, dark: 0 };

  for (const position of sampleXPositions) {
    const tone = resolveToneAtPoint(window.innerWidth * position, sampleY, sampleImages);
    if (tone) scores[tone] += 1;
  }

  if (scores.light === 0 && scores.dark === 0) {
    const hero = document.querySelector("#hero");
    if (hero) {
      const heroRect = hero.getBoundingClientRect();
      if (heroRect.top <= sampleY && heroRect.bottom >= sampleY) {
        const heroTone = toneFromExplicitAttributes(hero);
        if (heroTone) return heroTone;
      }
    }
    return currentTone;
  }

  if (scores.light === scores.dark) return currentTone;
  return scores.light > scores.dark ? "light" : "dark";
}

export function useAdaptiveNavbarTone(initialTone: NavbarInkTone = "dark") {
  const [tone, setTone] = useState<NavbarInkTone>(initialTone);

  useEffect(() => {
    let frameId = 0;
    let scrollThrottleId: number | undefined;
    let lastScrollSampleAt = 0;
    let shouldSampleImages = false;

    const updateTone = () => {
      frameId = 0;
      const sampleImages = shouldSampleImages;
      shouldSampleImages = false;
      setTone((current) => measureNavbarTone(current, sampleImages));
    };

    const scheduleUpdate = (sampleImages = false) => {
      shouldSampleImages = shouldSampleImages || sampleImages;
      if (frameId) return;
      frameId = window.requestAnimationFrame(updateTone);
    };
    const scheduleScrollUpdate = () => {
      const now = performance.now();
      const remaining = 120 - (now - lastScrollSampleAt);
      const sampleY = getNavbarSampleY();
      const shouldSampleHeroImagery = heroIntersectsNavbarSampleLine(sampleY);

      if (remaining <= 0) {
        lastScrollSampleAt = now;
        scheduleUpdate(shouldSampleHeroImagery);
        return;
      }

      if (scrollThrottleId) return;

      scrollThrottleId = window.setTimeout(() => {
        scrollThrottleId = undefined;
        lastScrollSampleAt = performance.now();
        scheduleUpdate(shouldSampleHeroImagery);
      }, remaining);
    };
    const scheduleFullUpdate = () => scheduleUpdate(false);

    scheduleFullUpdate();
    const sampleImagesSoon = window.setTimeout(() => scheduleUpdate(true), 120);
    window.addEventListener("load", () => scheduleUpdate(true));

    const imageLoadHandler = () => scheduleUpdate(true);
    document.addEventListener("load", imageLoadHandler, true);

    window.addEventListener("scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("mithron:viewport-scroll", scheduleScrollUpdate, { passive: true });
    window.addEventListener("resize", scheduleFullUpdate);
    window.visualViewport?.addEventListener("resize", scheduleFullUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleScrollUpdate, { passive: true });

    const observedTargets = Array.from(document.querySelectorAll("section, [data-navbar-ink], [data-navbar-tone], [data-active-hero-theme]"));
    const intersectionObserver = new IntersectionObserver(scheduleScrollUpdate, {
      root: null,
      threshold: [0, 0.2, 0.5, 0.8, 1]
    });
    observedTargets.forEach((target) => intersectionObserver.observe(target));

    const mutationObserver = new MutationObserver(scheduleScrollUpdate);
    if (document.body) {
      mutationObserver.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-navbar-ink", "data-navbar-tone", "data-active-hero-theme", "data-hero-content-ink", "data-hero-slide-state"]
      });
    }

    return () => {
      window.clearTimeout(sampleImagesSoon);
      document.removeEventListener("load", imageLoadHandler, true);
      if (frameId) window.cancelAnimationFrame(frameId);
      if (scrollThrottleId) window.clearTimeout(scrollThrottleId);
      window.removeEventListener("scroll", scheduleScrollUpdate);
      window.removeEventListener("mithron:viewport-scroll", scheduleScrollUpdate);
      window.removeEventListener("resize", scheduleFullUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleFullUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleScrollUpdate);
      intersectionObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  const style = useMemo(() => navbarToneStyles[tone], [tone]);

  return { tone, style };
}
