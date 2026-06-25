import Link from "next/link";
import { AdminSection } from "@/components/admin/module-panel";
import { StatusPill } from "@/components/platform";
import { listSupplierProducts } from "@/services/supplier-actions";
import { getCurrentAuthContext } from "@/services/auth";

export default async function SupplierDashboardPage() {
  const context = await getCurrentAuthContext();
  const products = context.userId ? await listSupplierProducts(context.userId) : [];
  const counts = products.reduce<Record<string, number>>((acc, product) => {
    const status = String(product.workflow_status ?? "draft");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  const pendingReview = counts.pending_review ?? 0;
  const rejected = counts.rejected ?? 0;

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <AdminSection
          title="Submission status"
          description="Track where your listings sit in the review workflow."
        >
          <div className="grid gap-2">
            {[
              { label: "Draft", status: "draft", count: counts.draft ?? 0 },
              { label: "Awaiting review", status: "pending_review", count: pendingReview },
              { label: "Published", status: "published", count: counts.published ?? 0 },
              { label: "Rejected", status: "rejected", count: rejected }
            ].map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between gap-3 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <StatusPill status={item.status} />
                  <span className="text-sm text-[var(--platform-text-secondary)]">{item.label}</span>
                </div>
                <span className="text-sm font-medium tabular-nums text-[var(--platform-text-primary)]">{item.count}</span>
              </div>
            ))}
          </div>
        </AdminSection>

        <AdminSection title="Next steps" description="Common actions for supplier operations.">
          <div className="grid gap-2">
            <Link
              href="/supplier/products/new"
              className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[var(--platform-accent)] px-4 text-sm font-medium text-[var(--platform-surface)] transition hover:bg-[var(--platform-accent-strong)]"
            >
              Submit new product
            </Link>
            <Link
              href="/supplier/products"
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 text-sm font-medium text-[var(--platform-text-primary)] transition hover:bg-[var(--platform-surface-muted)]"
            >
              Manage products
            </Link>
            <Link
              href="/supplier/submissions"
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 text-sm font-medium text-[var(--platform-text-primary)] transition hover:bg-[var(--platform-surface-muted)]"
            >
              View submissions
            </Link>
            <Link
              href="/supplier/orders"
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 text-sm font-medium text-[var(--platform-text-primary)] transition hover:bg-[var(--platform-surface-muted)]"
            >
              Customer orders
            </Link>
            <Link
              href="/supplier/inventory"
              className="inline-flex h-10 items-center justify-center rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 text-sm font-medium text-[var(--platform-text-primary)] transition hover:bg-[var(--platform-surface-muted)]"
            >
              Request stock update
            </Link>
          </div>
        </AdminSection>
      </section>
    </div>
  );
}
