"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { getNavbarSampleY, isNavbarWithinSection, toneFromHeroMediaSampling, type NavbarInkTone } from "@/lib/navbar-ink-sampling";

export type { NavbarInkTone } from "@/lib/navbar-ink-sampling";

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
} satisfies Record<NavbarInkTone, CSSProperties & Record<`--${string}`, string>>;

const NAVBAR_ROOT_SELECTOR = ".TOP_NAVBAR, .adaptive-mobile-menu, .adaptive-mobile-menu__backdrop";
const NAVBAR_SURFACE_SELECTOR =
  ".catalog-hero-section--showcase, #hero, [data-testid='home-hero'], .productShelfHero, [data-navbar-ink-surface]";
const MIN_CHECK_INTERVAL_MS = 100;

function isInteractionPaused() {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-overlay-open");
}

function isNavbarElement(element: Element) {
  return Boolean(element.closest(NAVBAR_ROOT_SELECTOR));
}

function isMobileViewport() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function toneFromSurfaceElement(surface: Element): NavbarInkTone | null {
  const navbarInk = surface.getAttribute("data-navbar-ink");
  if (navbarInk === "light" || navbarInk === "dark") return navbarInk;

  const backgroundTone = surface.getAttribute("data-navbar-tone");
  if (backgroundTone === "dark") return "light";
  if (backgroundTone === "light") return "dark";

  return null;
}

function toneFromExplicitAttributes(element: Element): NavbarInkTone | null {
  const surface = element.closest(NAVBAR_SURFACE_SELECTOR);
  if (surface) {
    const surfaceTone = toneFromSurfaceElement(surface);
    if (surfaceTone) return surfaceTone;
  }

  let current: Element | null = element;

  while (current && current !== document.documentElement) {
    const tone = toneFromSurfaceElement(current);
    if (tone) return tone;

    const activeHeroTheme = current.getAttribute("data-active-hero-theme");
    if (activeHeroTheme === "dark") return "light";
    if (activeHeroTheme === "light") return "dark";

    current = current.parentElement;
  }

  return null;
}

function toneFromSurfaceAtNav(): NavbarInkTone | null {
  const sampleX = Math.round(window.innerWidth * 0.5);
  const sampleY = getNavbarSampleY();
  const stack = document.elementsFromPoint(sampleX, sampleY);

  for (const element of stack) {
    if (isNavbarElement(element)) continue;

    if (isMobileViewport() && element.closest('[data-testid="home-hero"]')) {
      return toneFromHeroMediaSampling(sampleY) ?? toneFromExplicitAttributes(element) ?? "dark";
    }

    const tone = toneFromExplicitAttributes(element);
    if (tone) return tone;
  }

  return null;
}

function measureNavbarTone(currentTone: NavbarInkTone): NavbarInkTone {
  if (isMobileViewport()) {
    return "dark";
  }

  const sampleY = getNavbarSampleY();

  const catalogSection = document.querySelector(".catalog-hero-section--showcase");
  if (catalogSection && isNavbarWithinSection(catalogSection, sampleY)) {
    const catalogInk = toneFromSurfaceElement(catalogSection);
    if (catalogInk) return catalogInk;
  }

  const homeHero = document.querySelector("#hero");
  if (homeHero && isNavbarWithinSection(homeHero, sampleY)) {
    const heroInk = toneFromSurfaceElement(homeHero);
    if (heroInk) return heroInk;
  }

  const sampledTone = toneFromHeroMediaSampling(sampleY);
  if (sampledTone) return sampledTone;

  const surfaceTone = toneFromSurfaceAtNav();
  if (surfaceTone) return surfaceTone;

  const heroSurfaces = [
    document.querySelector("#hero"),
    document.querySelector(".catalog-hero-section--showcase")
  ];

  for (const hero of heroSurfaces) {
    if (!hero) continue;
    const heroRect = hero.getBoundingClientRect();
    if (heroRect.top <= sampleY && heroRect.bottom >= sampleY) {
      return toneFromSurfaceElement(hero) ?? toneFromExplicitAttributes(hero) ?? currentTone;
    }
  }

  return "dark";
}

export function useAdaptiveNavbarTone(initialTone: NavbarInkTone = "dark") {
  const [tone, setTone] = useState(initialTone);
  const toneRef = useRef(initialTone);
  const lastCheckAtRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    toneRef.current = initialTone;
    queueMicrotask(() => setTone(initialTone));
  }, [initialTone]);

  useEffect(() => {
    hasMountedRef.current = true;
    const applyTone = (nextTone: NavbarInkTone) => {
      if (toneRef.current === nextTone) return;
      toneRef.current = nextTone;
      setTone(nextTone);
    };

    const runToneCheck = () => {
      if (!hasMountedRef.current || isInteractionPaused()) return;
      applyTone(measureNavbarTone(toneRef.current));
      lastCheckAtRef.current = performance.now();
    };

    const scheduleToneCheck = (force = false) => {
      if (rafIdRef.current !== null) return;

      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        const elapsed = performance.now() - lastCheckAtRef.current;
        if (!force && elapsed < MIN_CHECK_INTERVAL_MS) {
          scheduleToneCheck();
          return;
        }
        runToneCheck();
      });
    };

    runToneCheck();

    let mountAttempts = 0;
    const retryUntilHeroReady = () => {
      scheduleToneCheck(true);
      if (!document.querySelector("#hero") && !document.querySelector(".catalog-hero-section--showcase") && mountAttempts < 24) {
        mountAttempts += 1;
        window.requestAnimationFrame(retryUntilHeroReady);
      }
    };
    retryUntilHeroReady();

    const onResize = () => {
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = window.setTimeout(() => scheduleToneCheck(true), 150);
    };

    const onScroll = () => scheduleToneCheck();
    const onMediaReady = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLImageElement || target instanceof HTMLVideoElement) {
        scheduleToneCheck(true);
      }
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("load", onMediaReady, true);

    const heroSurfaces = [
      document.querySelector("#hero"),
      document.querySelector(".catalog-hero-section--showcase")
    ];
    const heroObserver = new IntersectionObserver(() => scheduleToneCheck(true), { threshold: [0, 0.25, 0.5, 0.75, 1] });
    for (const hero of heroSurfaces) {
      if (hero) heroObserver.observe(hero);
    }

    const mutationObserver = new MutationObserver(() => scheduleToneCheck());
    mutationObserver.observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-overlay-open", "data-navbar-ink", "data-navbar-tone", "data-active-hero-theme", "data-hero-content-ink", "data-hero-slide-state"]
    });

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("load", onMediaReady, true);
      if (resizeTimerRef.current) window.clearTimeout(resizeTimerRef.current);
      if (rafIdRef.current !== null) window.cancelAnimationFrame(rafIdRef.current);
      heroObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return { tone, style: navbarToneStyles[tone] as CSSProperties };
}
