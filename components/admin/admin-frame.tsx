import Link from "next/link";
import { canAccessAdminSection, type AdminSection, type CmsRole } from "@/lib/auth/access-control";
import { AdminNav, type AdminNavIconKey } from "@/components/admin/admin-nav";
import { shellFocusRing } from "@/lib/ui/focus-classes";
import { OperatorToastBridge } from "@/components/admin/operator-toast-bridge";
import { AdminTopbar } from "@/components/admin/admin-topbar";

type AdminFrameProps = {
  role: CmsRole | null;
  userId?: string | null;
  pendingSupplierApprovals?: number;
  children: React.ReactNode;
};

type AdminNavItem = { label: string; href: string; section: AdminSection; icon: AdminNavIconKey; badgeCount?: number };

const navGroups: Array<{ label: string; items: AdminNavItem[] }> = [
  {
    label: "Core",
    items: [
      { label: "Dashboard", href: "/admin", section: "overview", icon: "dashboard" },
      { label: "Products", href: "/admin/products#product-list", section: "products", icon: "products" },
      { label: "Orders", href: "/admin/orders", section: "orders", icon: "orders" },
      { label: "Inventory", href: "/admin/inventory", section: "warehouse", icon: "inventory" }
    ]
  },
  {
    label: "Content",
    items: [
      { label: "Media", href: "/admin/media", section: "media", icon: "media" },
      { label: "CMS", href: "/admin/cms", section: "cms", icon: "cms" }
    ]
  },
  {
    label: "Commerce",
    items: [
      { label: "Suppliers", href: "/admin/suppliers", section: "suppliers", icon: "users" },
      { label: "Supplier approvals", href: "/admin/suppliers/products", section: "suppliers", icon: "products" },
      { label: "Enquiries", href: "/admin/enquiries", section: "enquiries", icon: "orders" },
      { label: "Reports", href: "/admin/reports", section: "reports", icon: "dashboard" }
    ]
  },
  {
    label: "System",
    items: [
      { label: "Users", href: "/admin/users", section: "settings", icon: "users" },
      { label: "Settings", href: "/admin/settings", section: "settings", icon: "settings" }
    ]
  }
];

export function AdminFrame({ role, userId, pendingSupplierApprovals = 0, children }: AdminFrameProps) {
  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => Boolean(role && canAccessAdminSection(role, item.section)))
        .map((item) =>
          item.href === "/admin/suppliers/products"
            ? { ...item, badgeCount: pendingSupplierApprovals }
            : item
        )
    }))
    .filter((group) => group.items.length > 0);
  const visibleItems = visibleGroups.flatMap((group) => group.items.map(({ label, href }) => ({ label, href, group: group.label })));

  return (
    <main data-admin-shell data-control-plane data-control-plane-scope="admin" data-control-plane-theme="dark" data-admin-performance-theme className="min-h-screen bg-[#070B14] text-slate-100">
      <OperatorToastBridge />
      <div className="min-h-screen lg:pl-[228px]">
        <aside className="border-b border-slate-800 bg-[#0A101A] px-4 py-4 shadow-none lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:h-screen lg:w-[228px] lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className={`font-[var(--type-display)] text-sm font-semibold uppercase tracking-[0.14em] text-slate-100 ${shellFocusRing}`}>
              MITHRON
            </Link>
            <div className="rounded-lg border border-slate-800 bg-[#10151d] px-2.5 py-1 text-[11px] font-medium capitalize text-slate-300">
              {role ? role.replace("_", " ") : "Session"}
            </div>
          </div>

          <div className="mt-5">
            <AdminNav groups={visibleGroups.map((group) => ({
              label: group.label,
              items: group.items.map(({ label, href, icon, badgeCount }) => ({ label, href, icon, badgeCount }))
            }))} />
          </div>
        </aside>

        <section className="min-w-0">
          <AdminTopbar role={role} userId={userId ?? undefined} visibleItems={visibleItems} />
          <div data-admin-content className="px-3 py-3 md:px-5 lg:px-6">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
