"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toaster } from "sonner";
import { SiteFooter } from "@/components/layout/site-footer";
import { StoreNav } from "@/components/navigation/store-nav";
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

export function StoreShell({
  children,
  products,
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

    const preloadSupportOverlays = () => {
      if (!active) return;

      requestSearchPreload(true);
      void import("@/components/overlays/cart-drawer").catch((error: unknown) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("Overlay preload failed", error);
        }
      });
      void import("@/components/overlays/search-overlay").catch((error: unknown) => {
        if (process.env.NODE_ENV !== "production") {
          console.error("Search overlay preload failed", error);
        }
      });
    };

    timerId = globalThis.setTimeout(preloadSupportOverlays, 1200);

    return () => {
      active = false;
      if (timerId) {
        globalThis.clearTimeout(timerId);
      }
    };
  }, [requestSearchPreload, usesStorefrontChrome]);

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
