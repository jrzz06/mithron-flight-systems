"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  FileText,
  Gauge,
  Images,
  LayoutDashboard,
  LineChart,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  type LucideIcon
} from "lucide-react";
import type { PlatformNavGroup, PlatformNavIconKey } from "@/components/platform/types";

const iconByKey: Record<PlatformNavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  products: Package,
  orders: ShoppingCart,
  inventory: Boxes,
  media: Images,
  cms: FileText,
  users: Users,
  settings: Settings,
  operations: ClipboardList,
  reports: LineChart,
  suppliers: Users,
  enquiries: Bell,
  audit: BarChart3,
  gauge: Gauge,
  truck: Truck,
  fulfillment: ClipboardList,
  history: BarChart3,
  returns: Package
};

function isActivePath(pathname: string, href: string) {
  const baseHref = href.split("#")[0] || href;
  if (baseHref === "/") return pathname === "/";
  if (baseHref === "/admin") return pathname === "/admin";
  if (baseHref === "/supplier") return pathname === "/supplier";
  if (baseHref === "/warehouse/dashboard") return pathname === "/warehouse/dashboard" || pathname === "/warehouse";
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

type PlatformNavProps = {
  groups: PlatformNavGroup[];
  accentClass?: string;
  dataAttribute?: string;
};

export function PlatformNav({ groups, dataAttribute = "data-platform-nav" }: PlatformNavProps) {
  const pathname = usePathname();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(groups.filter((group) => group.defaultCollapsed).map((group) => [group.label, true]))
  );

  return (
    <div className="grid gap-5">
      <nav {...{ [dataAttribute]: true }} data-admin-nav className="grid gap-4">
        {groups.map((group) => {
          const isCollapsed = collapsedGroups[group.label] ?? false;
          const hasActiveItem = group.items.some((item) => isActivePath(pathname, item.href));

          return (
          <div key={group.label} className="grid gap-0.5">
            <button
              type="button"
              onClick={() => {
                if (!group.defaultCollapsed) return;
                setCollapsedGroups((current) => ({
                  ...current,
                  [group.label]: !isCollapsed
                }));
              }}
              className={`flex w-full items-center justify-between px-2.5 pb-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] ${
                group.defaultCollapsed ? "text-[var(--platform-text-muted)] hover:text-[var(--platform-text-secondary)]" : "text-[var(--platform-text-muted)]"
              }`}
              aria-expanded={group.defaultCollapsed ? !isCollapsed : true}
            >
              <span>{group.label}</span>
              {group.defaultCollapsed ? (
                <span className="text-[9px] font-medium normal-case tracking-normal text-[var(--platform-text-muted)]">
                  {isCollapsed && !hasActiveItem ? "Show" : "Hide"}
                </span>
              ) : null}
            </button>
            {group.defaultCollapsed && isCollapsed && !hasActiveItem ? null : group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon ? iconByKey[item.icon] : null;
              return (
                <Link
                  key={`${group.label}-${item.href}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-9 items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--platform-accent)]/30 ${
                    active
                      ? "bg-[var(--platform-nav-active-bg)] text-[var(--platform-text-primary)]"
                      : "text-[var(--platform-text-secondary)] hover:bg-[var(--platform-surface-muted)] hover:text-[var(--platform-text-primary)]"
                  }`}
                >
                  {active ? (
                    <span
                      className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-[var(--platform-accent)]"
                      aria-hidden="true"
                    />
                  ) : null}
                  {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" /> : null}
                  <span className="flex-1">{item.label}</span>
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span className="rounded-md bg-[var(--platform-warning-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--platform-warning)]">
                      {item.badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        );
        })}
      </nav>
      <form action="/auth/logout" method="post" className="px-1 pb-1">
        <button
          type="submit"
          className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-[13px] font-medium text-[var(--platform-text-secondary)] transition-colors hover:bg-[var(--platform-surface-muted)] hover:text-[var(--platform-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--platform-accent)]/30"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
}
