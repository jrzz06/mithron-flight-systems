import Link from "next/link";
import { AdminSection } from "@/components/admin/module-panel";
import { MetricGrid } from "@/components/platform";
import { formatINR } from "@/lib/utils";
import { getInventoryReportSummary, getSalesReportSummary, getSupplierReportSummary } from "@/services/reports";

export default async function AdminReportsPage() {
  const [sales, suppliers, inventory] = await Promise.all([
    getSalesReportSummary(),
    getSupplierReportSummary(),
    getInventoryReportSummary()
  ]);

  const tabs = [
    { href: "/admin/reports/sales", label: "Sales" },
    { href: "/admin/reports/revenue", label: "Revenue" },
    { href: "/admin/reports/inventory", label: "Inventory" },
    { href: "/admin/reports/suppliers", label: "Suppliers" },
    { href: "/admin/reports/warehouses", label: "Warehouses" }
  ];

  return (
    <div className="grid gap-5">
      <MetricGrid
        metrics={[
          { label: "Orders", value: String(sales.totalOrders), detail: `Revenue ${formatINR(sales.revenue)}` },
          { label: "Supplier products", value: String(suppliers.total), detail: `${suppliers.pending} awaiting review` },
          { label: "Low stock", value: String(inventory.lowStock), detail: `${inventory.outOfStock} out of stock` }
        ]}
      />

      <AdminSection title="Report views" description="Explore detailed analytics by area.">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 py-2 text-sm font-medium text-[var(--platform-text-primary)] transition hover:bg-[var(--platform-surface)]"
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}
