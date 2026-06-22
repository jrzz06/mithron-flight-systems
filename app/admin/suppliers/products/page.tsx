import { assertSupabaseAdminConfig } from "@/lib/env";
import { countPendingSupplierProducts } from "@/services/supplier-actions";
import { approveProductSubmissionFormAction, rejectProductSubmissionFormAction } from "./actions";

type PendingProduct = {
  slug: string;
  name: string;
  category: string;
  price: number;
  supplier_id: string | null;
  supplier_label: string;
  workflow_status: string;
  updated_at: string;
};

async function fetchPendingProducts(): Promise<PendingProduct[]> {
  const config = assertSupabaseAdminConfig(process.env);
  const response = await fetch(
    `${config.url}/rest/v1/mithron_products?select=slug,name,category,price,supplier_id,workflow_status,updated_at&workflow_status=eq.pending_review&order=updated_at.desc&limit=100`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    }
  );
  if (!response.ok) return [];

  const products = (await response.json()) as Array<Record<string, unknown>>;
  const supplierIds = [...new Set(products.map((product) => String(product.supplier_id ?? "")).filter(Boolean))];
  const profileById = new Map<string, string>();

  if (supplierIds.length) {
    const profilesResponse = await fetch(
      `${config.url}/rest/v1/profiles?select=id,email,display_name&id=in.(${supplierIds.map(encodeURIComponent).join(",")})`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`
        },
        cache: "no-store"
      }
    );
    if (profilesResponse.ok) {
      const profiles = (await profilesResponse.json()) as Array<{ id?: string; email?: string; display_name?: string }>;
      for (const profile of profiles) {
        const id = String(profile.id ?? "");
        if (!id) continue;
        profileById.set(id, profile.display_name || profile.email || id);
      }
    }
  }

  return products.map((product) => {
    const supplierId = product.supplier_id ? String(product.supplier_id) : null;
    return {
      slug: String(product.slug),
      name: String(product.name),
      category: String(product.category),
      price: Number(product.price ?? 0),
      supplier_id: supplierId,
      supplier_label: supplierId ? profileById.get(supplierId) ?? supplierId : "Unknown supplier",
      workflow_status: String(product.workflow_status ?? "pending_review"),
      updated_at: String(product.updated_at ?? "")
    };
  });
}

export default async function AdminSupplierProductsPage({
  searchParams
}: {
  searchParams: Promise<{ approval_status?: string; approval_message?: string }>;
}) {
  const params = await searchParams;
  const [products, pendingCount] = await Promise.all([fetchPendingProducts(), countPendingSupplierProducts()]);

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Supplier approvals</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-100">Pending product submissions</h1>
          {pendingCount > 0 ? (
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
              {pendingCount} pending
            </span>
          ) : null}
        </div>
      </div>

      {params.approval_message ? (
        <p
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm ${
            params.approval_status === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              : "border-rose-500/30 bg-rose-500/10 text-rose-100"
          }`}
        >
          {params.approval_message}
        </p>
      ) : null}

      <div className="grid gap-3">
        {products.length ? products.map((product) => {
          const missingSupplier = !product.supplier_id;
          return (
          <article key={product.slug} className="rounded-xl border border-slate-800 bg-[#10151d] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{product.name}</h2>
                <p className="mt-1 text-sm text-slate-400">{product.category} · INR {product.price}</p>
                <p className="mt-1 text-xs text-slate-500">Supplier: {product.supplier_label}</p>
                {missingSupplier ? (
                  <p className="mt-2 text-xs font-medium text-amber-300">
                    Missing supplier owner — reject this submission or fix supplier_id before approval.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={approveProductSubmissionFormAction}>
                  <input type="hidden" name="slug" value={product.slug} />
                  <button
                    type="submit"
                    disabled={missingSupplier}
                    className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Approve
                  </button>
                </form>
                <form action={rejectProductSubmissionFormAction} className="flex items-center gap-2">
                  <input type="hidden" name="slug" value={product.slug} />
                  <input name="rejection_reason" required placeholder="Rejection reason" className="rounded-lg border border-slate-700 bg-[#0c1118] px-3 py-2 text-sm text-slate-100" />
                  <button type="submit" className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white">Reject</button>
                </form>
              </div>
            </div>
          </article>
        );
        }) : (
          <p className="rounded-xl border border-slate-800 bg-[#10151d] p-6 text-sm text-slate-500">No products waiting for approval.</p>
        )}
      </div>
    </div>
  );
}
