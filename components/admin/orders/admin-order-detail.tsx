"use client";

import { useEffect, useRef } from "react";
import { AdminOrderCustomerSection } from "@/components/admin/orders/admin-order-customer-section";
import { AdminOrderInvoiceSection } from "@/components/admin/orders/admin-order-invoice-section";
import { AdminOrderNotesSection } from "@/components/admin/orders/admin-order-notes-section";
import { AdminOrderPaymentSection } from "@/components/admin/orders/admin-order-payment-section";
import { AdminOrderProductsSection } from "@/components/admin/orders/admin-order-products-section";
import { AdminOrderShippingSection } from "@/components/admin/orders/admin-order-shipping-section";
import { AdminOrderSummarySection } from "@/components/admin/orders/admin-order-summary-section";
import { AdminOrderTimeline } from "@/components/admin/orders/admin-order-timeline";
import { OrderDetailShell } from "@/components/admin/orders/order-detail-primitives";
import { orderItemsForOrder, type AdminRow } from "@/components/admin/orders/order-view-helpers";

type CatalogProduct = {
  slug: string;
  name: string;
  price: number;
  chargeTax?: boolean | null;
  taxRate?: number | null;
  taxIncluded?: boolean | null;
  taxGroup?: string | null;
};

type AdminOrderDetailProps = {
  order: AdminRow;
  orderId: string;
  allOrders: AdminRow[];
  orderItems: AdminRow[];
  products: AdminRow[];
  stock: AdminRow[];
  shipments: AdminRow[];
  catalogProducts: CatalogProduct[];
  defaultWarehouseCode: string;
  queue: string;
  filtersQuery: string;
  onSelectOrder?: (orderNumber: string) => void;
};

export function AdminOrderDetail({
  order,
  orderId,
  allOrders,
  orderItems,
  products,
  stock,
  shipments,
  catalogProducts,
  defaultWarehouseCode,
  queue,
  filtersQuery,
  onSelectOrder
}: AdminOrderDetailProps) {
  const items = orderItemsForOrder(orderId, orderItems);
  const selectedShipments = shipments.filter((shipment) => String(shipment.order_id) === orderId);
  const detailScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    detailScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [orderId]);

  return (
    <OrderDetailShell scrollRef={detailScrollRef}>
      <AdminOrderSummarySection order={order} defaultWarehouseCode={defaultWarehouseCode} />
      <AdminOrderCustomerSection
        order={order}
        allOrders={allOrders}
        queue={queue}
        filtersQuery={filtersQuery}
        onSelectOrder={onSelectOrder}
      />
      <AdminOrderProductsSection
        items={items}
        products={products}
        stock={stock}
        order={order}
        defaultWarehouseCode={defaultWarehouseCode}
        catalogProducts={catalogProducts}
      />
      <AdminOrderShippingSection
        order={order}
        shipments={selectedShipments}
        defaultWarehouseCode={defaultWarehouseCode}
      />
      <AdminOrderPaymentSection key={orderId} order={order} orderId={orderId} />
      <AdminOrderInvoiceSection order={order} orderId={orderId} />
      <AdminOrderTimeline order={order} />
      <AdminOrderNotesSection order={order} />
    </OrderDetailShell>
  );
}
