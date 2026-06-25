import { AdminSection, OperationalFeedback } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { getCurrentAuthContext } from "@/services/auth";
import { listSupplierInventory } from "@/services/supplier-actions";
import { listSupplierStockRequests } from "@/services/supplier-stock-requests";
import { submitSupplierStockRequestAction } from "./actions";

type SearchParams = Record<string, string | string[] | undefined>;

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] ?? "" : raw ?? "";
}

export default async function SupplierInventoryPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const context = await getCurrentAuthContext();
  const params = searchParams ? await searchParams : {};
  const inventory = context.userId ? await listSupplierInventory(context.userId) : [];
  const requests = context.userId ? await listSupplierStockRequests(context.userId) : [];

  return (
    <div className="grid gap-5">
      <OperationalFeedback
        status={value(params, "operation_status")}
        message={value(params, "operation_message")}
        context="Stock"
      />

      <AdminSection title="Stock levels" description="Current warehouse quantities for your products (read-only).">
        <div className="overflow-hidden rounded-xl border border-[var(--platform-border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--platform-surface-muted)] text-left text-[var(--platform-text-muted)]">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Request update</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length ? inventory.map((row) => {
                const slug = String(row.product_slug ?? "");
                return (
                  <tr key={String(row.id)} className="border-t border-[var(--platform-border)]">
                    <td className="px-4 py-3 text-[var(--platform-text-primary)]">{slug}</td>
                    <td className="px-4 py-3 text-[var(--platform-text-secondary)]">{String(row.sku ?? "—")}</td>
                    <td className="px-4 py-3 text-[var(--platform-text-secondary)]">{String(row.quantity ?? 0)}</td>
                    <td className="px-4 py-3 capitalize text-[var(--platform-text-secondary)]">{String(row.stock_status ?? "available")}</td>
                    <td className="px-4 py-3">
                      <form action={submitSupplierStockRequestAction} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="productSlug" value={slug} />
                        <input
                          name="requestedQuantity"
                          type="number"
                          min={0}
                          defaultValue={String(row.quantity ?? 0)}
                          className="h-9 w-24 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-2 text-sm"
                        />
                        <input
                          name="note"
                          placeholder="Note (optional)"
                          className="h-9 min-w-[140px] flex-1 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface)] px-2 text-sm"
                        />
                        <OperationalSubmitButton pendingLabel="Sending" className="text-xs">Request</OperationalSubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--platform-text-muted)]">
                    No inventory rows linked to your products yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminSection>

      <AdminSection title="Stock requests" description="Pending and recent approval outcomes.">
        <div className="grid gap-2">
          {requests.length ? requests.map((request) => (
            <div
              key={String(request.id)}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--platform-border)] px-3 py-2 text-sm"
            >
              <span className="text-[var(--platform-text-primary)]">{String(request.product_slug)}</span>
              <span className="text-[var(--platform-text-secondary)]">→ {String(request.requested_quantity)}</span>
              <span className="capitalize text-[var(--platform-text-muted)]">{String(request.status)}</span>
            </div>
          )) : (
            <p className="text-sm text-[var(--platform-text-secondary)]">No stock requests yet.</p>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
