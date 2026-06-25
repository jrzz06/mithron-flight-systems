"use client";

import { ProductFieldLabel } from "@/components/admin/product-info-tooltip";
import { ProductPricingFields } from "@/components/admin/product-pricing-fields";
import { ProductSimpleRichText } from "@/components/admin/product-simple-rich-text";
import { ProductTaxFields } from "@/components/admin/product-tax-fields";
import type { ProductCatalogGridRow } from "@/app/admin/products/product-catalog-grid";
import { saveProductQuickEditFormAction } from "@/app/admin/products/actions";
import type { ProductDiscountType } from "@/lib/product-pricing";

export function ProductDetailEditDialog({
  product,
  onClose,
  onSaved
}: {
  product: ProductCatalogGridRow;
  onClose: () => void;
  onSaved: (fields: Partial<ProductCatalogGridRow>) => void;
}) {
  return (
    <div data-product-detail-modal className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-[2px]">
      <form
        id="update-product"
        action={saveProductQuickEditFormAction}
        data-product-quick-edit
        onSubmit={(event) => {
          const formData = new FormData(event.currentTarget);
          onSaved({
            title: String(formData.get("name") ?? product.title),
            category: String(formData.get("category") ?? product.category),
            price: String(formData.get("list_price") ?? product.price),
            badge: String(formData.get("ribbon") ?? product.badge ?? ""),
            description: String(formData.get("description") ?? product.description ?? ""),
            sourceAvailability: String(formData.get("source_availability") ?? product.sourceAvailability),
            isVisible: formData.get("visibility") === "visible",
            onSale: formData.get("on_sale") === "true",
            discountType: String(formData.get("discount_type") ?? product.discountType ?? "amount") as ProductDiscountType,
            discountValue: String(formData.get("discount_value") ?? product.discountValue ?? ""),
            costOfGoods: String(formData.get("cost_of_goods") ?? product.costOfGoods ?? ""),
            showPricePerUnit: formData.get("show_price_per_unit") === "true",
            chargeTax: formData.get("charge_tax") === "true",
            taxGroup: String(formData.get("tax_group") ?? product.taxGroup ?? "products-default"),
            taxRate: String(formData.get("tax_rate") ?? product.taxRate ?? ""),
            taxIncluded: formData.get("tax_included") === "true"
          });
          onClose();
        }}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[var(--platform-radius-lg)] bg-[var(--platform-surface)] shadow-none"
      >
        <input type="hidden" name="product_slug" value={product.id} />
        <input type="hidden" name="change_summary" value={`Edit product details ${product.id}`} />
        {product.updatedAt ? <input type="hidden" name="expected_updated_at" value={product.updatedAt} /> : null}

        <div className="flex items-start justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--platform-text-muted)]">Product info</p>
            <h2 className="mt-1 text-lg font-medium text-[var(--platform-text-primary)]">Edit product</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--platform-text-secondary)] transition hover:bg-[var(--platform-accent-soft)] hover:text-[var(--platform-text-primary)]"
          >
            Cancel
          </button>
        </div>

        <div className="grid gap-5 overflow-y-auto px-5 py-5">
          <section data-product-basic-info className="grid gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--platform-text-muted)]">Basic info</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm sm:col-span-2">
                <ProductFieldLabel>Name</ProductFieldLabel>
                <input
                  name="name"
                  defaultValue={product.title}
                  className="h-10 w-full rounded-[10px] border-0 bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)] outline-none focus:bg-[var(--platform-accent-soft)] focus:ring-2 focus:ring-[var(--platform-focus-ring)]"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <ProductFieldLabel tooltip="Short label shown on the product card, e.g. New Arrival or Best Seller.">
                  Ribbon
                </ProductFieldLabel>
                <input
                  name="ribbon"
                  defaultValue={product.badge ?? ""}
                  placeholder="New Arrival"
                  className="h-10 w-full rounded-[10px] border-0 bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)] outline-none placeholder:text-[var(--platform-text-muted)] focus:bg-[var(--platform-accent-soft)] focus:ring-2 focus:ring-[var(--platform-focus-ring)]"
                />
              </label>
              <label className="grid gap-1.5 text-sm">
                <ProductFieldLabel>Category</ProductFieldLabel>
                <input
                  name="category"
                  defaultValue={product.category}
                  className="h-10 w-full rounded-[10px] border-0 bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)] outline-none focus:bg-[var(--platform-accent-soft)] focus:ring-2 focus:ring-[var(--platform-focus-ring)]"
                />
              </label>
            </div>

            <label className="grid gap-1.5 text-sm">
              <ProductFieldLabel>Description</ProductFieldLabel>
              <ProductSimpleRichText
                name="description"
                variant="dark"
                defaultValue={product.description ?? ""}
                placeholder="Describe features, payload, and warranty details..."
              />
            </label>
          </section>

          <ProductPricingFields
            initialPrice={Number(product.price) || 0}
            initialCompareAt={product.compareAt ? Number(product.compareAt) : null}
            initialOnSale={product.onSale}
            initialDiscountType={product.discountType}
            initialDiscountValue={product.discountValue ? Number(product.discountValue) : null}
            initialCostOfGoods={product.costOfGoods ? Number(product.costOfGoods) : null}
            initialShowPricePerUnit={product.showPricePerUnit}
          />

          <ProductTaxFields
            initialChargeTax={product.chargeTax ?? true}
            initialTaxGroup={product.taxGroup ?? "products-default"}
            initialTaxRate={product.taxRate ? Number(product.taxRate) : null}
            initialTaxIncluded={product.taxIncluded}
          />

          <section className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">
              <ProductFieldLabel>Stock</ProductFieldLabel>
              <input
                name="source_availability"
                defaultValue={product.sourceAvailability}
                className="h-10 w-full rounded-[10px] border-0 bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)] outline-none focus:bg-[var(--platform-accent-soft)] focus:ring-2 focus:ring-[var(--platform-focus-ring)]"
              />
            </label>
            <label className="grid gap-1.5 text-sm">
              <ProductFieldLabel>Visibility</ProductFieldLabel>
              <select
                name="visibility"
                defaultValue={product.isVisible ? "visible" : "hidden"}
                className="h-10 w-full rounded-[10px] border-0 bg-[var(--platform-surface)] px-3 text-sm text-[var(--platform-text-primary)] outline-none focus:bg-[var(--platform-accent-soft)] focus:ring-2 focus:ring-[var(--platform-focus-ring)]"
              >
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
          </section>
        </div>

        <div className="flex justify-end px-5 py-4">
          <button className="platform-btn-primary rounded-lg px-4 py-2 text-sm font-medium">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}
