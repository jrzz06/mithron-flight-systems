import Link from "next/link";
import { approveSupplierFormAction, suspendSupplierFormAction } from "@/app/admin/suppliers/actions";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { StatusPill } from "@/components/platform";
import { connectivityMessage } from "@/lib/platform/copy";
import { getAdminSuppliersSnapshot } from "@/services/admin";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default async function AdminSuppliersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const access = await getAdminSuppliersSnapshot();
  const params = searchParams ? await searchParams : {};
  const query = searchValue(params, "q").toLowerCase();
  const supplierStatus = searchValue(params, "supplier_status");
  const supplierMessage = searchValue(params, "supplier_message");

  const suppliers = access.data.suppliers.filter((supplier) => {
    if (!query) return true;
    const haystack = `${supplier.name} ${supplier.company} ${supplier.email} ${supplier.phone}`.toLowerCase();
    return haystack.includes(query);
  });

  return (
    <div className="grid gap-4" data-supplier-directory>
      {supplierMessage ? (
        <div
          className={`rounded-[8px] border px-4 py-3 text-sm ${
            supplierStatus === "error"
              ? "platform-feedback-error"
              : "platform-feedback-success"
          }`}
        >
          {supplierMessage}
        </div>
      ) : null}

      {access.blockedReason ? (
        <p className="text-sm text-[var(--platform-warning)]">{connectivityMessage(access.blockedReason)}</p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-1 flex-wrap items-end gap-2">
          <label className="grid min-w-[220px] flex-1 gap-1 text-sm">
            <span className="text-[var(--platform-text-muted)]">Search suppliers</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Company, email, or contact name"
              className="h-9 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 text-sm"
            />
          </label>
          <button type="submit" className="platform-btn-primary h-9 rounded-[8px] px-4 text-sm font-medium">Search</button>
        </form>
        <Link href="/admin/suppliers/products" className="platform-btn-primary h-9 rounded-[8px] px-4 text-sm font-medium">
          Review submissions
        </Link>
      </div>

      <div className="overflow-x-auto rounded-[8px] border border-[var(--platform-border)]">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-[var(--platform-border)] bg-[var(--platform-surface-muted)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">
            <tr>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Phone</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Registered</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.length ? suppliers.map((supplier) => (
              <tr key={supplier.id} data-supplier-id={supplier.id} className="border-b border-[var(--platform-border)] last:border-b-0">
                <td className="px-3 py-2.5 font-medium text-[var(--platform-text-primary)]">{supplier.company || supplier.name}</td>
                <td className="px-3 py-2.5 text-[var(--platform-text-secondary)]">{supplier.name || "—"}</td>
                <td className="px-3 py-2.5 text-[var(--platform-text-secondary)]">{supplier.email || "—"}</td>
                <td className="px-3 py-2.5 text-[var(--platform-text-secondary)]">{supplier.phone || "—"}</td>
                <td className="px-3 py-2.5"><StatusPill status={supplier.verificationStatus} /></td>
                <td className="px-3 py-2.5 text-xs text-[var(--platform-text-muted)]">{formatDate(supplier.registeredAt)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/admin/suppliers/products?supplier=${encodeURIComponent(supplier.id)}`}
                      className="text-xs font-medium text-[var(--platform-accent)]"
                    >
                      Products
                    </Link>
                    {supplier.verificationStatus !== "verified" ? (
                      <form action={approveSupplierFormAction}>
                        <input type="hidden" name="supplier_id" value={supplier.id} />
                        <input type="hidden" name="verification_status" value={supplier.verificationStatus} />
                        <OperationalSubmitButton pendingLabel="Approving" className="platform-btn-primary h-8 rounded-[8px] px-3 text-xs font-medium">
                          Approve
                        </OperationalSubmitButton>
                      </form>
                    ) : null}
                    {supplier.verificationStatus !== "disabled" ? (
                      <form action={suspendSupplierFormAction}>
                        <input type="hidden" name="supplier_id" value={supplier.id} />
                        <OperationalSubmitButton pendingLabel="Suspending" className="platform-btn-danger h-8 rounded-[8px] px-3 text-xs font-medium">
                          Suspend
                        </OperationalSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--platform-text-muted)]">
                  No supplier accounts match this search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
