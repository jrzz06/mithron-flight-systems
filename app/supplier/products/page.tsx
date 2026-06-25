import Link from "next/link";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { StatusPill } from "@/components/platform";
import { SupplierSubmitProductButton } from "@/components/supplier/supplier-submit-product-button";
import { relativeTimeLabel, supplierEmptyMessage, supplierStatusHint } from "@/lib/platform/copy";
import { getCurrentAuthContext } from "@/services/auth";
import { listSupplierProducts } from "@/services/supplier-actions";
import { deleteSupplierProductFormAction, submitSupplierProductFormAction } from "./actions";

function canSubmit(status: string) {
  return status === "draft" || status === "rejected";
}

function canEditProduct(status: string) {
  return status === "draft" || status === "rejected";
}

function canViewProduct(status: string) {
  return status === "published";
}

export default async function SupplierProductsPage() {
  const context = await getCurrentAuthContext();
  const products = context.userId ? await listSupplierProducts(context.userId) : [];
  const draftCount = products.filter((product) => {
    const status = String(product.workflow_status ?? "draft");
    return status === "draft" || status === "rejected";
  }).length;

  return (
    <div className="grid gap-5">
      <p className="max-w-3xl text-sm leading-relaxed text-[var(--platform-text-secondary)]">
        Create and manage your product listings. Save a draft first, then send it for review when you are ready.
        Approved products go live on the store.
      </p>

      {draftCount > 0 ? (
        <div className="rounded-[8px] border border-amber-500/30 bg-amber-950/15 px-4 py-3 text-sm text-amber-100">
          You have {draftCount} product{draftCount === 1 ? "" : "s"} waiting to be sent for review.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[8px] border border-[var(--platform-border)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--platform-surface-muted)] text-left text-[var(--platform-text-muted)]">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length ? products.map((product) => {
              const slug = String(product.slug);
              const status = String(product.workflow_status ?? "draft");
              const hint = supplierStatusHint(status);
              const updated = typeof product.updated_at === "string" ? relativeTimeLabel(product.updated_at) : "—";

              return (
                <tr key={slug} className="border-t border-[var(--platform-border)]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--platform-text-primary)]">{String(product.name)}</div>
                    {hint ? <p className="mt-1 text-xs text-[var(--platform-text-muted)]">{hint}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--platform-text-muted)]">{updated}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {canEditProduct(status) ? (
                        <Link href={`/supplier/products/${slug}/edit`} className="text-[var(--platform-accent)] hover:underline">
                          Edit
                        </Link>
                      ) : canViewProduct(status) ? (
                        <Link
                          href={`/product/${encodeURIComponent(slug)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--platform-text-secondary)] hover:underline"
                        >
                          View listing
                        </Link>
                      ) : status === "pending_review" ? (
                        <span className="text-[var(--platform-text-muted)]">In review</span>
                      ) : null}
                      {canSubmit(status) ? (
                        <form action={submitSupplierProductFormAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <SupplierSubmitProductButton variant="button" />
                        </form>
                      ) : null}
                      {canSubmit(status) ? (
                        <form action={deleteSupplierProductFormAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <OperationalSubmitButton
                            pendingLabel="Deleting"
                            confirmMessage={`Delete draft "${String(product.name)}"? This cannot be undone.`}
                            className="text-rose-300 hover:text-rose-200"
                          >
                            Delete draft
                          </OperationalSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center">
                  <p className="text-sm text-[var(--platform-text-muted)]">{supplierEmptyMessage("products")}</p>
                  <Link href="/supplier/products/new" className="mt-3 inline-block text-sm font-medium text-[var(--platform-accent)]">
                    Add your first product
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
