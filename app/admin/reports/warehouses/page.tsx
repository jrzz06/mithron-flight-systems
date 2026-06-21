import Link from "next/link";
import { getInventoryReportSummary } from "@/services/reports";

export default async function WarehousesReportPage() {
  const inventory = await getInventoryReportSummary();
  return (
    <main className="min-h-screen bg-[#070b12] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-[960px]">
        <Link href="/admin/reports" className="text-sm text-emerald-400">Back to reports</Link>
        <h1 className="mt-4 text-3xl font-semibold">Warehouse readiness</h1>
        <p className="mt-4 text-sm text-slate-400">Low-stock SKUs requiring warehouse attention: {inventory.lowStock}</p>
      </div>
    </main>
  );
}
