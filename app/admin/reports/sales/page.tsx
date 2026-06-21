import Link from "next/link";
import { getSalesReportSummary } from "@/services/reports";

export default async function SalesReportPage() {
  const sales = await getSalesReportSummary();
  return (
    <main className="min-h-screen bg-[#070b12] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-[960px]">
        <Link href="/admin/reports" className="text-sm text-emerald-400">Back to reports</Link>
        <h1 className="mt-4 text-3xl font-semibold">Sales report</h1>
        <div className="mt-8 grid gap-3">
          {Object.entries(sales.byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#10151d] px-4 py-3">
              <span className="capitalize">{status}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
