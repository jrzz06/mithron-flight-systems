import { getCurrentAuthContext } from "@/services/auth";
import { listSupplierInventory } from "@/services/supplier-actions";

export default async function SupplierInventoryPage() {
  const context = await getCurrentAuthContext();
  const inventory = context.userId ? await listSupplierInventory(context.userId) : [];

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Supplier inventory</h1>
        <p className="mt-1 text-sm text-slate-400">Stock levels for your approved and submitted products.</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/[0.08]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#0f141b] text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {inventory.length ? inventory.map((row) => (
              <tr key={String(row.id)} className="border-t border-white/[0.06]">
                <td className="px-4 py-3 text-slate-100">{String(row.product_slug)}</td>
                <td className="px-4 py-3 text-slate-300">{String(row.sku ?? "-")}</td>
                <td className="px-4 py-3 text-slate-300">{String(row.quantity ?? 0)}</td>
                <td className="px-4 py-3 capitalize text-slate-300">{String(row.stock_status ?? "available")}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No inventory rows linked to your products yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
