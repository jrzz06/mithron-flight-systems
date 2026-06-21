"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { SiteFooter } from "@/components/layout/site-footer";
import { StoreNav } from "@/components/navigation/store-nav";
import { SearchOverlay } from "@/components/overlays/search-overlay";
import { CartDrawerLoading } from "@/components/overlays/cart-drawer-loading";
import type { Interest, NavigationNode } from "@/config/types";
import type { FooterContent } from "@/config/storefront-content";
import type { EnterpriseMenuConfig } from "@/lib/nav-menu-types";
import type { ProductShellItem } from "@/services/catalog";
import { shouldSkipStorefrontChrome } from "@/lib/ui/shell-routes";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import { useUiStore } from "@/store/ui";

const CartDrawer = dynamic(() => import("@/components/overlays/cart-drawer").then((mod) => mod.CartDrawer), {
  ssr: false,
  loading: () => <CartDrawerLoading />
});

function hasFlushStorefrontHero(pathname: string | null) {
  if (!pathname) return false;

  if (pathname.startsWith("/category/")) return true;

  return [
    "/agriculture",
    "/video-drones",
    "/creative-drones",
    "/mapping",
    "/surveillance",
    "/accessories",
    "/industrial"
  ].includes(pathname);
}

export function StoreShell({
  children,
  products,
  interests,
  navigationItems,
  enterpriseMenuConfigs,
  footer
}: {
  children: React.ReactNode;
  products: ProductShellItem[];
  interests: Interest[];
  navigationItems: NavigationNode[];
  enterpriseMenuConfigs: EnterpriseMenuConfig[];
  footer: FooterContent;
}) {
  const pathname = usePathname();
  const skipsStorefrontChrome = shouldSkipStorefrontChrome(pathname);
  const isHome = pathname === "/";
  const flushesUnderNav = isHome || hasFlushStorefrontHero(pathname);
  const isProductDetail = pathname.startsWith("/product/");
  const usesStorefrontChrome = !skipsStorefrontChrome;
  const usesScrollPaintGuard = usesStorefrontChrome && (isHome || isProductDetail);
  const hasOpenedSearch = useUiStore((state) => state.hasOpenedSearch);
  const hasOpenedCart = useCartStore((state) => state.hasOpenedCart);
  const [searchPrewarmed, setSearchPrewarmed] = useState(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, [pathname]);

  const requestSearchPreload = useCallback((mountWhenReady = false) => {
    if (mountWhenReady && isMountedRef.current) {
      setSearchPrewarmed(true);
    }
  }, []);

  useEffect(() => {
    if (!usesStorefrontChrome) {
      document.documentElement.classList.remove("mithron-scrolling");
      return;
    }

    let active = true;
    let timerId: ReturnType<typeof globalThis.setTimeout> | undefined;
    let scrollClassTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
    let lastScrollAt = performance.now();
    let scrollClassActive = false;
    const root = document.documentElement;

    const markScrollActivity = () => {
      lastScrollAt = performance.now();
      if (!usesScrollPaintGuard) return;

      if (!scrollClassActive) {
        root.classList.add("mithron-scrolling");
        scrollClassActive = true;
      }

      if (scrollClassTimer) {
        globalThis.clearTimeout(scrollClassTimer);
      }

      scrollClassTimer = globalThis.setTimeout(() => {
        root.classList.remove("mithron-scrolling");
        scrollClassActive = false;
      }, 180);
    };

    const preloadSupportOverlays = () => {
      if (!active) return;

      if (performance.now() - lastScrollAt < 700) {
        queuePreload(900);
        return;
      }

      requestSearchPreload(true);
      void import("@/components/overlays/cart-drawer").catch((error: unknown) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("Overlay preload failed", error);
        }
      });
    };

    const queuePreload = (delay: number) => {
      timerId = globalThis.setTimeout(() => {
        if (!active) return;
        preloadSupportOverlays();
      }, delay);
    };

    window.addEventListener("scroll", markScrollActivity, { passive: true });
    queuePreload(3200);

    return () => {
      active = false;
      window.removeEventListener("scroll", markScrollActivity);
      if (timerId) {
        globalThis.clearTimeout(timerId);
      }
      if (scrollClassTimer) {
        globalThis.clearTimeout(scrollClassTimer);
      }
      root.classList.remove("mithron-scrolling");
    };
  }, [requestSearchPreload, usesScrollPaintGuard, usesStorefrontChrome]);

  if (skipsStorefrontChrome) {
    return (
      <>
        {children}
        <Toaster position="top-center" richColors duration={1400} />
      </>
    );
  }

  return (
    <>
      <StoreNav
        navigationItems={navigationItems}
        enterpriseMenuConfigs={enterpriseMenuConfigs}
        onSearchIntent={() => requestSearchPreload()}
      />
      <main
        id="g-main"
        data-testid={isHome ? "home-page-canvas" : undefined}
        data-homepage-contract={isHome ? "NAV_HERO_CAROUSEL_COMPOSITE" : undefined}
        className={cn(isHome && "home-page-canvas", !flushesUnderNav && "pt-16 md:pt-[104px]")}
      >
        {children}
      </main>
      {isHome ? null : <SiteFooter content={footer} />}
      {searchPrewarmed || hasOpenedSearch ? <SearchOverlay products={products} /> : null}
      {hasOpenedCart ? <CartDrawer products={products} /> : null}
      <Toaster position="top-center" richColors duration={1400} />
    </>
  );
}
