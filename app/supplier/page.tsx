import Link from "next/link";
import { getCurrentAuthContext } from "@/services/auth";
import { listSupplierProducts } from "@/services/supplier-actions";

export default async function SupplierDashboardPage() {
  const context = await getCurrentAuthContext();
  const products = context.userId ? await listSupplierProducts(context.userId) : [];
  const counts = products.reduce<Record<string, number>>((acc, product) => {
    const status = String(product.workflow_status ?? "draft");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Supplier workspace</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Product submissions</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Create products, submit them for admin review, and track approval status before they appear on the storefront.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Draft", counts.draft ?? 0],
          ["Pending review", counts.pending_review ?? 0],
          ["Published", counts.published ?? 0],
          ["Rejected", counts.rejected ?? 0]
        ].map(([label, value]) => (
          <article key={label} className="rounded-xl border border-white/[0.08] bg-[#0f141b] p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-100">{value}</p>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/supplier/products/new" className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white">
          Add product
        </Link>
        <Link href="/supplier/products" className="rounded-lg border border-white/[0.08] px-4 py-2 text-sm font-semibold text-slate-200">
          View all products
        </Link>
      </div>
    </div>
  );
}
