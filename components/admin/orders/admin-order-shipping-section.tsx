"use client";

import Link from "next/link";
import { formatAddressInline, pickAddressFromMetadata } from "@/lib/addresses/format";
import { OrderDetailSection, OrderField, OrderFieldGrid } from "@/components/admin/orders/order-detail-primitives";
import { OrderStatusBadge } from "@/components/admin/orders/order-status-badge";
import {
  assignedWarehouseCode,
  orderMetadata,
  text,
  type AdminRow
} from "@/components/admin/orders/order-view-helpers";

type AdminOrderShippingSectionProps = {
  order: AdminRow;
  shipments: AdminRow[];
  defaultWarehouseCode: string;
};

function readShipmentTracking(order: AdminRow) {
  const raw = order.shipment_tracking;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function AdminOrderShippingSection({
  order,
  shipments,
  defaultWarehouseCode
}: AdminOrderShippingSectionProps) {
  const metadata = orderMetadata(order);
  const shippingAddress = formatAddressInline(pickAddressFromMetadata(metadata, "shipping"));
  const billingAddress = formatAddressInline(pickAddressFromMetadata(metadata, "billing"));
  const billingSameAsShipping = metadata.billing_same_as_shipping !== false;
  const warehouse = assignedWarehouseCode(order, defaultWarehouseCode);
  const tracking = readShipmentTracking(order);

  return (
    <OrderDetailSection title="Shipping">
      <div className="mb-4">
        <OrderStatusBadge status={text(order.fulfillment_status, "pending")} />
      </div>
      <OrderFieldGrid columns={2}>
        <OrderField
          label="Warehouse"
          value={
            <Link href="/warehouse/orders" className="text-violet-300 hover:underline">
              {warehouse}
            </Link>
          }
        />
        {shippingAddress ? <OrderField label="Shipping address" value={shippingAddress} /> : null}
        {billingAddress ? (
          <OrderField
            label="Billing address"
            value={`${billingAddress}${billingSameAsShipping ? " (same as shipping)" : ""}`}
          />
        ) : null}
        {text(tracking?.carrier) ? <OrderField label="Courier" value={text(tracking?.carrier)} /> : null}
        {text(tracking?.tracking) ? <OrderField label="Tracking" value={text(tracking?.tracking)} /> : null}
        {text(tracking?.estimated_delivery) ? (
          <OrderField label="ETA" value={text(tracking?.estimated_delivery)} />
        ) : null}
      </OrderFieldGrid>
      {shipments.length ? (
        <ul className="mt-4 space-y-2">
          {shipments.map((shipment) => (
            <li
              key={text(shipment.id)}
              className="rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-4 py-3 text-sm text-[var(--platform-text-secondary)]"
            >
              {text(shipment.shipment_number, "Shipment")} · {text(shipment.shipment_status, "pending")}
              {text(shipment.carrier_name) ? ` · ${text(shipment.carrier_name)}` : ""}
              {text(shipment.tracking_number) ? ` · ${text(shipment.tracking_number)}` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-[var(--platform-text-muted)]">No shipments created yet.</p>
      )}
    </OrderDetailSection>
  );
}
