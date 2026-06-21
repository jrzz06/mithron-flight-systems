"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes, Gauge, LogOut, PackagePlus, PackageSearch } from "lucide-react";
import { OperatorToastBridge } from "@/components/admin/operator-toast-bridge";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SupplierFeedbackDialog } from "@/components/supplier/supplier-feedback-dialog";
import { shellFocusRing, shellNavLinkBase } from "@/lib/ui/focus-classes";

const supplierNav = [
  { label: "Dashboard", href: "/supplier", icon: Gauge },
  { label: "My Products", href: "/supplier/products", icon: PackageSearch },
  { label: "Add Product", href: "/supplier/products/new", icon: PackagePlus },
  { label: "Inventory", href: "/supplier/inventory", icon: Boxes }
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SupplierFrame({ children, recipientId }: { children: React.ReactNode; recipientId?: string }) {
  const pathname = usePathname();

  return (
    <>
      <OperatorToastBridge />
      <SupplierFeedbackDialog />
      <div data-supplier-frame data-control-plane data-control-plane-scope="supplier" data-control-plane-theme="dark" className="min-h-screen bg-[#070B14] text-slate-100 md:grid md:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#0A101A] px-3 py-3 md:h-screen md:border-b-0 md:border-r md:py-5">
        <div className="flex items-center justify-between gap-3 px-2 md:block">
          <Link href="/supplier" className="font-[var(--type-display)] text-sm font-semibold uppercase tracking-[0.16em] text-slate-100">
            MITHRON
          </Link>
          <div className="flex items-center gap-2">
            {recipientId ? <NotificationBell href="/supplier" recipientId={recipientId} /> : null}
            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200">
              Supplier
            </span>
          </div>
        </div>

        <nav aria-label="Supplier navigation" className="mt-4 flex gap-2 overflow-x-auto pb-1 md:grid md:overflow-visible md:pb-0">
          {supplierNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${shellNavLinkBase} ${shellFocusRing} ${
                  active ? "bg-violet-400/12 text-violet-300" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
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

        <main className="min-w-0 px-4 py-5 md:px-6">{children}</main>
      </div>
    </>
  );
}
