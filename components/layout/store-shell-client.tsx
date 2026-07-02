"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { StoreNav } from "@/components/navigation/store-nav";
import { CatalogIntegrityNotice } from "@/components/layout/catalog-integrity-notice";
import { CartDrawerLoading } from "@/components/overlays/cart-drawer-loading";
import type { EnterpriseMenuConfig } from "@/lib/nav-menu-types";
import type { NavigationNode } from "@/config/types";
import type { CatalogDataError } from "@/services/catalog";
import { shouldSkipStorefrontChrome } from "@/lib/ui/shell-routes";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import { useUiStore } from "@/store/ui";

const CartDrawer = dynamic(() => import("@/components/overlays/cart-drawer").then((mod) => mod.CartDrawer), {
  ssr: false,
  loading: () => <CartDrawerLoading />
});

const SearchOverlay = dynamic(() => import("@/components/overlays/search-overlay").then((mod) => mod.SearchOverlay), {
  ssr: false,
  loading: () => null
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

export function StoreShellClient({
  children,
  navigationItems,
  enterpriseMenuConfigs,
  catalogErrors = [],
  siteFooter
}: {
  children: ReactNode;
  navigationItems: NavigationNode[];
  enterpriseMenuConfigs: EnterpriseMenuConfig[];
  catalogErrors?: CatalogDataError[];
  siteFooter: ReactNode;
}) {
  const pathname = usePathname();
  const skipsStorefrontChrome = shouldSkipStorefrontChrome(pathname);
  const isHome = pathname === "/";
  const flushesUnderNav = isHome || hasFlushStorefrontHero(pathname);
  const usesStorefrontChrome = !skipsStorefrontChrome;
  const hasOpenedSearch = useUiStore((state) => state.hasOpenedSearch);
  const overlay = useUiStore((state) => state.overlay);
  const hasOpenedCart = useCartStore((state) => state.hasOpenedCart);
  const isCartOpen = useCartStore((state) => state.isCartOpen);
  const [searchPrewarmed, setSearchPrewarmed] = useState(false);
  const isMountedRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (overlay || isCartOpen) {
      root.setAttribute("data-overlay-open", "");
    } else {
      root.removeAttribute("data-overlay-open");
    }

    return () => {
      root.removeAttribute("data-overlay-open");
    };
  }, [overlay, isCartOpen]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, [pathname]);

  useEffect(() => {
    if (!usesStorefrontChrome) return;
    void useCartStore.persist.rehydrate();
  }, [usesStorefrontChrome]);

  const requestSearchPreload = useCallback((mountWhenReady = false) => {
    void import("@/components/overlays/search-overlay").catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Search overlay preload failed", error);
      }
    });
    if (mountWhenReady && isMountedRef.current) {
      setSearchPrewarmed(true);
    }
  }, []);

  useEffect(() => {
    if (!usesStorefrontChrome) return;

    let active = true;
    let timerId: ReturnType<typeof globalThis.setTimeout> | undefined;
    let idleId: number | undefined;

    const preloadSupportOverlays = () => {
      if (!active) return;

      void import("@/components/overlays/cart-drawer").catch((error: unknown) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("Overlay preload failed", error);
        }
      });
    };

    if ("requestIdleCallback" in globalThis) {
      idleId = globalThis.requestIdleCallback(preloadSupportOverlays, { timeout: 3000 });
    } else {
      timerId = globalThis.setTimeout(preloadSupportOverlays, 3000);
    }

    return () => {
      active = false;
      if (idleId !== undefined && "cancelIdleCallback" in globalThis) {
        globalThis.cancelIdleCallback(idleId);
      }
      if (timerId) {
        globalThis.clearTimeout(timerId);
      }
    };
  }, [usesStorefrontChrome]);

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
      <CatalogIntegrityNotice errors={catalogErrors} />
      <main
        id="g-main"
        data-testid={isHome ? "home-page-canvas" : undefined}
        data-homepage-contract={isHome ? "NAV_HERO_CAROUSEL_COMPOSITE" : undefined}
        className={cn(isHome && "home-page-canvas", !flushesUnderNav && "store-main-offset")}
      >
        {children}
      </main>
      {isHome ? null : siteFooter}
      {searchPrewarmed || hasOpenedSearch ? (
        <SearchOverlay />
      ) : null}
      {hasOpenedCart ? <CartDrawer /> : null}
      <Toaster position="top-center" richColors duration={1400} />
    </>
  );
}
