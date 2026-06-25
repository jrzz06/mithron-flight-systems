import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/components/admin/module-panel";
import { OrderReturnForm } from "@/components/customer/order-return-form";
import { OrderReviewForm } from "@/components/customer/order-review-form";
import { createClient } from "@/lib/server";
import { FULFILLMENT_STATUS_LABELS } from "@/lib/orders/status";
import { formatINR } from "@/lib/utils";
import { listCustomerReviewsForOrder } from "@/services/customer-order-reviews";
import { getCustomerOrder } from "@/services/customer-orders";
import { listReturnRequestsForOrder } from "@/services/order-returns";

type TimelineEntry = {
  at?: string;
  event?: string;
  status?: string;
  note?: string | null;
};

function formatAddress(address: Record<string, unknown>) {
  const parts = [
    address.line1,
    address.line2,
    [address.city, address.region, address.postal_code].filter(Boolean).join(", "),
    address.country
  ].filter((part) => typeof part === "string" && part.trim());
  return parts.join("\n");
}

function trackingDetails(tracking: unknown) {
  if (!tracking || typeof tracking !== "object" || Array.isArray(tracking)) return null;
  const record = tracking as Record<string, unknown>;
  const carrier = typeof record.carrier === "string" ? record.carrier : null;
  const trackingNumber = typeof record.tracking === "string"
    ? record.tracking
    : typeof record.tracking_number === "string"
      ? record.tracking_number
      : null;
  if (!carrier && !trackingNumber) return null;
  return { carrier, trackingNumber };
}

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) redirect(`/login?next=/account/orders/${id}`);

  const detail = await getCustomerOrder(userId, id);
  if (!detail) notFound();

  const [returnRequests, reviews] = await Promise.all([
    listReturnRequestsForOrder(id, userId),
    listCustomerReviewsForOrder(id, userId)
  ]);

  const { order, items, payment, shippingAddress } = detail;
  const fulfillmentStatus = String(order.fulfillment_status ?? "pending");
  const canReturn = fulfillmentStatus === "delivered" || String(order.status ?? "") === "delivered";
  const canReview = fulfillmentStatus === "delivered";
  const activeReturn = returnRequests.find((row) => !["cancelled", "rejected", "refunded"].includes(String(row.status ?? "")));
  const fulfillmentLabel = FULFILLMENT_STATUS_LABELS[fulfillmentStatus as keyof typeof FULFILLMENT_STATUS_LABELS]
    ?? fulfillmentStatus.replaceAll("_", " ");
  const timeline = Array.isArray(order.timeline)
    ? (order.timeline as TimelineEntry[]).filter((entry) => entry && typeof entry === "object")
    : [];
  const tracking = trackingDetails(order.shipment_tracking);

  return (
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
      <Link href="/account/orders" className="text-sm text-emerald-400">Back to orders</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h2 className="type-section">{String(order.order_number ?? order.id)}</h2>
        <StatusBadge status={String(order.status ?? "pending")} />
        <StatusBadge status={fulfillmentStatus} />
      </div>
      <p className="mt-2 text-sm text-white/60">Fulfillment: {fulfillmentLabel}</p>
      <p className="mt-1 text-sm text-white/60">Payment: {String(order.payment_status ?? "pending")}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">Shipping address</h3>
          {shippingAddress ? (
            <p className="mt-3 whitespace-pre-line text-sm text-white/80">{formatAddress(shippingAddress)}</p>
          ) : (
            <p className="mt-3 text-sm text-white/50">No shipping address on file.</p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">Tracking</h3>
          {tracking ? (
            <div className="mt-3 space-y-1 text-sm text-white/80">
              {tracking.carrier ? <p>Carrier: {tracking.carrier}</p> : null}
              {tracking.trackingNumber ? <p>Tracking: {tracking.trackingNumber}</p> : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-white/50">Tracking will appear once your order ships.</p>
          )}
        </section>
      </div>

      {payment ? (
        <section className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">Payment receipt</h3>
          <div className="mt-3 grid gap-2 text-sm text-white/80 sm:grid-cols-2">
            <p>Amount: {formatINR(Number(payment.amount ?? order.total ?? 0))}</p>
            <p>Status: {String(payment.status ?? "pending")}</p>
            <p>Provider: {String(payment.provider ?? "—")}</p>
            <p>Reference: {String(payment.provider_payment_id ?? payment.provider_intent_id ?? "—")}</p>
            {payment.verified_at ? <p>Verified: {String(payment.verified_at).slice(0, 19).replace("T", " ")}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">Order timeline</h3>
        {timeline.length ? (
          <div className="mt-4 grid gap-3">
            {timeline.map((entry, index) => (
              <div key={`${entry.at ?? index}-${entry.event ?? index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{String(entry.event ?? "update").replaceAll(".", " ")}</p>
                  {entry.status ? <StatusBadge status={String(entry.status)} /> : null}
                </div>
                {entry.note ? <p className="mt-2 text-sm text-white/60">{entry.note}</p> : null}
                {entry.at ? <p className="mt-2 text-xs text-white/40">{String(entry.at).slice(0, 19).replace("T", " ")}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/50">No timeline events yet.</p>
        )}
      </section>

      <div className="mt-8 grid gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">Items</h3>
        {items.map((item) => {
          const slug = String(item.product_slug ?? "");
          const review = reviews.find((row) => String(row.product_slug) === slug);
          return (
            <div key={String(item.id)} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4">
              <p className="font-semibold text-white">{String(item.product_name ?? item.product_slug)}</p>
              <p className="mt-1 text-sm text-white/60">
                Qty {String(item.quantity ?? 1)} · {formatINR(Number(item.line_total ?? 0))}
              </p>
              <OrderReviewForm
                orderId={id}
                productSlug={slug}
                productName={String(item.product_name ?? slug)}
                disabled={!canReview}
                existingStatus={review ? String(review.status ?? "pending") : null}
              />
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">Returns</h3>
        {activeReturn ? (
          <p className="mt-3 text-sm text-white/70">
            Return request status: <StatusBadge status={String(activeReturn.status ?? "requested")} />
          </p>
        ) : (
          <div className="mt-4">
            <OrderReturnForm orderId={id} disabled={!canReturn} />
          </div>
        )}
      </section>
    </div>
  );
}
