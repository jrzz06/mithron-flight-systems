"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";

type LenisInstance = {
  raf: (time: number) => void;
  destroy: () => void;
  resize: () => void;
  on: (event: "scroll", callback: () => void) => () => void;
};

import { shouldUseNativeScroll } from "@/lib/ui/shell-routes";

function clearLenisDocumentState(root: HTMLElement) {
  delete root.dataset.smoothScroll;
  root.classList.remove(
    "lenis",
    "lenis-smooth",
    "lenis-scrolling",
    "lenis-stopped",
    "lenis-locked",
    "lenis-autoToggle"
  );
}

export function LenisProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (shouldUseNativeScroll(pathname)) return undefined;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return undefined;

    const reducedMotion = window.matchMedia(reducedMotionMediaQuery);
    if (reducedMotion.matches) {
      clearLenisDocumentState(document.documentElement);
      return undefined;
    }

    let disposed = false;
    let lenis: LenisInstance | null = null;
    let frameId: number | null = null;
    let unsubscribeScrollTrigger: (() => void) | null = null;
    const root = document.documentElement;

    root.dataset.smoothScroll = "initializing";

    const teardown = () => {
      disposed = true;
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
      unsubscribeScrollTrigger?.();
      unsubscribeScrollTrigger = null;
      if (lenis) {
        lenis.destroy();
      }
      lenis = null;
      clearLenisDocumentState(root);
    };

    const handleReducedMotionChange = () => {
      if (reducedMotion.matches) {
        teardown();
      }
    };

    reducedMotion.addEventListener("change", handleReducedMotionChange);

    void import("lenis")
      .then(({ default: Lenis }) => {
        if (disposed) return;

        lenis = new Lenis({
          autoRaf: false,
          anchors: true,
          autoResize: true,
          gestureOrientation: "vertical",
          lerp: 0.1,
          smoothWheel: true,
          syncTouch: false,
          touchMultiplier: 1,
          wheelMultiplier: 1,
          overscroll: true,
          stopInertiaOnNavigate: true,
          prevent: (node) => Boolean(node.closest("[data-lenis-prevent]"))
        });
        root.dataset.smoothScroll = "lenis";
        lenis.resize();

        const raf = (time: number) => {
          if (disposed || !lenis) return;
          lenis.raf(time);
          frameId = requestAnimationFrame(raf);
        };
        frameId = requestAnimationFrame(raf);

        void import("gsap/ScrollTrigger")
          .then(({ ScrollTrigger }) => {
            if (disposed || !lenis) return;

        unsubscribeScrollTrigger = lenis.on("scroll", () => {
          ScrollTrigger.update();
          window.dispatchEvent(new Event("mithron:viewport-scroll"));
        });
            ScrollTrigger.refresh();
          })
          .catch((error: unknown) => {
            if (process.env.NODE_ENV !== "production") {
              console.error("Lenis ScrollTrigger bridge failed", error);
            }
          });
      })
      .catch((error: unknown) => {
        clearLenisDocumentState(root);
        if (process.env.NODE_ENV !== "production") {
          console.error("Lenis smooth scroll failed to initialize", error);
        }
      });

    return () => {
      reducedMotion.removeEventListener("change", handleReducedMotionChange);
      teardown();
    };
  }, [pathname]);

  return children;
}
