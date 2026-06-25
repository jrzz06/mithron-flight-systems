"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/admin/module-panel";
import { FULFILLMENT_STATUS_LABELS } from "@/lib/orders/status";
import { formatINR } from "@/lib/utils";

type TimelineEntry = {
  at?: string;
  event?: string;
  status?: string;
  note?: string | null;
};

type TrackingResult = {
  order: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
};

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

export function TrackOrderClient() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ orderNumber, email });
      const response = await fetch(`/api/orders/track?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) {
        setError(typeof payload.error === "string" ? payload.error : "Order not found.");
        return;
      }
      setResult({ order: payload.order, items: payload.items ?? [] });
    } catch {
      setError("Could not look up your order. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const order = result?.order;
  const fulfillmentStatus = order ? String(order.fulfillment_status ?? "pending") : "";
  const fulfillmentLabel = FULFILLMENT_STATUS_LABELS[fulfillmentStatus as keyof typeof FULFILLMENT_STATUS_LABELS]
    ?? fulfillmentStatus.replaceAll("_", " ");
  const timeline = order && Array.isArray(order.timeline)
    ? (order.timeline as TimelineEntry[]).filter((entry) => entry && typeof entry === "object")
    : [];
  const tracking = order ? trackingDetails(order.shipment_tracking) : null;

  return (
    <div className="grid gap-8">
      <form onSubmit={onSubmit} className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
        <p className="text-sm text-white/60">Enter your order number and the email used at checkout.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm text-white/70">
            Order number
            <input
              required
              value={orderNumber}
              onChange={(event) => setOrderNumber(event.target.value)}
              className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 py-3 text-white"
              placeholder="MTH-..."
            />
          </label>
          <label className="grid gap-2 text-sm text-white/70">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 py-3 text-white"
              placeholder="you@example.com"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-emerald-500 px-6 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? "Looking up…" : "Track order"}
        </button>
        {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}
      </form>

      {order ? (
        <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="type-section">{String(order.order_number ?? order.id)}</h2>
            <StatusBadge status={String(order.status ?? "pending")} />
            <StatusBadge status={fulfillmentStatus} />
          </div>
          <p className="mt-2 text-sm text-white/60">Fulfillment: {fulfillmentLabel}</p>
          <p className="mt-1 text-sm text-white/60">Payment: {String(order.payment_status ?? "pending")}</p>
          <p className="mt-1 text-sm text-white/60">Total: {formatINR(Number(order.total ?? 0))}</p>

          {tracking ? (
            <div className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-5 text-sm text-white/80">
              {tracking.carrier ? <p>Carrier: {tracking.carrier}</p> : null}
              {tracking.trackingNumber ? <p className="mt-1">Tracking: {tracking.trackingNumber}</p> : null}
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/50">Tracking will appear once your order ships.</p>
          )}

          {timeline.length ? (
            <div className="mt-8 grid gap-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">Timeline</h3>
              {timeline.map((entry, index) => (
                <div key={`${entry.at ?? index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4">
                  <p className="font-medium text-white">{String(entry.event ?? "update").replaceAll(".", " ")}</p>
                  {entry.note ? <p className="mt-2 text-sm text-white/60">{entry.note}</p> : null}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-8 grid gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/50">Items</h3>
            {(result?.items ?? []).map((item, index) => (
              <div key={`${item.product_slug}-${index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4">
                <p className="font-semibold text-white">{String(item.product_name ?? item.product_slug)}</p>
                <p className="mt-1 text-sm text-white/60">
                  Qty {String(item.quantity ?? 1)} · {formatINR(Number(item.line_total ?? 0))}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
