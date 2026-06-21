import Link from "next/link";
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
    <main className="min-h-screen bg-[#070b12] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-[1180px]">
        <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Reports</p>
        <h1 className="mt-2 text-3xl font-semibold">Procurement overview</h1>
        <div className="mt-6 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className="rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200">
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-800 bg-[#10151d] p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Orders</p>
            <p className="mt-2 text-3xl font-semibold">{sales.totalOrders}</p>
            <p className="mt-1 text-sm text-emerald-400">Revenue {sales.revenue.toFixed(0)} INR</p>
          </article>
          <article className="rounded-xl border border-slate-800 bg-[#10151d] p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Supplier products</p>
            <p className="mt-2 text-3xl font-semibold">{suppliers.total}</p>
            <p className="mt-1 text-sm text-amber-300">{suppliers.pending} pending review</p>
          </article>
          <article className="rounded-xl border border-slate-800 bg-[#10151d] p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Inventory alerts</p>
            <p className="mt-2 text-3xl font-semibold">{inventory.lowStock}</p>
            <p className="mt-1 text-sm text-red-300">{inventory.outOfStock} out of stock</p>
          </article>
        </div>
      </div>
    </main>
  );
}
