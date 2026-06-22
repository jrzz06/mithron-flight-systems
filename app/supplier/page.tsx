import Link from "next/link";
import { MetricGrid } from "@/components/platform";
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

  return (
    <div className="grid gap-5">
      <div>
        <p className="text-xs font-medium text-[var(--platform-text-muted)]">Supplier workspace</p>
        <h2 className="mt-1 text-2xl font-semibold text-[var(--platform-text-primary)]">Overview</h2>
        <p className="mt-2 max-w-2xl text-sm text-[var(--platform-text-secondary)]">
          Track product submissions and stock levels before they appear on the storefront.
        </p>
      </div>

      <MetricGrid
        metrics={[
          { label: "Draft", value: String(counts.draft ?? 0) },
          { label: "Awaiting review", value: String(counts.pending_review ?? 0) },
          { label: "Published", value: String(counts.published ?? 0) },
          { label: "Rejected", value: String(counts.rejected ?? 0) }
        ]}
      />

      <div className="flex flex-wrap gap-3">
        <Link href="/supplier/products/new" className="rounded-[10px] bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
          Add product
        </Link>
        <Link href="/supplier/products" className="rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 py-2 text-sm font-semibold text-[var(--platform-text-primary)] hover:bg-[var(--platform-surface-muted)]">
          View products
        </Link>
      </div>
    </div>
  );
}
