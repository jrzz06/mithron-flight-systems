import { assertSupabaseAdminConfig } from "@/lib/env";
import { AdminSection } from "@/components/admin/module-panel";
import { AdminSuppliersLiveSync } from "@/components/admin/admin-suppliers-live-sync";
import { FeedbackBanner, StatusPill } from "@/components/platform";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";
import { countPendingSupplierProducts } from "@/services/supplier-actions";
import { formatINR } from "@/lib/utils";
import { approveProductSubmissionFormAction, rejectProductSubmissionFormAction } from "./actions";
import { getDefaultWarehouseCode } from "@/services/warehouse-config";
import type { SupplierInventoryInit } from "@/services/product-inventory-workflow";

type PendingProduct = {
  slug: string;
  name: string;
  category: string;
  price: number;
  supplier_id: string | null;
  supplier_label: string;
  workflow_status: string;
  updated_at: string;
  inventory_init: SupplierInventoryInit | null;
};

async function fetchPendingProducts(supplierId?: string): Promise<PendingProduct[]> {
  const config = assertSupabaseAdminConfig(process.env);
  const supplierFilter = supplierId ? `&supplier_id=eq.${encodeURIComponent(supplierId)}` : "";
  const response = await fetch(
    `${config.url}/rest/v1/mithron_products?select=slug,name,category,price,supplier_id,workflow_status,updated_at,inventory_init&workflow_status=eq.pending_review${supplierFilter}&order=updated_at.desc&limit=100`,
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
    const inventoryInit = product.inventory_init && typeof product.inventory_init === "object"
      ? product.inventory_init as SupplierInventoryInit
      : null;
    return {
      slug: String(product.slug),
      name: String(product.name),
      category: String(product.category),
      price: Number(product.price ?? 0),
      supplier_id: supplierId,
      supplier_label: supplierId ? profileById.get(supplierId) ?? "Unknown supplier" : "Unknown supplier",
      workflow_status: String(product.workflow_status ?? "pending_review"),
      updated_at: String(product.updated_at ?? ""),
      inventory_init: inventoryInit
    };
  });
}

export default async function AdminSupplierProductsPage({
  searchParams
}: {
  searchParams: Promise<{ approval_status?: string; approval_message?: string; supplier?: string }>;
}) {
  const params = await searchParams;
  const supplierFilter = typeof params.supplier === "string" ? params.supplier.trim() : "";
  const [products, pendingCount, policy, defaultWarehouseCode] = await Promise.all([
    fetchPendingProducts(supplierFilter || undefined),
    countPendingSupplierProducts(),
    getAdminSettingsPolicy(),
    getDefaultWarehouseCode()
  ]);

  return (
    <div className="grid gap-5">
      <AdminSuppliersLiveSync enabled={policy.realtimeUpdatesEnabled} />
      <div className="max-w-3xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">Supplier approvals</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--platform-text-muted)]">
          Review supplier product submissions before they are published to the storefront.
        </p>
      </div>

      {params.approval_message ? (
        <FeedbackBanner status={params.approval_status ?? "success"} message={params.approval_message} context="Submission" />
      ) : null}

      <AdminSection
        title="Pending product submissions"
        description={`${pendingCount} item${pendingCount === 1 ? "" : "s"} awaiting review`}
        actions={
          pendingCount > 0 ? (
            <StatusPill status="pending_review" />
          ) : undefined
        }
      >
        <div className="grid gap-2">
          {products.length ? products.map((product) => {
            const missingSupplier = !product.supplier_id;
            const inventoryInit = product.inventory_init;
            return (
              <article
                key={product.slug}
                className="rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4 transition-colors hover:bg-[var(--platform-surface-raised)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-medium text-[var(--platform-text-primary)]">{product.name}</h2>
                      <StatusPill status={product.workflow_status} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--platform-text-muted)]">
                      {product.category} · {formatINR(product.price)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--platform-text-muted)]">Supplier: {product.supplier_label}</p>
                    {missingSupplier ? (
                      <p className="mt-2 text-xs text-[var(--platform-warning)]">
                        Missing supplier owner — reject this submission or fix supplier_id before approval.
                      </p>
                    ) : null}
                    <form action={approveProductSubmissionFormAction} className="mt-4 grid gap-3 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] p-4">
                      <input type="hidden" name="slug" value={product.slug} />
                      <input type="hidden" name="expected_updated_at" value={product.updated_at} />
                      <p className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">Inventory on approval</p>
                      {!inventoryInit ? (
                        <p className="text-xs text-[var(--platform-text-muted)]">No stock info submitted by supplier.</p>
                      ) : (
                        <p className="text-xs text-[var(--platform-text-muted)]">Supplier submitted initial stock information. Review and adjust before approval.</p>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm">
                          <span className="text-[var(--platform-text-secondary)]">SKU</span>
                          <input
                            name="approval_sku"
                            defaultValue={inventoryInit?.sku ?? ""}
                            className="h-9 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 text-sm text-[var(--platform-text-primary)]"
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-[var(--platform-text-secondary)]">Warehouse</span>
                          <input
                            name="approval_warehouse_code"
                            defaultValue={inventoryInit?.warehouse_code ?? defaultWarehouseCode}
                            className="h-9 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 text-sm text-[var(--platform-text-primary)]"
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-[var(--platform-text-secondary)]">Starting quantity</span>
                          <input
                            name="approval_initial_quantity"
                            type="number"
                            min={0}
                            defaultValue={inventoryInit?.initial_quantity ?? 0}
                            className="h-9 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 text-sm text-[var(--platform-text-primary)]"
                          />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-[var(--platform-text-secondary)]">Reorder threshold</span>
                          <input
                            name="approval_reorder_threshold"
                            type="number"
                            min={0}
                            defaultValue={inventoryInit?.reorder_threshold ?? 0}
                            className="h-9 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 text-sm text-[var(--platform-text-primary)]"
                          />
                        </label>
                      </div>
                      <textarea
                        name="approval_stock_notes"
                        rows={2}
                        defaultValue={inventoryInit?.stock_notes ?? ""}
                        placeholder="Optional stock notes"
                        className="rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 py-2 text-sm text-[var(--platform-text-primary)]"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="submit"
                          disabled={missingSupplier}
                          className="platform-btn-primary h-9 rounded-[8px] px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Approve
                        </button>
                      </div>
                    </form>
                  </div>
                  <form action={rejectProductSubmissionFormAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="slug" value={product.slug} />
                      <input type="hidden" name="expected_updated_at" value={product.updated_at} />
                      <input
                        name="rejection_reason"
                        required
                        placeholder="Rejection reason"
                        className="h-9 min-w-[180px] rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)] outline-none focus:border-[var(--platform-accent)]/35 focus:ring-2 focus:ring-[var(--platform-accent)]/10"
                      />
                      <button
                        type="submit"
                        className="inline-flex h-9 items-center rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm font-medium text-[var(--platform-danger)] transition hover:bg-[var(--platform-danger-soft)]"
                      >
                        Reject
                      </button>
                    </form>
                </div>
              </article>
            );
          }) : (
            <p className="rounded-[8px] border border-dashed border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-8 text-center text-sm text-[var(--platform-text-muted)]">
              No products waiting for approval.
            </p>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
