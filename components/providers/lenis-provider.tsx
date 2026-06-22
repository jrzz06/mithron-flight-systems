"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";

type LenisInstance = {
  destroy: () => void;
  resize: () => void;
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
    const root = document.documentElement;

    root.dataset.smoothScroll = "initializing";

    const teardown = () => {
      disposed = true;
      const activeLenis = lenis;
      lenis = null;
      clearLenisDocumentState(root);
      if (!activeLenis) return;

      window.requestAnimationFrame(() => {
        try {
          activeLenis.destroy();
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Lenis smooth scroll teardown skipped", error);
          }
        }
      });
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
          autoRaf: true,
          anchors: true,
          autoResize: true,
          gestureOrientation: "vertical",
          lerp: 0.08,
          smoothWheel: true,
          syncTouch: false,
          touchMultiplier: 1,
          wheelMultiplier: 0.95,
          overscroll: true,
          stopInertiaOnNavigate: true,
          prevent: (node) => Boolean(node.closest("[data-lenis-prevent]"))
        });
        root.classList.add("lenis", "lenis-smooth");
        root.dataset.smoothScroll = "lenis";
        lenis.resize();
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
