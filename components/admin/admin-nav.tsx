"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Boxes, ClipboardList, FileText, Images, LogOut, Package, Settings, Users, type LucideIcon } from "lucide-react";
import { shellFocusRing } from "@/lib/ui/focus-classes";

export type AdminNavIconKey = "dashboard" | "products" | "orders" | "inventory" | "media" | "cms" | "users" | "settings";

const iconByKey: Record<AdminNavIconKey, LucideIcon> = {
  dashboard: BarChart3,
  products: Package,
  orders: ClipboardList,
  inventory: Boxes,
  media: Images,
  cms: FileText,
  users: Users,
  settings: Settings
};

type AdminNavItem = {
  label: string;
  href: string;
  icon?: AdminNavIconKey;
  badgeCount?: number;
};

type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

function isActivePath(pathname: string, href: string) {
  const baseHref = href.split("#")[0] || href;
  if (baseHref === "/") return pathname === "/";
  if (baseHref === "/admin") return pathname === "/admin";
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

export function AdminNav({ groups, items }: { groups?: AdminNavGroup[]; items?: AdminNavItem[] }) {
  const pathname = usePathname();
  const navGroups = groups ?? [{ label: "Admin", items: items ?? [] }];

  return (
    <div className="grid gap-4">
      <nav data-admin-nav className="grid gap-3.5">
        {navGroups.map((group) => (
          <div key={group.label} className="grid gap-1">
            <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{group.label}</p>
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon ? iconByKey[item.icon] : null;
              return (
                <Link
                  key={`${group.label}-${item.href}`}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-9 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors ${shellFocusRing} ${
                    active
                      ? "bg-[#151c26] text-slate-100"
                    : "text-slate-400 hover:bg-[#10151d] hover:text-slate-100"
                  }`}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                  <span className="flex-1">{item.label}</span>
                  {item.badgeCount && item.badgeCount > 0 ? (
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
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
        <button type="submit" className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-[#10151d] px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-[#151c26] hover:text-slate-100 ${shellFocusRing}`}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </button>
      </form>
    </div>
  );
}
