"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  ArrowLeftRight,
  Boxes,
  ClipboardCheck,
  Gauge,
  History,
  LogOut,
  PackageCheck,
  RotateCcw,
  Send,
  Settings,
  ShoppingCart,
  Truck
} from "lucide-react";
import { shellFocusRing, shellNavLinkBase } from "@/lib/ui/focus-classes";

const warehouseNav = [
  { label: "Dashboard", href: "/warehouse/dashboard", icon: Gauge },
  { label: "Orders", href: "/warehouse/orders", icon: ShoppingCart },
  { label: "Picking Queue", href: "/warehouse/picking", icon: ClipboardCheck },
  { label: "Packing Station", href: "/warehouse/packing", icon: PackageCheck },
  { label: "Dispatch", href: "/warehouse/dispatch", icon: Send },
  { label: "Shipments", href: "/warehouse/shipments", icon: Truck },
  { label: "Movements", href: "/warehouse/movements", icon: History },
  { label: "Inventory", href: "/warehouse/inventory", icon: Boxes },
  { label: "Returns", href: "/warehouse/returns", icon: RotateCcw },
  { label: "Stock Transfers", href: "/warehouse/transfers", icon: ArrowLeftRight },
  { label: "Activity", href: "/warehouse/activity", icon: Activity },
  { label: "Settings", href: "/warehouse/settings", icon: Settings }
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WarehouseFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div data-warehouse-frame data-control-plane data-control-plane-scope="warehouse" data-control-plane-theme="dark" className="min-h-screen bg-[#070B14] text-slate-100 md:grid md:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A101A] px-3 py-3 md:h-screen md:border-b-0 md:border-r md:py-5">
        <div className="flex items-center justify-between gap-3 px-2 md:block">
          <Link href="/warehouse/dashboard" className="font-[var(--type-display)] text-sm font-semibold uppercase tracking-[0.16em] text-slate-100">
            MITHRON
          </Link>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
            Warehouse
          </span>
        </div>

        <nav aria-label="Warehouse navigation" className="mt-4 flex gap-2 overflow-x-auto pb-1 md:grid md:overflow-visible md:pb-0">
          {warehouseNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${shellNavLinkBase} ${shellFocusRing} ${
                  active
                    ? "bg-emerald-400/12 text-emerald-300"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                }`}
              >
                <Icon className="h-4 w-4 text-current" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form action="/auth/logout" method="post" className="mt-4">
          <button type="submit" className={`inline-flex min-h-10 w-full items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-sm font-semibold text-slate-300 transition duration-150 hover:bg-white/[0.04] hover:text-slate-100 ${shellFocusRing}`}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Logout
          </button>
        </form>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
