import Link from "next/link";
import { AdminSection, DataList } from "@/components/admin/module-panel";
import { MetricGrid } from "@/components/platform";
import { connectivityMessage, emptyMessage, humanStatus, relativeTimeLabel } from "@/lib/platform/copy";
import { getAdminDashboardSnapshot } from "@/services/admin";

function rowLabel(row: Record<string, unknown>, fallback: string) {
  return String(row.title ?? row.name ?? row.order_number ?? row.slug ?? row.product_slug ?? row.id ?? fallback);
}

function recentRows(rows: Record<string, unknown>[], fallback: string, valueKey = "status", keyPrefix = fallback.toLowerCase()) {
  return rows.slice(0, 5).map((row, index) => ({
    id: `${keyPrefix}-${String(row.id ?? index)}`,
    label: rowLabel(row, `${fallback} ${index + 1}`),
    value: humanStatus(String(row[valueKey] ?? row.status ?? row.workflow_status ?? row.stock_status ?? "open")),
    detail: relativeTimeLabel(String(row.updated_at ?? row.created_at ?? row.createdAt ?? ""))
  }));
}

export default async function AdminPage() {
  const snapshot = await getAdminDashboardSnapshot();
  const orderCount = snapshot.data.metrics.find((metric) => metric.table === "orders")?.count ?? 0;
  const productCount = snapshot.data.metrics.find((metric) => metric.table === "mithron_products")?.count ?? 0;
  const lowStockCount = snapshot.data.lowStockAlerts.length;
  const notificationCount = snapshot.data.metrics.find((metric) => metric.table === "notifications")?.count ?? 0;

  const lowStockRows = snapshot.data.lowStockAlerts.slice(0, 5).map((row, index) => ({
    id: `low-stock-${String(row.id ?? `${row.product_slug ?? "product"}-${row.sku ?? "sku"}-${index}`)}`,
    label: String(row.product_name ?? row.product_slug ?? "Product"),
    value: humanStatus(String(row.stock_status ?? "low_stock")),
    detail: `SKU ${String(row.sku ?? "—")} · ${String(row.quantity ?? 0)} units`
  }));

  const attentionRows = [
    ...recentRows(snapshot.data.recentOrders.filter((row) => /pending|processing|open/i.test(String(row.order_status ?? row.status ?? ""))), "Order", "order_status", "order").slice(0, 3),
    ...lowStockRows.slice(0, 2)
  ].slice(0, 5);

  const activityRows = [
    ...recentRows(snapshot.data.recentNotifications, "Notification", "status", "notification").slice(0, 3),
    ...recentRows(snapshot.data.recentActivity, "Activity", "action", "activity").slice(0, 3)
  ].slice(0, 5);

  return (
    <div data-admin-dashboard className="grid gap-5">
      {snapshot.blockedReason ? (
        <p className="rounded-[var(--platform-radius)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {connectivityMessage(snapshot.blockedReason)}
        </p>
      ) : null}

      <MetricGrid
        metrics={[
          { label: "Orders", value: String(orderCount), detail: "Total in system" },
          { label: "Products", value: String(productCount), detail: "Active catalog" },
          { label: "Low stock", value: String(lowStockCount), detail: "Items below threshold" },
          { label: "Notifications", value: String(notificationCount), detail: "All time" }
        ]}
      />

      <section data-admin-quick-actions className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <AdminSection title="Needs attention" description="Prioritized items requiring your review.">
          <DataList
            rows={
              attentionRows.length
                ? attentionRows
                : [{ label: "All clear", value: "Nothing urgent", detail: emptyMessage("orders") }]
            }
          />
        </AdminSection>

        <AdminSection title="Quick links">
          <div data-admin-crud-actions className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Create product", href: "/admin/products?tool=create#create-product" },
              { label: "Review orders", href: "/admin/orders" },
              { label: "Upload media", href: "/admin/media#upload-media" },
              { label: "Edit website", href: "/admin/cms" },
              { label: "Review submissions", href: "/admin/suppliers/products" },
              { label: "Manage team", href: "/admin/users" }
            ].map((action) => (
              <Link
                key={action.href}
                href={action.href}
                data-admin-crud-action={action.label.toLowerCase().replaceAll(" ", "-")}
                className="mithron-elevated-card mithron-elevated-card--interactive flex min-h-11 items-center rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 text-sm font-medium text-[var(--platform-text-primary)] transition hover:bg-[var(--platform-surface)]"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </AdminSection>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <AdminSection title="Recent orders">
          <DataList rows={recentRows(snapshot.data.recentOrders, "Order", "order_status", "order")} />
        </AdminSection>
        <AdminSection title="Recent activity">
          <DataList rows={activityRows.length ? activityRows : [{ label: "Activity", value: "Quiet", detail: emptyMessage("activity") }]} />
        </AdminSection>
      </section>
    </div>
  );
}
