"use client";

import Link from "next/link";
import { CartNavButton } from "@/components/navigation/cart-nav-button";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Globe2, Menu, Search, UserRound, X } from "lucide-react";
import { useAdaptiveNavbarTone } from "@/hooks/use-adaptive-navbar-tone";
import { normalizeStorefrontPath, resolveInitialNavbarTone } from "@/lib/navbar-ink-sampling";
import { MithronCardImage } from "@/components/media/mithron-card-image";
import { MithronBrandMark } from "@/components/brand/mithron-brand-mark";
import { EditorRenderedHtml } from "@/components/editor/editor-rendered-html";
import type { NavigationNode } from "@/config/types";
import type { EnterpriseMenuConfig, EnterpriseMenuOption, FeaturedMenuCard, MegaMenuConfig } from "@/lib/nav-menu-types";
import { catalogCategoryDefinitions, ACCESSORIES_CATALOG_HREF } from "@/lib/catalog-categories";
import { isStorefrontGuestOnly } from "@/lib/storefront/guest-demo";
import { useUiStore } from "@/store/ui";

const MENU_CLOSE_DELAY_MS = 200;
const MENU_EXIT_MS = 260;
const NAV_PRIMARY_COUNT = 4;
const NAV_DESKTOP_PREFETCH_MIN_WIDTH = 800;

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

function shouldSkipAggressivePrefetch() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (connection?.saveData) return true;
  if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2) return true;
  return false;
}

function getFeaturedCard(menu: MegaMenuConfig, featureKey: string | undefined) {
  return menu.featured.find((card) => card.key === featureKey) ?? menu.featured.find((card) => card.key === menu.defaultFeatureKey) ?? menu.featured[0];
}

export function StoreNav({
  navigationItems = [],
  enterpriseMenuConfigs = [],
  onSearchIntent,
  variant = "default"
}: {
  navigationItems?: NavigationNode[];
  enterpriseMenuConfigs?: EnterpriseMenuConfig[];
  onSearchIntent?: () => void;
  variant?: "default" | "login";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const overlay = useUiStore((state) => state.overlay);
  const setOverlay = useUiStore((state) => state.setOverlay);
  const mobileMenuOpen = overlay === "mobile-menu";
  const normalizedPathname = useMemo(() => normalizeStorefrontPath(pathname), [pathname]);
  const initialNavbarTone = useMemo(() => resolveInitialNavbarTone(normalizedPathname), [normalizedPathname]);
  const { tone, style } = useAdaptiveNavbarTone(initialNavbarTone);
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
    void fetch("/api/catalog/search?intent=index").catch((error: unknown) => {
      if (process.env.NODE_ENV !== "production") {
        console.error("Search index preload failed", error);
      }
    });
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
    if (!window.matchMedia(`(min-width: ${NAV_DESKTOP_PREFETCH_MIN_WIDTH}px)`).matches) return;
    if (shouldSkipAggressivePrefetch()) return;

    const routes = displayedNavigationItems
      .map((item) => item.href)
      .filter((href) => href.startsWith("/") && href !== normalizedPathname);
    const primaryRoute = routes[0];
    if (!primaryRoute) return;

    const runWhenIdle = (callback: () => void, timeout = 3000): number => {
      const scheduleIdle = window.requestIdleCallback;
      if (typeof scheduleIdle === "function") {
        return scheduleIdle.call(window, callback, { timeout });
      }

      return window.setTimeout(callback, timeout);
    };

    let secondaryIdleId: number | undefined;
    const primaryIdleId = runWhenIdle(() => {
      prefetchRoute(primaryRoute);
    }, 3000);
    const secondaryTimer = window.setTimeout(() => {
      secondaryIdleId = runWhenIdle(() => {
        for (const href of routes.slice(1, 4)) {
          prefetchRoute(href);
        }
      }, 3000);
    }, 2600);

    return () => {
      if (typeof secondaryIdleId === "number") {
        const cancelIdle = window.cancelIdleCallback;
        if (typeof cancelIdle === "function") {
          cancelIdle.call(window, secondaryIdleId);
        } else {
          window.clearTimeout(secondaryIdleId);
        }
      }
      const cancelIdle = window.cancelIdleCallback;
      if (typeof cancelIdle === "function") {
        cancelIdle.call(window, primaryIdleId);
      } else {
        window.clearTimeout(primaryIdleId);
      }
      window.clearTimeout(secondaryTimer);
    };
  }, [displayedNavigationItems, normalizedPathname, prefetchRoute]);

  useEffect(() => {
    const debounceTimers = prefetchDebounceRef.current;
    return () => {
      clearCloseTimer();
      for (const timerId of debounceTimers.values()) {
        window.clearTimeout(timerId);
      }
      debounceTimers.clear();
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

  const isLoginNav = variant === "login";

  return (
    <div
      className="TOP_NAVBAR adaptive-navbar left-0 top-0 z-[999] w-full max-[767px]:sticky min-[768px]:absolute"
      style={style}
      data-nav-state="adaptive"
      data-nav-ink={tone}
      data-nav-variant={variant}
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
      {!isLoginNav ? (
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
              <Link href={ACCESSORIES_CATALOG_HREF} className="mithron-topbar__announcement-link">
                Explore Drone Care
              </Link>
            </p>
            <div className="mithron-topbar__locale" aria-label="Store region and currency">
              <Globe2 className="size-3.5" aria-hidden="true" />
              <span>India (English / ₹ INR)</span>
            </div>
          </div>
        </div>
      ) : null}
      <header className="adaptive-navbar__bar relative h-16 font-[var(--type-ui)] md:h-[66px]">
        <div className="adaptive-navbar__inner relative z-10 mx-auto grid h-full w-full max-w-[1680px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 pl-2 pr-4 md:pl-3 md:pr-8 lg:pl-5 lg:pr-[clamp(2.5rem,6.4vw,7.5rem)]">
          <div className="flex min-w-0 items-center justify-self-start md:gap-2.5">
            <Link href="/" aria-label="Go to Mithron home" className="adaptive-navbar__brand nav-interactive inline-flex shrink-0 items-center text-current">
              <MithronBrandMark priority />
              <span className="sr-only">Mithron</span>
            </Link>
          </div>

          <div className="adaptive-navbar__nav-cluster flex min-w-0 items-center justify-center overflow-hidden">
            <nav
              className="nav-desktop-links min-w-0 items-center justify-center whitespace-nowrap"
              aria-label="Primary storefront navigation"
            >
              {displayedNavigationItems.map((item, index) => {
                const priority = index < NAV_PRIMARY_COUNT ? "primary" : "secondary";
                return (
                  <NavLinkItem
                    key={item.label}
                    item={item}
                    index={index}
                    activeNavIndex={activeNavIndex}
                    enterpriseMenuByLabel={enterpriseMenuByLabel}
                    activeMenuKey={activeMenuKey}
                    priority={priority}
                    onOpenEnterpriseMenu={openEnterpriseMenu}
                  />
                );
              })}
            </nav>
            <NavMoreMenu
              items={displayedNavigationItems.slice(NAV_PRIMARY_COUNT)}
              activeNavIndex={activeNavIndex}
              primaryOffset={NAV_PRIMARY_COUNT}
              onCloseEnterpriseMenu={closeEnterpriseMenu}
            />
          </div>

          <div className="flex shrink-0 items-center justify-end gap-1 justify-self-end md:gap-2.5">
            {!isLoginNav ? (
              <>
                <button
                  className="adaptive-navbar__icon nav-interactive nav-interactive--subtle inline-flex size-11 items-center justify-center rounded-full text-current"
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
                    className="adaptive-navbar__icon nav-interactive nav-interactive--subtle inline-flex size-11 items-center justify-center rounded-full text-current"
                  >
                    <UserRound className="size-[18px]" />
                  </Link>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              className="adaptive-navbar__icon adaptive-navbar__menu-toggle nav-interactive nav-interactive--subtle nav-hamburger flex size-11 items-center justify-center rounded-full text-current"
              aria-label="Open menu"
              onClick={() => setOverlay("mobile-menu")}
            >
              <Menu className="size-[18px]" />
            </button>
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
        onSearch={isLoginNav ? undefined : () => setOverlay("search")}
        onSearchIntent={isLoginNav ? undefined : preloadSearchOverlay}
      />
    </div>
  );
}

function NavLinkItem({
  item,
  index,
  activeNavIndex,
  enterpriseMenuByLabel,
  activeMenuKey,
  priority,
  onOpenEnterpriseMenu
}: {
  item: NavigationNode;
  index: number;
  activeNavIndex: number;
  enterpriseMenuByLabel: Map<string, EnterpriseMenuConfig>;
  activeMenuKey: string | null;
  priority: "primary" | "secondary";
  onOpenEnterpriseMenu: (menuKey: string) => void;
}) {
  const isActive = activeNavIndex === index;
  const menu = enterpriseMenuByLabel.get(item.label);
  const isMenuActive = menu ? activeMenuKey === menu.key : false;
  const menuId = menu ? `enterprise-menu-${menu.key}` : undefined;

  return (
    <div
      className="adaptive-navbar__link-wrap shrink-0"
      data-nav-priority={priority}
      onPointerEnter={() => menu && onOpenEnterpriseMenu(menu.key)}
    >
      <Link
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        aria-haspopup={menu ? "true" : undefined}
        aria-expanded={menu ? isMenuActive : undefined}
        aria-controls={menuId}
        onPointerEnter={() => {
          if (menu) onOpenEnterpriseMenu(menu.key);
        }}
        className={`adaptive-navbar__link type-nav nav-interactive group relative inline-flex h-10 items-center whitespace-nowrap text-current ${isActive ? "is-active" : ""}`}
      >
        <span className="adaptive-navbar__label relative z-[1]">{item.label}</span>
        {menu ? (
          <ChevronDown
            className={`ml-1.5 size-3.5 transition-transform duration-[220ms] ease-[var(--ease-cinematic)] ${isMenuActive ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        ) : null}
        <span aria-hidden="true" className="adaptive-navbar__underline pointer-events-none absolute bottom-[3px] left-0 h-px w-full origin-center" />
      </Link>
    </div>
  );
}

function NavMoreMenu({
  items,
  activeNavIndex,
  primaryOffset,
  onCloseEnterpriseMenu
}: {
  items: NavigationNode[];
  activeNavIndex: number;
  primaryOffset: number;
  onCloseEnterpriseMenu: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={menuRef} className="nav-more-menu relative shrink-0">
      <button
        type="button"
        className="nav-more-button adaptive-navbar__link type-nav nav-interactive group relative inline-flex h-10 items-center whitespace-nowrap text-current"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="nav-more-dropdown"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="adaptive-navbar__label relative z-[1]">More</span>
        <ChevronDown
          className={`ml-1.5 size-3.5 transition-transform duration-[220ms] ease-[var(--ease-cinematic)] ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        <span aria-hidden="true" className="adaptive-navbar__underline pointer-events-none absolute bottom-[3px] left-0 h-px w-full origin-center" />
      </button>
      <div
        id="nav-more-dropdown"
        role="menu"
        aria-hidden={!open}
        className={`nav-more-dropdown ${open ? "is-open" : ""}`}
      >
        {items.map((item, index) => {
          const navIndex = primaryOffset + index;
          const isActive = activeNavIndex === navIndex;
          return (
            <Link
              key={item.label}
              href={item.href}
              role="menuitem"
              tabIndex={open ? 0 : -1}
              aria-current={isActive ? "page" : undefined}
              className={`nav-more-dropdown__link ${isActive ? "is-active" : ""}`}
              onClick={() => {
                setOpen(false);
                onCloseEnterpriseMenu();
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
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
            <EditorRenderedHtml html={menu.body} className="enterprise-franchise-menu__body" />
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
        <EditorRenderedHtml html={card.body} className="enterprise-feature-card__description" />
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
  onSearch?: () => void;
  onSearchIntent?: () => void;
}) {
  return (
    <>
      <button
        aria-label="Close navigation menu"
        className={`adaptive-mobile-menu__backdrop fixed inset-0 z-[1000] cursor-default bg-black/45 ${open ? "is-open" : ""}`}
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div
        data-testid="mobile-menu"
        aria-hidden={!open}
        className={`adaptive-mobile-menu fixed inset-x-4 top-[calc(var(--store-nav-offset)+8px)] z-[1001] max-h-[calc(100dvh-var(--store-nav-offset)-16px)] overflow-y-auto rounded-[20px] border p-4 md:top-[calc(var(--store-nav-offset)+8px)] ${open ? "is-open" : ""}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="adaptive-mobile-menu__label text-[11px] font-medium uppercase tracking-[0.14em]">Navigation</p>
          <button
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label="Close menu"
            className="adaptive-mobile-menu__control nav-interactive nav-interactive--subtle inline-flex min-h-11 min-w-11 items-center justify-center rounded-full"
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
                className="adaptive-mobile-menu__link nav-interactive inline-flex min-h-11 w-full items-center justify-between rounded-2xl border px-4 py-3.5 text-[14px] font-medium tracking-[0.01em]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        {onSearch ? (
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
        ) : null}
      </div>
    </>
  );
}
