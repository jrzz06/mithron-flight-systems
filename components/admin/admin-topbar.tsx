"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Plus, Search, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { CMS_WORKSPACE_LINKS } from "@/config/cms-workspace";
import { NotificationBell } from "@/components/notifications/notification-bell";

type AdminSearchItem = {
  label: string;
  href: string;
  group: string;
};

type AdminTopbarProps = {
  role: string | null;
  userId?: string;
  visibleItems: AdminSearchItem[];
};

const quickActions: AdminSearchItem[] = [
  { label: "Create product", href: "/admin/products?tool=create#create-product", group: "Action" },
  { label: "Create order", href: "/admin/orders#create-order", group: "Action" },
  { label: "Edit hero banner", href: CMS_WORKSPACE_LINKS.hero, group: "Action" },
  { label: "Edit category banners", href: CMS_WORKSPACE_LINKS.categoryBanners, group: "Action" }
];

const routeTitles: Array<{ href: string; title: string; kicker: string }> = [
  { href: "/admin/products", title: "Products", kicker: "Catalog operations" },
  { href: "/admin/orders", title: "Orders", kicker: "Order workflow" },
  { href: "/admin/inventory", title: "Inventory", kicker: "Stock visibility" },
  { href: "/admin/cms", title: "CMS", kicker: "Content workspace" },
  { href: "/admin/settings", title: "Settings", kicker: "Access and system" },
  { href: "/admin", title: "Dashboard", kicker: "Operational overview" }
];

function normalizeRole(role: string | null) {
  return role ? role.replaceAll("_", " ") : "session";
}

function titleForPath(pathname: string) {
  return routeTitles.find((route) => pathname === route.href || pathname.startsWith(`${route.href}/`)) ?? routeTitles.at(-1)!;
}

export function AdminTopbar({ role, userId, visibleItems }: AdminTopbarProps) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const page = titleForPath(pathname);
  const commandItems = useMemo(() => [...quickActions, ...visibleItems], [visibleItems]);
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
      className="sticky top-0 z-30 -mx-3 border-b border-slate-800 bg-[#0b1017] px-3 py-2.5 shadow-none md:-mx-5 md:px-5 lg:-mx-6 lg:px-6"
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.11em] text-slate-500">{page.kicker}</p>
          <h1 className="mt-0.5 truncate font-[var(--type-display)] text-lg font-semibold tracking-normal text-slate-100 md:text-xl">
            {page.title}
          </h1>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
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
              placeholder="Search routes and actions"
              aria-label="Search admin routes and actions"
              className="h-9 w-full rounded-xl border border-slate-800 bg-[#10151d] pl-9 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-slate-600 focus:bg-[#121a24]"
            />
            {open ? (
              <div className="absolute left-0 right-0 top-10 z-40 overflow-hidden rounded-xl border border-slate-800 bg-[#10151d] shadow-none">
                {filteredItems.length ? (
                  filteredItems.map((item) => (
                    <Link
                      key={`${item.group}-${item.href}-${item.label}`}
                      href={item.href}
                      className="grid gap-0.5 border-b border-slate-800 px-3 py-2.5 text-sm text-slate-300 last:border-b-0 hover:bg-[#151c26] hover:text-slate-100"
                    >
                      <span className="font-medium">{item.label}</span>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{item.group}</span>
                    </Link>
                  ))
                ) : (
                  <div className="px-3 py-3 text-sm text-slate-500">No route actions found.</div>
                )}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/products?tool=create#create-product"
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-700 bg-[#10151d] px-3 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-[#151c26]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add product
            </Link>
            {userId ? (
              <NotificationBell href="/admin/suppliers/products" recipientId={userId} />
            ) : (
              <Link
                href="/admin/suppliers/products"
                aria-label="Notifications"
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-800 bg-[#10151d] text-slate-400 transition hover:bg-[#151c26] hover:text-slate-100"
              >
                <Bell className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
            <div className="hidden h-9 items-center gap-2 rounded-xl border border-slate-800 bg-[#10151d] px-3 text-sm text-slate-300 md:flex">
              <UserRound className="h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="max-w-[130px] truncate capitalize">{normalizeRole(role)}</span>
            </div>
            <form action="/auth/logout" method="post">
              <button
                type="submit"
                aria-label="Logout"
                className="grid h-9 w-9 place-items-center rounded-xl border border-slate-800 bg-[#10151d] text-slate-400 transition hover:bg-[#151c26] hover:text-slate-100"
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
