"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Plus, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { CMS_WORKSPACE_LINKS } from "@/config/cms-workspace";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { PlatformRouteTitle, PlatformSearchItem } from "@/components/platform/types";

type PlatformTopbarProps = {
  role: string | null;
  userId?: string;
  visibleItems: PlatformSearchItem[];
  routeTitles: PlatformRouteTitle[];
  scopeLabel?: string;
  primaryAction?: { label: string; href: string };
  notificationHref?: string;
};

const defaultQuickActions: PlatformSearchItem[] = [
  { label: "Create product", href: "/admin/products?tool=create#create-product", group: "Action" },
  { label: "Create order", href: "/admin/orders#create-order", group: "Action" },
  { label: "Upload media", href: "/admin/media#upload-media", group: "Action" },
  { label: "Edit hero banner", href: CMS_WORKSPACE_LINKS.hero, group: "Action" },
  { label: "Edit category banners", href: CMS_WORKSPACE_LINKS.categoryBanners, group: "Action" }
];

function normalizeRole(role: string | null) {
  return role ? role.replaceAll("_", " ") : "Guest";
}

function titleForPath(pathname: string, routeTitles: PlatformRouteTitle[]) {
  const sorted = [...routeTitles].sort((a, b) => b.href.length - a.href.length);
  return sorted.find((route) => pathname === route.href || pathname.startsWith(`${route.href}/`)) ?? routeTitles.at(-1)!;
}

export function PlatformTopbar({
  role,
  userId,
  visibleItems,
  routeTitles,
  scopeLabel,
  primaryAction = { label: "Add product", href: "/admin/products?tool=create#create-product" },
  notificationHref = "/admin/suppliers/products"
}: PlatformTopbarProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const page = titleForPath(pathname, routeTitles);
  const commandItems = useMemo(() => [...defaultQuickActions, ...visibleItems], [visibleItems]);
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commandItems.slice(0, 7);
    return commandItems
      .filter((item) => `${item.group} ${item.label} ${item.href}`.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [commandItems, query]);

  return (
    <header
      data-admin-topbar
      className="sticky top-0 z-30 border-b border-[var(--platform-border)] bg-[var(--platform-surface)]/95 px-4 py-3 backdrop-blur-sm md:px-6"
      style={{ boxShadow: "var(--platform-shadow-sm)" }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--platform-text-muted)]">{scopeLabel ?? page.kicker}</p>
          <h1 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-[var(--platform-text-primary)] md:text-xl">
            {page.title}
          </h1>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--platform-text-muted)]" aria-hidden="true" />
            <input
              data-admin-command-search
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              placeholder="Search"
              aria-label="Search workspace"
              className="h-9 w-full rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] pl-9 pr-3 text-sm text-[var(--platform-text-primary)] outline-none transition placeholder:text-[var(--platform-text-muted)] focus:border-teal-600/30 focus:bg-[var(--platform-surface)] focus:ring-2 focus:ring-teal-600/10"
            />
            {open ? (
              <div
                className="absolute left-0 right-0 top-10 z-40 overflow-hidden rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface)]"
                style={{ boxShadow: "var(--platform-shadow-md)" }}
              >
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <Link
                      key={`${item.group}-${item.href}-${item.label}`}
                      href={item.href}
                      className="grid gap-0.5 border-b border-[var(--platform-border)] px-3 py-2.5 text-sm text-[var(--platform-text-secondary)] last:border-b-0 hover:bg-[var(--platform-surface-muted)] hover:text-[var(--platform-text-primary)]"
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="text-xs text-[var(--platform-text-muted)]">{item.group}</span>
                    </Link>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-[var(--platform-text-muted)]">No results found.</div>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {primaryAction ? (
              <Link
                href={primaryAction.href}
                className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[var(--platform-accent)] px-3 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                {primaryAction.label}
              </Link>
            ) : null}
            {userId ? (
              <NotificationBell href={notificationHref} recipientId={userId} />
            ) : (
              <Link
                href={notificationHref}
                aria-label="Notifications"
                className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface)] text-[var(--platform-text-muted)] transition hover:bg-[var(--platform-surface-muted)]"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
            <div className="hidden h-9 items-center gap-2 rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-secondary)] md:flex">
              <UserRound className="h-4 w-4 text-[var(--platform-text-muted)]" aria-hidden="true" />
              <span className="max-w-[130px] truncate capitalize">{normalizeRole(role)}</span>
            </div>
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                className="grid h-9 w-9 place-items-center rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface)] text-[var(--platform-text-muted)] transition hover:bg-[var(--platform-surface-muted)]"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
