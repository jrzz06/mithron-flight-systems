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

function isInteractionPaused() {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-overlay-open");
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

function measureNavbarTone(currentTone: NavbarInkTone): NavbarInkTone {
  const hero = document.querySelector("#hero");
  if (!hero) return currentTone;

  const sampleY = getNavbarSampleY();
  const heroRect = hero.getBoundingClientRect();
  if (heroRect.top <= sampleY && heroRect.bottom >= sampleY) {
    return toneFromExplicitAttributes(hero) ?? currentTone;
  }

  return "dark";
}

export function useAdaptiveNavbarTone(initialTone: NavbarInkTone = "dark") {
  const [tone, setTone] = useState<NavbarInkTone>(initialTone);

  useEffect(() => {
    const scheduleUpdate = (sampleImages = false) => {
      void sampleImages;
      if (isInteractionPaused()) return;
      setTone((current) => measureNavbarTone(current));
    };

    const scheduleFullUpdate = () => scheduleUpdate(false);

    scheduleFullUpdate();
    window.addEventListener("resize", scheduleFullUpdate);

    const hero = document.querySelector("#hero");
    const heroObserver = hero
      ? new IntersectionObserver(scheduleFullUpdate, { threshold: [0, 0.25, 0.5, 0.75, 1] })
      : null;
    if (hero && heroObserver) heroObserver.observe(hero);

    const mutationObserver = new MutationObserver(scheduleFullUpdate);
    if (document.body) {
      mutationObserver.observe(document.body, {
        subtree: true,
        attributes: true,
        attributeFilter: ["data-navbar-ink", "data-navbar-tone", "data-active-hero-theme", "data-hero-content-ink", "data-hero-slide-state"]
      });
    }

    const overlayObserver = new MutationObserver(() => {
      if (!isInteractionPaused()) scheduleFullUpdate();
    });
    overlayObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-overlay-open"]
    });

    return () => {
      window.removeEventListener("resize", scheduleFullUpdate);
      heroObserver?.disconnect();
      mutationObserver.disconnect();
      overlayObserver.disconnect();
    };
  }, []);

  const style = useMemo(() => navbarToneStyles[tone], [tone]);

  return { tone, style };
}
