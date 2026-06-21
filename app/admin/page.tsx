import Link from "next/link";
import { CMS_WORKSPACE_LINKS } from "@/config/cms-workspace";
import { AdminSection, DataList, StatusBadge } from "@/components/admin/module-panel";
import { getAdminDashboardSnapshot } from "@/services/admin";

const quickActions = [
  {
    label: "Create product",
    href: "/admin/products?tool=create#create-product",
    status: "create"
  },
  {
    label: "Archive / restore",
    href: "/admin/products?tool=publish#archive-product",
    status: "protected"
  },
  {
    label: "Review orders",
    href: "/admin/orders",
    status: "orders"
  },
  {
    label: "Upload media",
    href: "/admin/media#upload-media",
    status: "media"
  },
  {
    label: "Edit CMS",
    href: CMS_WORKSPACE_LINKS.root,
    status: "cms"
  },
  {
    label: "Manage users",
    href: "/admin/users",
    status: "rbac"
  }
];

function rowLabel(row: Record<string, unknown>, fallback: string) {
  return String(row.title ?? row.name ?? row.order_number ?? row.slug ?? row.product_slug ?? row.id ?? fallback);
}

function recentRows(rows: Record<string, unknown>[], fallback: string, valueKey = "status", keyPrefix = fallback.toLowerCase()) {
  return rows.slice(0, 5).map((row, index) => ({
    id: `${keyPrefix}-${String(row.id ?? index)}`,
    label: rowLabel(row, `${fallback} ${index + 1}`),
    value: String(row[valueKey] ?? row.status ?? row.workflow_status ?? row.stock_status ?? "open"),
    detail: String(row.updated_at ?? row.created_at ?? row.createdAt ?? "recent")
  }));
}

export default async function AdminPage() {
  const snapshot = await getAdminDashboardSnapshot();
  const lowStockRows = snapshot.data.lowStockAlerts.slice(0, 5).map((row, index) => ({
    id: `low-stock-${String(row.id ?? `${row.product_slug ?? "product"}-${row.sku ?? "sku"}-${index}`)}`,
    label: `${String(row.product_slug ?? "product")} / ${String(row.sku ?? "sku")}`,
    value: String(row.quantity ?? row.stock_status ?? 0),
    detail: `Status ${String(row.stock_status ?? "low_stock")} | reorder ${String(row.reorder_threshold ?? 0)}`
  }));
  const activityRows = [
    ...recentRows(snapshot.data.recentNotifications, "Notification", "status", "notification").slice(0, 3),
    ...recentRows(snapshot.data.recentActivity, "Activity", "action", "activity").slice(0, 3)
  ].slice(0, 5);

  return (
    <div data-admin-dashboard className="grid gap-4">
      <section data-admin-quick-actions data-admin-crud-actions className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.11em] text-slate-500">Dashboard</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Quick actions</h2>
          </div>
          <StatusBadge status={snapshot.status} />
        </div>
        {snapshot.blockedReason ? <p className="mt-3 text-sm leading-6 text-amber-700">{snapshot.blockedReason}</p> : null}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              data-admin-crud-action={action.label.toLowerCase().replaceAll(" ", "-").replaceAll("/", "")}
              className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white"
            >
              <span>{action.label}</span>
              <StatusBadge status={action.status} />
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <AdminSection title="Recent orders">
          <DataList rows={recentRows(snapshot.data.recentOrders, "Order", "order_status", "order")} />
        </AdminSection>

        <AdminSection title="Low stock">
          <DataList rows={lowStockRows.length ? lowStockRows : [{ label: "Inventory", value: "Clear", detail: "No low stock rows returned." }]} />
        </AdminSection>

        <AdminSection title="Activity">
          <DataList rows={activityRows.length ? activityRows : [{ label: "Activity", value: "Clear", detail: "No recent activity rows returned." }]} />
        </AdminSection>
      </section>
    </div>
  );
}
