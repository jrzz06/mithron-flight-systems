import Link from "next/link";
import { assertSupabaseAdminConfig } from "@/lib/env";
import { AdminSection } from "@/components/admin/module-panel";

async function fetchSuppliers() {
  const config = assertSupabaseAdminConfig(process.env);
  const response = await fetch(
    `${config.url}/rest/v1/user_roles?select=user_id,role_key,created_at&role_key=eq.supplier&order=created_at.desc&limit=100`,
    {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      },
      cache: "no-store"
    }
  );
  if (!response.ok) return [];
  return (await response.json()) as Array<Record<string, unknown>>;
}

export default async function AdminSuppliersPage() {
  const suppliers = await fetchSuppliers();

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Commerce</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-100">Suppliers</h1>
        </div>
        <Link href="/admin/users" className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100">
          Manage users
        </Link>
      </div>

      <AdminSection title="Supplier accounts">
        <div className="grid gap-2">
          {suppliers.length ? suppliers.map((supplier) => (
            <div key={String(supplier.user_id)} className="rounded-xl border border-slate-800 bg-[#10151d] p-4">
              <p className="text-sm font-semibold text-slate-100">{String(supplier.user_id)}</p>
              <p className="mt-1 text-xs text-slate-500">Role: supplier · joined {String(supplier.created_at ?? "")}</p>
            </div>
          )) : (
            <p className="text-sm text-slate-500">No supplier accounts assigned yet.</p>
          )}
        </div>
      </AdminSection>

      <Link href="/admin/suppliers/products" className="inline-flex w-fit rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white">
        Open approval queue
      </Link>
    </div>
  );
}
