"use client";

import Link from "next/link";
import Image from "next/image";
import { CartNavButton } from "@/components/navigation/cart-nav-button";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Globe2, Menu, Search, UserRound, X } from "lucide-react";
import { useAdaptiveNavbarTone } from "@/hooks/use-adaptive-navbar-tone";
import type { NavbarInkTone } from "@/hooks/use-adaptive-navbar-tone";
import { MithronCardImage } from "@/components/media/mithron-card-image";
import { resolveBrandMarkSrc } from "@/lib/media/brand-mark";
import type { NavigationNode } from "@/config/types";
import type { EnterpriseMenuConfig, EnterpriseMenuOption, FeaturedMenuCard, MegaMenuConfig } from "@/lib/nav-menu-types";
import { catalogCategoryDefinitions } from "@/lib/catalog-categories";
import { isStorefrontGuestOnly } from "@/lib/storefront/guest-demo";
import { useUiStore } from "@/store/ui";

function getInitialNavbarTone(pathname: string | null): NavbarInkTone {
  const normalized = normalizePath(pathname);
  // Homepage opens on a bright hero slide — start with dark ink (dark text on light imagery).
  if (normalized === "/") return "dark";
  return "dark";
}

function normalizePath(pathname: string | null) {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}

const MENU_CLOSE_DELAY_MS = 200;
const MENU_EXIT_MS = 260;

const NAV_LABEL_ALIASES: Record<string, string> = {
  "Our Franchise": "Global Products"
};

function resolveNavigationItem(item: NavigationNode, menuByLabel: Map<string, EnterpriseMenuConfig>): NavigationNode {
  const label = NAV_LABEL_ALIASES[item.label] ?? item.label;
  const menu = menuByLabel.get(label);
  const resolved = label === item.label ? item : { ...item, label };
  if (!menu) return resolved;
  return { ...resolved, href: menu.href };
}

function getFeaturedCard(menu: MegaMenuConfig, featureKey: string | undefined) {
  return menu.featured.find((card) => card.key === featureKey) ?? menu.featured.find((card) => card.key === menu.defaultFeatureKey) ?? menu.featured[0];
}

export function StoreNav({
  navigationItems = [],
  enterpriseMenuConfigs = [],
  onSearchIntent
}: {
  navigationItems?: NavigationNode[];
  enterpriseMenuConfigs?: EnterpriseMenuConfig[];
  onSearchIntent?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const overlay = useUiStore((state) => state.overlay);
  const setOverlay = useUiStore((state) => state.setOverlay);
  const mobileMenuOpen = overlay === "mobile-menu";
  const normalizedPathname = useMemo(() => normalizePath(pathname), [pathname]);
  const { tone, style } = useAdaptiveNavbarTone(getInitialNavbarTone(normalizedPathname));
  const enterpriseMenuByLabel = useMemo(
    () => new Map(enterpriseMenuConfigs.map((menu) => [menu.label, menu])),
    [enterpriseMenuConfigs]
  );
  const enterpriseMenuByKey = useMemo(
    () => new Map(enterpriseMenuConfigs.map((menu) => [menu.key, menu])),
    [enterpriseMenuConfigs]
  );
  const displayedNavigationItems = useMemo(
    () => navigationItems.map((item) => resolveNavigationItem(item, enterpriseMenuByLabel)),
    [navigationItems, enterpriseMenuByLabel]
  );
  const [activeMenuKey, setActiveMenuKey] = useState<string | null>(null);
  const [renderedMenuKey, setRenderedMenuKey] = useState<string | null>(null);
  const [featuredByMenu, setFeaturedByMenu] = useState<Record<string, string>>({});
  const closeTimerRef = useRef<number | null>(null);
  const prefetchDebounceRef = useRef<Map<string, number>>(new Map());
  const activeNavIndex = useMemo(() => {
    return displayedNavigationItems.findIndex((item) => {
      const menu = enterpriseMenuByLabel.get(item.label);
      const legacyHref = catalogCategoryDefinitions.find((definition) => definition.label === item.label)?.legacyHref;
      const hrefs = [item.href, menu?.href, legacyHref].filter((href): href is string => Boolean(href));
      return hrefs.some((href) => {
        if (!href.startsWith("/")) return false;
        if (href === "/") return normalizedPathname === "/";
        return normalizedPathname === href || normalizedPathname.startsWith(`${href}/`);
      });
    });
  }, [displayedNavigationItems, enterpriseMenuByLabel, normalizedPathname]);

  const prefetchRoute = useCallback((href: string) => {
    if (!href.startsWith("/")) return;
    router.prefetch(href);
  }, [router]);

  const debouncedPrefetchRoute = useCallback((href: string) => {
    if (!href.startsWith("/")) return;
    const existing = prefetchDebounceRef.current.get(href);
    if (existing) window.clearTimeout(existing);
    const timerId = window.setTimeout(() => {
      prefetchDebounceRef.current.delete(href);
      router.prefetch(href);
    }, 80);
    prefetchDebounceRef.current.set(href, timerId);
  }, [router]);

  const preloadSearchOverlay = useCallback(() => {
    onSearchIntent?.();
    void import("@/components/overlays/search-overlay").catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Search overlay preload failed", error);
      }
    });
  }, [onSearchIntent]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openEnterpriseMenu = useCallback((menuKey: string) => {
    clearCloseTimer();
    setRenderedMenuKey(menuKey);
    setActiveMenuKey(menuKey);
  }, [clearCloseTimer]);

  const scheduleEnterpriseMenuClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setActiveMenuKey(null);
    }, MENU_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const closeEnterpriseMenu = useCallback(() => {
    clearCloseTimer();
    setActiveMenuKey(null);
  }, [clearCloseTimer]);

  const setFeaturedCard = useCallback((menuKey: string, featureKey: string | undefined) => {
    if (!featureKey) return;
    setFeaturedByMenu((current) => {
      if (current[menuKey] === featureKey) return current;
      return { ...current, [menuKey]: featureKey };
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;

    const routes = displayedNavigationItems
      .map((item) => item.href)
      .filter((href) => href.startsWith("/") && href !== normalizedPathname);
    const primaryRoute = routes[0];
    if (!primaryRoute) return;

    const runWhenIdle = (callback: () => void, timeout = 900) => {
      if ("requestIdleCallback" in window) {
        return window.requestIdleCallback(callback, { timeout });
      }

      callback();
      return undefined;
    };

    let secondaryIdleId: number | undefined;
    const primaryTimer = window.setTimeout(() => {
      prefetchRoute(primaryRoute);
    }, 550);
    const secondaryTimer = window.setTimeout(() => {
      secondaryIdleId = runWhenIdle(() => {
        for (const href of routes.slice(1, 4)) {
          prefetchRoute(href);
        }
      }, 1200);
    }, 2600);

    return () => {
      window.clearTimeout(primaryTimer);
      window.clearTimeout(secondaryTimer);
      if (secondaryIdleId !== undefined) {
        window.cancelIdleCallback(secondaryIdleId);
      }
    };
  }, [displayedNavigationItems, normalizedPathname, prefetchRoute]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
      for (const timerId of prefetchDebounceRef.current.values()) {
        window.clearTimeout(timerId);
      }
      prefetchDebounceRef.current.clear();
    };
  }, [clearCloseTimer]);

  useEffect(() => {
    if (activeMenuKey || !renderedMenuKey) return;

    const hideTimer = window.setTimeout(() => {
      setRenderedMenuKey(null);
    }, MENU_EXIT_MS);

    return () => window.clearTimeout(hideTimer);
  }, [activeMenuKey, renderedMenuKey]);

  const renderedMenu = renderedMenuKey ? enterpriseMenuByKey.get(renderedMenuKey) : undefined;

  return (
    <div
      className="TOP_NAVBAR adaptive-navbar absolute left-0 top-0 z-[999] w-full"
      style={{
        ...style,
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999
      }}
      data-nav-state="adaptive"
      data-nav-ink={tone}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleEnterpriseMenuClose}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        scheduleEnterpriseMenuClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          closeEnterpriseMenu();
        }
      }}
    >
      <div className="mithron-topbar" data-testid="mithron-topbar">
        <div className="mithron-topbar__inner">
          <nav className="mithron-topbar__links" aria-label="Mithron utility navigation">
            <Link href="/" className="mithron-topbar__link">mithron.com</Link>
            <Link href="/contact" className="mithron-topbar__link">Support</Link>
            <Link href="/products" className="mithron-topbar__link mithron-topbar__more">
              Browse products <ChevronDown className="size-3" aria-hidden="true" />
            </Link>
          </nav>
          <p className="mithron-topbar__announcement">
            Drone Care, spares, and training paths are available now.
            <Link href="/product/mithron-care-plus" className="mithron-topbar__announcement-link">
              Explore Mithron Care
            </Link>
          </p>
          <div className="mithron-topbar__locale" aria-label="Store region and currency">
            <Globe2 className="size-3.5" aria-hidden="true" />
            <span>India (English / â‚¹ INR)</span>
          </div>
        </div>
      </div>
      <header className="adaptive-navbar__bar relative h-[62px] font-[var(--type-ui)] md:h-[66px]">
        <div className="relative z-10 mx-auto grid h-full w-full max-w-[1680px] grid-cols-[auto_1fr_auto] items-center pl-2 pr-4 md:pl-3 md:pr-8 lg:pl-5 lg:pr-[clamp(2.5rem,6.4vw,7.5rem)]">
          <div className="flex items-center gap-3 justify-self-start md:gap-2.5">
            <Link href="/" aria-label="Go to Mithron home" className="adaptive-navbar__brand nav-interactive inline-flex shrink-0 items-center text-current">
              <MithronBrandMark />
              <span className="sr-only">Mithron</span>
            </Link>
            <button
              type="button"
              className="adaptive-navbar__icon adaptive-navbar__menu-toggle nav-interactive nav-interactive--subtle -mr-0.5 flex size-10 items-center justify-center rounded-full text-current lg:hidden"
              aria-label="Open menu"
              onClick={() => setOverlay("mobile-menu")}
            >
              <Menu className="size-[21px]" />
            </button>
          </div>

          <nav className="absolute left-1/2 top-1/2 z-[1] hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-4 whitespace-nowrap lg:flex xl:gap-7 2xl:gap-8">
            {displayedNavigationItems.map((item, index) => {
              const isActive = activeNavIndex === index;
              const menu = enterpriseMenuByLabel.get(item.label);
              const isMenuActive = menu ? activeMenuKey === menu.key : false;
              const menuId = menu ? `enterprise-menu-${menu.key}` : undefined;
              return (
                <div key={item.label} onPointerEnter={() => menu && openEnterpriseMenu(menu.key)}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    aria-haspopup={menu ? "true" : undefined}
                    aria-expanded={menu ? isMenuActive : undefined}
                    aria-controls={menuId}
                    onPointerEnter={() => {
                      if (menu) openEnterpriseMenu(menu.key);
                    }}
                    className={`adaptive-navbar__link type-nav nav-interactive group relative inline-flex h-10 items-center whitespace-nowrap text-current ${isActive ? "is-active" : ""}`}
                  >
                    <span className="adaptive-navbar__label relative z-[1]">{item.label}</span>
                    {menu ? <ChevronDown className={`ml-1.5 size-3.5 transition-transform duration-[220ms] ease-[var(--ease-cinematic)] ${isMenuActive ? "rotate-180" : ""}`} aria-hidden="true" /> : null}
                    <span aria-hidden="true" className="adaptive-navbar__underline pointer-events-none absolute bottom-[3px] left-0 h-px w-full origin-center" />
                  </Link>
                </div>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center justify-end gap-1.5 justify-self-end md:gap-2.5">
            <button
              className="adaptive-navbar__icon nav-interactive nav-interactive--subtle inline-flex size-10 items-center justify-center rounded-full text-current"
              aria-label="Search Mithron systems"
              type="button"
              onFocus={preloadSearchOverlay}
              onClick={() => setOverlay("search")}
              onPointerDown={preloadSearchOverlay}
              onPointerEnter={preloadSearchOverlay}
            >
              <Search className="size-[18px]" />
            </button>
            <CartNavButton />
            {!isStorefrontGuestOnly() ? (
              <Link
                href="/account"
                aria-label="Account"
                className="adaptive-navbar__icon nav-interactive nav-interactive--subtle inline-flex size-10 items-center justify-center rounded-full text-current"
              >
                <UserRound className="size-[18px]" />
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      {renderedMenu ? (
        <EnterpriseMenuPanel
          menu={renderedMenu}
          open={activeMenuKey === renderedMenu.key}
          featuredKey={featuredByMenu[renderedMenu.key]}
          onFeatureIntent={(featureKey) => setFeaturedCard(renderedMenu.key, featureKey)}
          onRouteIntent={debouncedPrefetchRoute}
          onClose={closeEnterpriseMenu}
        />
      ) : null}
      <MobileMenu
        navigationItems={displayedNavigationItems}
        open={mobileMenuOpen}
        onClose={() => setOverlay(null)}
        onSearch={() => setOverlay("search")}
        onSearchIntent={preloadSearchOverlay}
      />
    </div>
  );
}

function EnterpriseMenuPanel({
  menu,
  open,
  featuredKey,
  onFeatureIntent,
  onRouteIntent,
  onClose
}: {
  menu: EnterpriseMenuConfig;
  open: boolean;
  featuredKey?: string;
  onFeatureIntent: (featureKey: string | undefined) => void;
  onRouteIntent: (href: string) => void;
  onClose: () => void;
}) {
  if (menu.type === "compact") {
    return (
      <div
        id={`enterprise-menu-${menu.key}`}
        role="region"
        aria-label={`${menu.label} dropdown`}
        aria-hidden={!open}
        className={`enterprise-mega-menu-shell enterprise-mega-menu-shell--compact ${open ? "is-open" : ""}`}
      >
        <div className="enterprise-mega-menu enterprise-mega-menu--compact">
          <p className="enterprise-mega-menu__eyebrow">{menu.eyebrow}</p>
          <div className="enterprise-compact-menu__grid">
            {menu.items.map((item) => (
              <EnterpriseMenuLink
                key={item.label}
                item={item}
                interactive={open}
                onRouteIntent={onRouteIntent}
                onFeatureIntent={onFeatureIntent}
                onClose={onClose}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (menu.type === "franchise") {
    return (
      <div
        id={`enterprise-menu-${menu.key}`}
        role="region"
        aria-label={`${menu.label} dropdown`}
        aria-hidden={!open}
        className={`enterprise-mega-menu-shell enterprise-mega-menu-shell--franchise ${open ? "is-open" : ""}`}
      >
        <div className="enterprise-mega-menu enterprise-mega-menu--franchise">
          <div className="enterprise-franchise-menu__copy">
            <p className="enterprise-mega-menu__eyebrow">{menu.eyebrow}</p>
            <h2>{menu.headline}</h2>
            <p>{menu.body}</p>
            <div className="enterprise-franchise-menu__links">
              {menu.items.map((item) => (
                <EnterpriseMenuLink
                  key={item.label}
                  item={item}
                  interactive={open}
                  onRouteIntent={onRouteIntent}
                  onFeatureIntent={onFeatureIntent}
                  onClose={onClose}
                />
              ))}
            </div>
          </div>
          <EnterpriseFeaturedCard card={menu.card} interactive={open} onRouteIntent={onRouteIntent} onClose={onClose} />
        </div>
      </div>
    );
  }

  const feature = getFeaturedCard(menu, featuredKey);
  if (!feature) return null;

  return (
    <div
      id={`enterprise-menu-${menu.key}`}
      role="region"
      aria-label={`${menu.label} mega menu`}
      aria-hidden={!open}
      className={`enterprise-mega-menu-shell ${open ? "is-open" : ""}`}
    >
      <div className="enterprise-mega-menu" data-menu-kind="mega">
        <div className="enterprise-mega-menu__column">
          <p className="enterprise-mega-menu__eyebrow">{menu.eyebrow}</p>
          <h2>{menu.columnOneTitle}</h2>
          <div className="enterprise-mega-menu__links">
            {menu.columnOne.map((item) => (
              <EnterpriseMenuLink
                key={item.label}
                item={item}
                interactive={open}
                onRouteIntent={onRouteIntent}
                onFeatureIntent={onFeatureIntent}
                onClose={onClose}
              />
            ))}
          </div>
        </div>

        <div className="enterprise-mega-menu__column">
          <p className="enterprise-mega-menu__eyebrow">Mission paths</p>
          <h2>{menu.columnTwoTitle}</h2>
          <div className="enterprise-mega-menu__links">
            {menu.columnTwo.map((item) => (
              <EnterpriseMenuLink
                key={item.label}
                item={item}
                interactive={open}
                onRouteIntent={onRouteIntent}
                onFeatureIntent={onFeatureIntent}
                onClose={onClose}
              />
            ))}
          </div>
        </div>

        <EnterpriseFeaturedCard card={feature} interactive={open} onRouteIntent={onRouteIntent} onClose={onClose} />
      </div>
    </div>
  );
}

function EnterpriseMenuLink({
  item,
  interactive,
  onFeatureIntent,
  onRouteIntent,
  onClose
}: {
  item: EnterpriseMenuOption;
  interactive: boolean;
  onFeatureIntent: (featureKey: string | undefined) => void;
  onRouteIntent: (href: string) => void;
  onClose: () => void;
}) {
  return (
    <Link
      href={item.href}
      prefetch={false}
      tabIndex={interactive ? undefined : -1}
      className="enterprise-mega-menu__link"
      onFocus={() => {
        onFeatureIntent(item.featureKey);
        onRouteIntent(item.href);
      }}
      onPointerEnter={() => {
        onFeatureIntent(item.featureKey);
        onRouteIntent(item.href);
      }}
      onClick={onClose}
    >
      <span>{item.label}</span>
      <ArrowRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}

function EnterpriseFeaturedCard({
  card,
  interactive,
  onRouteIntent,
  onClose
}: {
  card: FeaturedMenuCard;
  interactive: boolean;
  onRouteIntent: (href: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="enterprise-feature-card">
      <div className="enterprise-feature-card__media" aria-hidden="true">
        <MithronCardImage
          src={card.image}
          alt=""
          fill
          sizes="(max-width: 1200px) 30vw, 360px"
          className="object-contain"
        />
      </div>
      <div className="enterprise-feature-card__body">
        <p className="enterprise-mega-menu__eyebrow">{card.eyebrow}</p>
        <h3>{card.name}</h3>
        <p>{card.body}</p>
        <dl className="enterprise-feature-card__specs">
          {card.specs.map((spec) => (
            <div key={`${card.key}-${spec.label}`}>
              <dt>{spec.label}</dt>
              <dd>{spec.value}</dd>
            </div>
          ))}
        </dl>
        <Link
          href={card.href}
          prefetch={false}
          tabIndex={interactive ? undefined : -1}
          className="enterprise-feature-card__cta"
          onFocus={() => onRouteIntent(card.href)}
          onPointerEnter={() => onRouteIntent(card.href)}
          onClick={onClose}
        >
          {card.ctaLabel}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <span className="sr-only">{card.imageAlt}</span>
    </div>
  );
}

function MithronBrandMark() {
  const src = resolveBrandMarkSrc();
  return (
    <span aria-hidden="true" className="mithron-brand-mark relative inline-flex h-[22px] w-auto max-w-[108px] shrink-0 items-center md:h-[26px] md:max-w-[128px]">
      <Image
        src={src}
        alt="Mithron"
        width={925}
        height={111}
        className="block h-full w-auto max-w-full object-contain object-left"
        priority
        unoptimized
      />
    </span>
  );
}

function MobileMenu({
  navigationItems,
  open,
  onClose,
  onSearch,
  onSearchIntent
}: {
  navigationItems: NavigationNode[];
  open: boolean;
  onClose: () => void;
  onSearch: () => void;
  onSearchIntent?: () => void;
}) {
  return (
    <>
      <button
        aria-label="Close navigation menu"
        className={`adaptive-mobile-menu__backdrop fixed inset-0 z-[995] cursor-default bg-black/45 ${open ? "is-open" : ""}`}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div
        data-testid="mobile-menu"
        aria-hidden={!open}
        className={`adaptive-mobile-menu fixed inset-x-4 top-[104px] z-[1000] overflow-hidden rounded-[20px] border p-4 md:top-[110px] lg:hidden ${open ? "is-open" : ""}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="adaptive-mobile-menu__label text-[11px] font-medium uppercase tracking-[0.14em]">Navigation</p>
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label="Close menu"
            className="adaptive-mobile-menu__control nav-interactive nav-interactive--subtle rounded-full p-2"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <ul className="space-y-1.5">
          {navigationItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                tabIndex={open ? 0 : -1}
                onClick={onClose}
                className="adaptive-mobile-menu__link nav-interactive inline-flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-[13px] font-medium tracking-[0.01em]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            onFocus={onSearchIntent}
            onPointerDown={onSearchIntent}
            onPointerEnter={onSearchIntent}
            onClick={() => {
              onClose();
              onSearch();
            }}
            className="adaptive-mobile-menu__action nav-interactive inline-flex h-11 items-center justify-center rounded-full border"
            aria-label="Search"
          >
            <Search className="size-[18px]" />
          </button>
          {!isStorefrontGuestOnly() ? (
            <Link
              href="/account"
              tabIndex={open ? 0 : -1}
              onClick={onClose}
              className="adaptive-mobile-menu__action nav-interactive inline-flex h-11 items-center justify-center rounded-full border"
              aria-label="Account"
            >
              <UserRound className="size-[18px]" />
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}
