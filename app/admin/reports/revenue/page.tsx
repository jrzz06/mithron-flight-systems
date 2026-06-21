import Link from "next/link";
import { getSalesReportSummary } from "@/services/reports";

export default async function RevenueReportPage() {
  const sales = await getSalesReportSummary();
  return (
    <main className="min-h-screen bg-[#070b12] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-[960px]">
        <Link href="/admin/reports" className="text-sm text-emerald-400">Back to reports</Link>
        <h1 className="mt-4 text-3xl font-semibold">Revenue by status</h1>
        <p className="mt-4 text-4xl font-semibold text-emerald-400">{sales.revenue.toFixed(0)} INR</p>
        <p className="mt-2 text-sm text-slate-400">Across paid and fulfilled order statuses.</p>
      </div>
    </main>
  );
}
