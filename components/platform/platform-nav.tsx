"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

export function PlatformNav({ groups, accentClass = "bg-teal-50 text-teal-800", dataAttribute = "data-platform-nav" }: PlatformNavProps) {
  const pathname = usePathname();

  return (
    <div className="grid gap-4">
      <nav {...{ [dataAttribute]: true }} data-admin-nav className="grid gap-3">
        {groups.map((group) => (
          <div key={group.label} className="grid gap-0.5">
            <p className="px-2.5 pb-1 text-[11px] font-medium text-[var(--platform-text-muted)]">{group.label}</p>
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon ? iconByKey[item.icon] : null;
              return (
                <Link
                  key={`${group.label}-${item.href}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-9 items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600/40 ${
                    active
                      ? accentClass
                      : "text-[var(--platform-text-secondary)] hover:bg-[var(--platform-surface-muted)] hover:text-[var(--platform-text-primary)]"
                  }`}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" /> : null}
                  <span className="flex-1">{item.label}</span>
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      {item.badgeCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <form action="/auth/logout" method="post">
        <button
          type="submit"
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-[13px] font-medium text-[var(--platform-text-secondary)] transition-colors hover:bg-[var(--platform-surface-muted)] hover:text-[var(--platform-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600/40"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );
}
