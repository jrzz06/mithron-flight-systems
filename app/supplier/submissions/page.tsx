import Link from "next/link";
import { AdminSection } from "@/components/admin/module-panel";
import { StatusPill } from "@/components/platform";
import { listSupplierProducts } from "@/services/supplier-actions";
import { getCurrentAuthContext } from "@/services/auth";

export default async function SupplierSubmissionsPage() {
  const context = await getCurrentAuthContext();
  const products = context.userId ? await listSupplierProducts(context.userId) : [];
  const inbox = products.filter((product) => {
    const status = String(product.workflow_status ?? "draft");
    return status === "pending_review" || status === "rejected" || status === "published";
  });

  return (
    <div className="grid gap-5">
      <AdminSection
        title="Approval inbox"
        description="Track submission outcomes and next actions for each listing."
      >
        <div className="grid gap-2">
          {inbox.length ? inbox.map((product) => {
            const status = String(product.workflow_status ?? "draft");
            const slug = String(product.slug ?? "");
            return (
              <div
                key={slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--platform-text-primary)]">{String(product.name ?? slug)}</p>
                  <p className="text-xs text-[var(--platform-text-muted)]">{slug}</p>
                  {product.rejection_reason ? (
                    <p className="mt-1 text-xs text-red-400">{String(product.rejection_reason)}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={status} />
                  <Link href={`/supplier/products/${encodeURIComponent(slug)}`} className="text-sm text-[var(--platform-accent)]">
                    Open
                  </Link>
                </div>
              </div>
            );
          }) : (
            <p className="text-sm text-[var(--platform-text-secondary)]">No submissions yet. Create a product draft to begin.</p>
          )}
        </div>
      </AdminSection>
    </div>
  );
}
