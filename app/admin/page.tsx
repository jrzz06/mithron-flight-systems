import Link from "next/link";
import type { ReactNode } from "react";
import { AdminDashboardLiveSync } from "@/components/admin/admin-dashboard-live-sync";
import { StatusPill } from "@/components/platform";
import { connectivityMessage, relativeTimeLabel } from "@/lib/platform/copy";
import { formatDashboardCount, getAdminDashboardSnapshot, listPendingSupplierSubmissions, orderNeedsAdminReview } from "@/services/admin";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";
import { listAdminEnquiries } from "@/services/enquiries";

export const dynamic = "force-dynamic";

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function orderLabel(order: Record<string, unknown>) {
  return text(order.order_number) || text(order.id).slice(0, 8) || "Order";
}

function openEnquiries(enquiries: Awaited<ReturnType<typeof listAdminEnquiries>>) {
  return enquiries.filter((enquiry) => !["converted", "lost", "closed"].includes(text(enquiry.status, "new")));
}

export default async function AdminPage() {
  const [snapshot, policy, enquiries, pendingSubmissions] = await Promise.all([
    getAdminDashboardSnapshot(),
    getAdminSettingsPolicy(),
    listAdminEnquiries(),
    listPendingSupplierSubmissions()
  ]);
  const { operationalCounts } = snapshot.data;

  const reviewOrders = (snapshot.data.ordersNeedingReview.length
    ? snapshot.data.ordersNeedingReview
    : snapshot.data.recentOrders.filter(orderNeedsAdminReview)
  ).slice(0, 8);

  const inventoryAlerts = snapshot.data.lowStockAlerts.slice(0, 8);
  const queueEnquiries = openEnquiries(enquiries).slice(0, 8);

  const kpiCards = [
    {
      label: "Orders awaiting review",
      value: formatDashboardCount(operationalCounts.pendingOrdersReview),
      href: "/admin/orders?queue=review",
      tone: "text-amber-300"
    },
    {
      label: "Customer enquiries",
      value: formatDashboardCount(operationalCounts.openEnquiries),
      href: "/admin/enquiries?status=new",
      tone: "text-sky-300"
    },
    {
      label: "Inventory alerts",
      value: formatDashboardCount(operationalCounts.lowStockAlerts),
      href: "/admin/inventory",
      tone: "text-rose-300"
    },
    {
      label: "Supplier approvals",
      value: formatDashboardCount(operationalCounts.pendingSupplierSubmissions),
      href: "/admin/suppliers/products",
      tone: "text-violet-300"
    }
  ];

  return (
    <div data-admin-dashboard className="grid gap-4">
      <AdminDashboardLiveSync enabled={policy.realtimeUpdatesEnabled} />

      {snapshot.blockedReason ? (
        <p className="rounded-[var(--platform-radius)] border border-[var(--platform-warning)]/20 bg-[var(--platform-warning-soft)] px-4 py-3 text-sm text-[var(--platform-warning)]">
          {connectivityMessage(snapshot.blockedReason)}
        </p>
      ) : null}

      <section data-admin-kpi-strip className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3 transition hover:bg-[var(--platform-surface-raised)]"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">{card.label}</p>
            <p className={`mt-1 text-3xl font-semibold tabular-nums ${card.tone}`}>{card.value}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">Action queue</h2>

        <div className="grid gap-4 xl:grid-cols-2">
          <QueuePanel title="Pending orders" href="/admin/orders?queue=review" emptyLabel="No orders need review.">
            {reviewOrders.length ? (
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--platform-border)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Order</th>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewOrders.map((order) => (
                    <tr key={String(order.id)} className="border-b border-[var(--platform-border)] last:border-b-0">
                      <td className="px-3 py-2">
                        <Link href={`/admin/orders?order=${encodeURIComponent(orderLabel(order))}&queue=review`} className="font-medium text-[var(--platform-accent)]">
                          {orderLabel(order)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-[var(--platform-text-secondary)]">{text(order.customer_email, "—")}</td>
                      <td className="px-3 py-2"><StatusPill status={text(order.status, "pending")} /></td>
                      <td className="px-3 py-2 text-xs text-[var(--platform-text-muted)]">{relativeTimeLabel(text(order.updated_at) || text(order.created_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </QueuePanel>

          <QueuePanel title="Customer enquiries" href="/admin/enquiries" emptyLabel="No open enquiries.">
            {queueEnquiries.length ? (
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--platform-border)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Customer</th>
                    <th className="px-3 py-2 font-medium">Subject</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {queueEnquiries.map((enquiry) => (
                    <tr key={String(enquiry.id)} className="border-b border-[var(--platform-border)] last:border-b-0">
                      <td className="px-3 py-2 text-[var(--platform-text-primary)]">{text(enquiry.customer_email, "—")}</td>
                      <td className="px-3 py-2 text-[var(--platform-text-secondary)]">{text(enquiry.subject, "Enquiry")}</td>
                      <td className="px-3 py-2"><StatusPill status={text(enquiry.status, "new")} /></td>
                      <td className="px-3 py-2 text-xs text-[var(--platform-text-muted)]">{relativeTimeLabel(text(enquiry.created_at))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </QueuePanel>

          <QueuePanel title="Inventory alerts" href="/admin/inventory" emptyLabel="Stock levels are healthy.">
            {inventoryAlerts.length ? (
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--platform-border)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryAlerts.map((row, index) => (
                    <tr key={String(row.id ?? index)} className="border-b border-[var(--platform-border)] last:border-b-0">
                      <td className="px-3 py-2 font-medium text-[var(--platform-text-primary)]">{text(row.product_name, text(row.product_slug, "Product"))}</td>
                      <td className="px-3 py-2 text-[var(--platform-text-secondary)]">{text(row.sku, "—")}</td>
                      <td className="px-3 py-2 text-[var(--platform-text-secondary)]">{String(row.quantity ?? 0)}</td>
                      <td className="px-3 py-2"><StatusPill status={text(row.stock_status, "low_stock")} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </QueuePanel>

          <QueuePanel title="Supplier approvals" href="/admin/suppliers/products" emptyLabel="No submissions awaiting approval.">
            {pendingSubmissions.length ? (
              <table className="min-w-full text-sm">
                <thead className="border-b border-[var(--platform-border)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Supplier</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSubmissions.map((product) => (
                    <tr key={product.slug} className="border-b border-[var(--platform-border)] last:border-b-0">
                      <td className="px-3 py-2 font-medium text-[var(--platform-text-primary)]">{product.name}</td>
                      <td className="px-3 py-2 text-[var(--platform-text-secondary)]">{product.supplierLabel}</td>
                      <td className="px-3 py-2"><StatusPill status="pending_review" /></td>
                      <td className="px-3 py-2 text-xs text-[var(--platform-text-muted)]">{relativeTimeLabel(product.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </QueuePanel>
        </div>
      </section>
    </div>
  );
}

function QueuePanel({
  title,
  href,
  emptyLabel,
  children
}: {
  title: string;
  href: string;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--platform-border)] px-3 py-2">
        <h3 className="text-sm font-medium text-[var(--platform-text-primary)]">{title}</h3>
        <Link href={href} className="text-xs font-medium text-[var(--platform-accent)]">View all</Link>
      </div>
      <div className="overflow-x-auto">
        {children ? children : <p className="px-3 py-4 text-sm text-[var(--platform-text-muted)]">{emptyLabel}</p>}
      </div>
    </div>
  );
}
