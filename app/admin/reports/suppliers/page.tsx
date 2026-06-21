import Link from "next/link";
import { getSupplierReportSummary } from "@/services/reports";

export default async function SuppliersReportPage() {
  const suppliers = await getSupplierReportSummary();
  return (
    <main className="min-h-screen bg-[#070b12] px-6 py-10 text-slate-100">
      <div className="mx-auto max-w-[960px]">
        <Link href="/admin/reports" className="text-sm text-emerald-400">Back to reports</Link>
        <h1 className="mt-4 text-3xl font-semibold">Supplier throughput</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-xl border border-slate-800 bg-[#10151d] p-5"><p>Total</p><p className="mt-2 text-3xl">{suppliers.total}</p></article>
          <article className="rounded-xl border border-slate-800 bg-[#10151d] p-5"><p>Pending</p><p className="mt-2 text-3xl">{suppliers.pending}</p></article>
          <article className="rounded-xl border border-slate-800 bg-[#10151d] p-5"><p>Published</p><p className="mt-2 text-3xl">{suppliers.published}</p></article>
        </div>
      </div>
    </main>
  );
}
