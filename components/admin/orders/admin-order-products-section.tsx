"use client";

import Link from "next/link";
import { calculateProductTaxBreakdown } from "@/lib/product-tax";
import { resolveNextImageSrc } from "@/lib/media/next-image-src";
import {
  OrderDetailSection,
  OrderField,
  OrderFieldGrid,
  OrderStockBadge,
  orderHoverClass
} from "@/components/admin/orders/order-detail-primitives";
import { OrderProductThumbnail } from "@/components/admin/orders/order-product-thumbnail";
import {
  assignedWarehouseCode,
  moneyText,
  numberText,
  resolveProductImage,
  text,
  type AdminRow
} from "@/components/admin/orders/order-view-helpers";

type CatalogProduct = {
  slug: string;
  chargeTax?: boolean | null;
  taxRate?: number | null;
  taxIncluded?: boolean | null;
  taxGroup?: string | null;
  price?: number;
};

type AdminOrderProductsSectionProps = {
  items: AdminRow[];
  products: AdminRow[];
  stock: AdminRow[];
  order: AdminRow;
  defaultWarehouseCode: string;
  catalogProducts: CatalogProduct[];
};

export function AdminOrderProductsSection({
  items,
  products,
  stock,
  order,
  defaultWarehouseCode,
  catalogProducts
}: AdminOrderProductsSectionProps) {
  const warehouse = assignedWarehouseCode(order, defaultWarehouseCode);

  return (
    <OrderDetailSection title="Products" dataAttribute="data-inventory-allocation">
      <div className="grid gap-4">
        {items.length ? (
          items.map((item) => {
            const slug = text(item.product_slug);
            const sku = text(item.sku);
            const itemMeta =
              item.metadata && typeof item.metadata === "object" && !Array.isArray(item.metadata)
                ? (item.metadata as Record<string, unknown>)
                : {};
            const variant = text(itemMeta.variant_label) || text(itemMeta.variant) || sku || "—";
            const catalog = catalogProducts.find((row) => row.slug === slug);
            const qty = Number(item.quantity ?? 1) || 1;
            const lineTotal = Number(item.line_total ?? 0) || 0;
            const unitPrice = qty > 0 ? lineTotal / qty : lineTotal;
            const tax = calculateProductTaxBreakdown({
              unitPrice,
              quantity: qty,
              chargeTax: catalog?.chargeTax,
              taxRate: catalog?.taxRate,
              taxIncluded: catalog?.taxIncluded,
              taxGroup: catalog?.taxGroup
            });
            const stockRow =
              stock.find((row) => text(row.product_slug) === slug && text(row.sku) === sku) ??
              stock.find((row) => text(row.product_slug) === slug && text(row.warehouse_code) === warehouse);
            const available = Number(stockRow?.available_quantity ?? 0);
            const image = resolveProductImage(products, slug);
            const imageSrc = image ? resolveNextImageSrc(image) : null;
            const productName = text(item.product_name, slug || "Product");

            return (
              <article
                key={text(item.id) || `${slug}-${sku}`}
                className={`grid gap-5 rounded-lg border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-5 md:grid-cols-[96px_1fr_auto] ${orderHoverClass()} hover:border-[var(--platform-border-strong)]`}
              >
                <OrderProductThumbnail src={imageSrc} alt={productName} size="detail" />
                <div className="min-w-0 space-y-3">
                  <p className="text-base font-semibold text-[var(--platform-text-primary)]">
                    {slug ? (
                      <Link
                        href={`/admin/products?product_slug=${encodeURIComponent(slug)}`}
                        className="hover:text-violet-300 hover:underline"
                      >
                        {productName}
                      </Link>
                    ) : (
                      productName
                    )}
                  </p>
                  <OrderFieldGrid columns={2}>
                    <OrderField label="SKU" value={sku || "—"} />
                    <OrderField label="Variant" value={variant} />
                    <OrderField label="Quantity" value={numberText(item.quantity)} />
                    <OrderField label="Unit price" value={moneyText(unitPrice)} />
                    <OrderField label="GST" value={moneyText(tax.taxAmount)} />
                    <OrderField label="Line total" value={moneyText(lineTotal)} />
                    <OrderField label="Warehouse" value={warehouse} />
                    <OrderField label="Available" value={numberText(available)} />
                  </OrderFieldGrid>
                </div>
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <OrderStockBadge available={available} />
                  {slug ? (
                    <Link
                      href={`/admin/products?product_slug=${encodeURIComponent(slug)}`}
                      className="inline-flex h-10 items-center rounded-lg border border-[var(--platform-border-strong)] px-4 text-sm font-medium text-violet-300 hover:bg-[var(--platform-surface)]"
                    >
                      View product
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <p className="text-sm text-[var(--platform-text-muted)]">No order items found.</p>
        )}
      </div>
    </OrderDetailSection>
  );
}
