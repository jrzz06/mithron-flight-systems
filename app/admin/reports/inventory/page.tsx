import Link from "next/link";
import { getInventoryReportSummary } from "@/services/reports";

export default async function InventoryReportPage() {
  const inventory = await getInventoryReportSummary();
  return (
    <main className="min-h-screen bg-[#070b12] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-[960px]">
        <Link href="/admin/reports" className="text-sm text-emerald-400">Back to reports</Link>
        <h1 className="mt-4 text-3xl font-semibold">Inventory report</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-800 bg-[#10151d] p-5"><p>Low stock</p><p className="mt-2 text-3xl">{inventory.lowStock}</p></article>
          <article className="rounded-xl border border-slate-800 bg-[#10151d] p-5"><p>Out of stock</p><p className="mt-2 text-3xl">{inventory.outOfStock}</p></article>
        </div>
      </div>
    </main>
  );
}
