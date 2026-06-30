import { EditorRenderedContent } from "@/components/editor/editor-rendered-content";
import { StatusPill } from "@/components/platform";
import { relativeTimeLabel } from "@/lib/platform/copy";
import { formatINR } from "@/lib/utils";
import type { StockRequestReviewItem } from "@/services/supplier-stock-request-review";
import { approveStockRequestAction, rejectStockRequestAction } from "@/app/admin/inventory/stock-request-actions";

function formatTimestamp(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function ReviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">{label}</dt>
      <dd className="text-sm text-[var(--platform-text-primary)]">{value}</dd>
    </div>
  );
}

function StockRequestReviewCard({ item }: { item: StockRequestReviewItem }) {
  const deltaPrefix = item.quantityDelta > 0 ? "+" : "";

  return (
    <article
      data-stock-request-review={item.requestId}
      className="grid gap-5 rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface)] p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">Stock submission review</p>
          <h3 className="mt-1 text-lg font-medium text-[var(--platform-text-primary)]">{item.product.name}</h3>
          <p className="mt-1 text-sm text-[var(--platform-text-muted)]">
            Submitted {formatTimestamp(item.submittedAt)}
            {item.submittedAt ? ` (${relativeTimeLabel(item.submittedAt)})` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={item.requestStatus} />
          <StatusPill status={item.product.workflowStatus} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="grid gap-3">
          <div className="overflow-hidden rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
            {item.product.primaryImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.product.primaryImageSrc}
                alt={item.product.name}
                className="aspect-square h-auto w-full object-cover"
              />
            ) : (
              <div className="grid aspect-square place-items-center px-4 text-center text-xs text-[var(--platform-text-muted)]">
                No product image
              </div>
            )}
          </div>
          {item.product.gallerySrcs.length ? (
            <div className="grid grid-cols-3 gap-2">
              {item.product.gallerySrcs.slice(0, 6).map((src) => (
                <div key={src} className="overflow-hidden rounded-md border border-[var(--platform-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="aspect-square h-auto w-full object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid gap-5">
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <ReviewFact label="SKU" value={item.inventory.sku} />
            <ReviewFact label="Category" value={item.product.category} />
            <ReviewFact label="Brand" value={item.product.brandLabel} />
            <ReviewFact label="Supplier" value={item.supplier.label} />
            <ReviewFact label="Supplier account" value={item.supplier.email} />
            <ReviewFact label="Product status" value={item.product.workflowStatus} />
            <ReviewFact label="Selling price" value={formatINR(item.product.sellingPrice)} />
            <ReviewFact
              label="MRP"
              value={item.product.compareAt != null && item.product.compareAt > 0 ? formatINR(item.product.compareAt) : "—"}
            />
            <ReviewFact label="Discount" value={item.product.discountSummary ?? "—"} />
            <ReviewFact label="Existing approved stock" value={String(item.liveQuantity)} />
            <ReviewFact label="Stock at submission" value={String(item.snapshotQuantity)} />
            <ReviewFact label="Newly requested stock" value={String(item.requestedQuantity)} />
            <ReviewFact label="Difference" value={`${deltaPrefix}${item.quantityDelta}`} />
            <ReviewFact label="Stock after approval" value={String(item.resultingQuantity)} />
            <ReviewFact label="Inventory status" value={item.inventory.stockStatus} />
            <ReviewFact label="Product last updated" value={formatTimestamp(item.product.updatedAt)} />
          </dl>

          {item.note ? (
            <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">Supplier note</p>
              <p className="mt-2 text-sm text-[var(--platform-text-primary)]">{item.note}</p>
            </div>
          ) : null}

          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">Product description</p>
            {item.product.descriptionHtml ? (
              <EditorRenderedContent
                html={item.product.descriptionHtml}
                className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3 text-sm text-[var(--platform-text-secondary)]"
              />
            ) : (
              <p className="mt-2 text-sm text-[var(--platform-text-muted)]">No product description provided.</p>
            )}
          </div>

          <div className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">Review signals</p>
            <ul className="mt-2 grid gap-2">
              {item.flags.map((flag) => (
                <li
                  key={flag.message}
                  className={`text-sm ${flag.tone === "warning" ? "text-[var(--platform-warning)]" : "text-[var(--platform-text-secondary)]"}`}
                >
                  {flag.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--platform-border)] pt-4">
        <form action={rejectStockRequestAction}>
          <input type="hidden" name="requestId" value={item.requestId} />
          <OperationalSubmitButton
            pendingLabel="Rejecting"
            className="inline-flex h-9 items-center rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm font-medium text-[var(--platform-danger)] transition hover:bg-[var(--platform-danger-soft)]"
          >
            Reject
          </OperationalSubmitButton>
        </form>
        <form action={approveStockRequestAction}>
          <input type="hidden" name="requestId" value={item.requestId} />
          <OperationalSubmitButton pendingLabel="Applying" className="platform-btn-primary h-9 rounded-[8px] px-3 text-sm font-medium">
            Approve and update stock
          </OperationalSubmitButton>
        </form>
      </div>
    </article>
  );
}

export function AdminStockRequestReviewPanel({ items }: { items: StockRequestReviewItem[] }) {
  if (!items.length) return null;

  return (
    <section className="grid gap-4 rounded-xl border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4">
      <div>
        <h2 className="text-sm font-semibold text-[var(--platform-text-primary)]">Pending supplier stock requests</h2>
        <p className="mt-1 text-sm text-[var(--platform-text-muted)]">
          Review the full product record, supplier context, and inventory impact before approving.
        </p>
      </div>
      <div className="grid gap-4">
        {items.map((item) => (
          <StockRequestReviewCard key={item.requestId} item={item} />
        ))}
      </div>
    </section>
  );
}
