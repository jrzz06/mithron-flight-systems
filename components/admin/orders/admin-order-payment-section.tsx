"use client";

import { useEffect, useState } from "react";
import { readPaymentLifecycle } from "@/lib/orders/payment-lifecycle";
import {
  OrderDetailSection,
  OrderField,
  OrderFieldGrid,
  orderHoverClass
} from "@/components/admin/orders/order-detail-primitives";
import { OrderStatusBadge } from "@/components/admin/orders/order-status-badge";
import { moneyText, orderMetadata, text, type AdminRow } from "@/components/admin/orders/order-view-helpers";

type PaymentRow = {
  provider?: string;
  provider_payment_id?: string;
  provider_intent_id?: string;
  status?: string;
  verified_at?: string;
  amount?: number;
};

type EnrichmentPayload = {
  payments?: PaymentRow[];
  activity?: AdminRow[];
};

type AdminOrderPaymentSectionProps = {
  order: AdminRow;
  orderId: string;
};

export function AdminOrderPaymentSection({ order, orderId }: AdminOrderPaymentSectionProps) {
  const metadata = orderMetadata(order);
  const lifecycleState = readPaymentLifecycle(metadata);
  const paymentLifecycle =
    metadata.payment_lifecycle && typeof metadata.payment_lifecycle === "object" && !Array.isArray(metadata.payment_lifecycle)
      ? (metadata.payment_lifecycle as Record<string, unknown>)
      : {};
  const paymentProvider = text(metadata.payment_provider) || text(paymentLifecycle.provider);
  const paymentMethod = text(metadata.payment_method);
  const [enrichment, setEnrichment] = useState<EnrichmentPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/enrichment`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { payments: [], activity: [] }))
      .then((payload: EnrichmentPayload) => {
        if (!cancelled) setEnrichment(payload);
      })
      .catch(() => {
        if (!cancelled) setEnrichment({ payments: [], activity: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const payments = enrichment?.payments ?? [];
  const primaryPayment = payments[0];

  return (
    <OrderDetailSection title="Payment">
      <div className="mb-4">
        <OrderStatusBadge status={text(order.payment_status, "not_required")} />
      </div>
      <OrderFieldGrid columns={2}>
        <OrderField label="Method" value={paymentMethod || paymentProvider || "—"} />
        <OrderField label="Provider" value={paymentProvider || "—"} />
        <OrderField label="Verification" value={lifecycleState.replaceAll("_", " ")} />
        <OrderField label="Total" value={moneyText(order.total)} />
      </OrderFieldGrid>
      {loading ? (
        <p className="mt-4 text-sm text-[var(--platform-text-muted)]">Loading gateway details…</p>
      ) : primaryPayment ? (
        <div className={`mt-4 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4 ${orderHoverClass()}`}>
          <OrderFieldGrid columns={2}>
            <OrderField label="Transaction ID" value={text(primaryPayment.provider_payment_id, "—")} />
            <OrderField label="Intent ID" value={text(primaryPayment.provider_intent_id, "—")} />
            <OrderField label="Gateway status" value={text(primaryPayment.status, "—")} />
            {primaryPayment.verified_at ? (
              <OrderField
                label="Verified"
                value={text(primaryPayment.verified_at).slice(0, 19).replace("T", " ")}
              />
            ) : null}
          </OrderFieldGrid>
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--platform-text-muted)]">No gateway payment record.</p>
      )}
      {text(order.status) === "refunded" ? (
        <p className="mt-3 text-sm text-rose-300">Refund recorded</p>
      ) : null}
    </OrderDetailSection>
  );
}
