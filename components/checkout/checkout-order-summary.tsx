"use client";

import Link from "next/link";
import { memo, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, FileText, MapPin, Receipt } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import type { CartItem } from "@/config/types";
import { QuantityStepper } from "@/components/checkout/quantity-stepper";
import { MithronThumbImage } from "@/components/media/mithron-thumb-image";
import { summarizeCartTax } from "@/lib/product-tax";
import { deriveProductSku } from "@/lib/product-sku";
import { cn, formatINR } from "@/lib/utils";
import { useCartStore } from "@/store/cart";
import styles from "@/app/(storefront)/checkout/checkout.module.css";

type ShippingDestination = {
  label?: string;
  line1?: string;
  city?: string;
  region?: string;
  postalCode?: string;
};

type CheckoutOrderSummaryProps = {
  paymentProvider?: string;
  promoCode?: string;
  shippingDestination?: ShippingDestination | null;
  checkoutBusy?: boolean;
  className?: string;
};

type PricingLineProps = {
  label: string;
  value: string;
  hint?: string;
  emphasis?: "default" | "muted" | "total";
};

function formatProviderLabel(provider: string) {
  if (!provider || provider === "stub") return "Secure payment gateway";
  if (provider === "razorpay") return "Razorpay";
  if (provider === "cashfree") return "Cashfree";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

function formatShippingLines(destination: ShippingDestination | null | undefined) {
  if (!destination) return null;

  const line1 = destination.line1?.trim() ?? "";
  const city = destination.city?.trim() ?? "";
  const region = destination.region?.trim() ?? "";
  const postalCode = destination.postalCode?.trim() ?? "";
  const label = destination.label?.trim() ?? "";

  if (!line1 && !city && !postalCode) return null;

  const lines: string[] = [];
  const showLabel = label.length > 0 && label.toLowerCase() !== "shipping";
  if (showLabel) lines.push(label);
  if (line1) lines.push(line1);

  const cityLine = [city, region, postalCode].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);

  return lines.length ? lines : null;
}

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
      {children}
    </h3>
  );
}

function PricingLine({ label, value, hint, emphasis = "default" }: PricingLineProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-0.5",
        emphasis === "total" && "border-t border-slate-200 pt-4"
      )}
    >
      <div className="min-w-0">
        <span
          className={cn(
            "block text-sm leading-5",
            emphasis === "total" && "text-base font-semibold text-slate-900",
            emphasis === "default" && "text-slate-700",
            emphasis === "muted" && "text-slate-500"
          )}
        >
          {label}
        </span>
        {hint ? <span className="mt-0.5 block text-xs leading-4 text-slate-500">{hint}</span> : null}
      </div>
      <span
        className={cn(
          "shrink-0 text-right tabular-nums",
          emphasis === "total" && "text-xl font-semibold tracking-tight text-slate-900",
          emphasis === "default" && "text-sm font-medium text-slate-900",
          emphasis === "muted" && "text-sm text-slate-600"
        )}
      >
        {value}
      </span>
    </div>
  );
}

const CheckoutSummaryLineItem = memo(function CheckoutSummaryLineItem({
  item,
  onQuantityChange,
  quantityBusy
}: {
  item: CartItem;
  onQuantityChange: (productSlug: string, bundleId: string, quantity: number) => void;
  quantityBusy?: boolean;
}) {
  const sku = item.sku ?? deriveProductSku(item.productSlug);
  const lineTotal = item.unitPrice * item.quantity;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[var(--elevation-card-rest)]">
      <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4">
        <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          <MithronThumbImage
            src={item.image}
            alt={item.productName}
            fill
            className="object-contain p-3"
            sizes="104px"
          />
        </div>
        <div className="min-w-0">
          {item.category ? (
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">{item.category}</p>
          ) : null}
          <h4 className="mt-1 text-lg font-semibold leading-snug tracking-tight text-slate-900">{item.productName}</h4>
          <p className="mt-1 text-sm leading-5 text-slate-600">{item.bundleName}</p>
          <p className="mt-2 text-xs text-slate-500">
            SKU <span className="font-mono text-[11px] uppercase tracking-wide text-slate-600">{sku}</span>
          </p>
          {item.availabilityLabel ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {item.availabilityLabel}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="grid gap-1">
          <span className="text-xs font-medium text-slate-500">Quantity</span>
          <QuantityStepper
            value={item.quantity}
            label={item.productName}
            loading={quantityBusy}
            onChange={(next) => onQuantityChange(item.productSlug, item.bundleId, next)}
          />
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">Line total</p>
          <p className="text-base font-semibold tabular-nums text-slate-900">{formatINR(lineTotal)}</p>
          <p className="mt-0.5 text-xs tabular-nums text-slate-500">{formatINR(item.unitPrice)} each</p>
        </div>
      </div>
    </article>
  );
});

function SummaryPanel({
  items,
  pricing,
  paymentProvider,
  promoCode,
  shippingDestination,
  onQuantityChange,
  quantityBusy
}: {
  items: CartItem[];
  pricing: ReturnType<typeof summarizeCartTax>;
  paymentProvider?: string;
  promoCode?: string;
  shippingDestination?: ShippingDestination | null;
  onQuantityChange: (productSlug: string, bundleId: string, quantity: number) => void;
  quantityBusy?: boolean;
}) {
  const shippingLines = formatShippingLines(shippingDestination);
  const gstIncludedInPrices = items.length > 0 && items.every((item) => item.taxIncluded);
  const hasPromoCode = Boolean(promoCode?.trim());

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <section aria-labelledby="checkout-products">
        <SectionHeading id="checkout-products">Products</SectionHeading>
        <div className="mt-3 max-h-[min(52vh,520px)] space-y-3 overflow-y-auto pr-0.5 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
          {items.map((item) => (
            <CheckoutSummaryLineItem
              key={`${item.productSlug}-${item.bundleId}`}
              item={item}
              onQuantityChange={onQuantityChange}
              quantityBusy={quantityBusy}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="checkout-pricing-breakdown" className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <SectionHeading id="checkout-pricing-breakdown">Pricing breakdown</SectionHeading>
        <div className="mt-3 grid gap-2.5">
          <PricingLine label="Subtotal" value={formatINR(pricing.subtotal)} />
          <PricingLine
            label="Discount"
            value={hasPromoCode ? "Applied at checkout" : formatINR(0)}
            hint={hasPromoCode ? promoCode?.trim() : undefined}
            emphasis={hasPromoCode ? "default" : "muted"}
          />
          <PricingLine
            label="Shipping"
            value={formatINR(0)}
            hint="Included with standard delivery"
            emphasis="muted"
          />
          {pricing.taxTotal > 0 ? <PricingLine label="GST" value={formatINR(pricing.taxTotal)} /> : null}
          <PricingLine label="Total payable" value={formatINR(pricing.total)} emphasis="total" />
        </div>
      </section>

      <section aria-labelledby="checkout-payment-info" className="rounded-2xl border border-slate-200 bg-white p-4">
        <SectionHeading id="checkout-payment-info">Payment</SectionHeading>
        <dl className="mt-3 grid gap-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-600">Payment method</dt>
            <dd className="font-medium text-slate-900">{formatProviderLabel(paymentProvider ?? "")}</dd>
          </div>
        </dl>
        {(gstIncludedInPrices || pricing.taxTotal > 0) ? (
          <ul className="mt-3 grid gap-2 text-sm text-slate-700">
            {gstIncludedInPrices ? (
              <li className="flex items-start gap-2">
                <Receipt className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
                <span>GST included in listed prices</span>
              </li>
            ) : null}
            <li className="flex items-start gap-2">
              <FileText className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
              <span>GST invoice issued after successful payment</span>
            </li>
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="checkout-delivery-info" className="rounded-2xl border border-slate-200 bg-white p-4">
        <SectionHeading id="checkout-delivery-info">Delivery</SectionHeading>
        {shippingLines ? (
          <div className="mt-3 flex items-start gap-2.5 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
            <address className="not-italic text-slate-700">
              {shippingLines.map((line) => (
                <span key={line} className="block leading-relaxed">
                  {line}
                </span>
              ))}
            </address>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Enter your shipping address to see delivery details.</p>
        )}
      </section>
    </div>
  );
}
function SummaryShell({
  children,
  itemCount,
  total,
  className
}: {
  children: ReactNode;
  itemCount: number;
  total: number;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[var(--elevation-card-rest)] lg:sticky lg:top-24 lg:p-7",
        className
      )}
    >
      <header className="border-b border-slate-200 pb-5">
        <p className={styles.eyebrow}>Order summary</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Review your order</h2>
          <p className="text-sm text-slate-500">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Total payable: <span className="font-semibold tabular-nums text-slate-900">{formatINR(total)}</span>
        </p>
      </header>
      <div className="mt-5">{children}</div>
    </aside>
  );
}

export function CheckoutOrderSummary({
  paymentProvider,
  promoCode,
  shippingDestination,
  checkoutBusy = false,
  className
}: CheckoutOrderSummaryProps) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const { items, setQuantity } = useCartStore(
    useShallow((state) => ({
      items: state.items,
      setQuantity: state.setQuantity
    }))
  );

  const pricing = useMemo(() => summarizeCartTax(items), [items]);
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  if (!items.length) {
    return (
      <aside
        className={cn(
          "rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[var(--elevation-card-rest)] lg:sticky lg:top-24 lg:p-7",
          className
        )}
      >
        <p className={styles.eyebrow}>Order summary</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Your cart is empty</h2>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Add products to your cart before completing checkout.{" "}
          <Link href="/products" className="font-medium text-emerald-700 underline-offset-2 hover:underline">
            Browse products
          </Link>
        </p>
      </aside>
    );
  }

  const panelProps = {
    items,
    pricing,
    paymentProvider,
    promoCode,
    shippingDestination,
    onQuantityChange: setQuantity,
    quantityBusy: checkoutBusy
  };

  return (
    <>
      <div className="hidden lg:block">
        <SummaryShell itemCount={itemCount} total={pricing.total} className={className}>
          <SummaryPanel {...panelProps} />
        </SummaryShell>
      </div>

      <div className="lg:hidden">
        <section className={cn("overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[var(--elevation-card-rest)]", className)}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f6b46] focus-visible:ring-inset"
            aria-expanded={mobileExpanded}
            onClick={() => setMobileExpanded((current) => !current)}
          >
            <div>
              <p className={styles.eyebrow}>Order summary</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-lg font-semibold tabular-nums text-slate-900">{formatINR(pricing.total)}</p>
              <ChevronDown
                className={cn("size-5 text-slate-500 transition-transform", mobileExpanded && "rotate-180")}
                aria-hidden="true"
              />
            </div>
          </button>
          {mobileExpanded ? (
            <div className="border-t border-slate-200 px-5 pb-5 pt-4">
              <SummaryPanel {...panelProps} />
            </div>
          ) : null}
        </section>

        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Total payable</p>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{formatINR(pricing.total)}</p>
            </div>
            <p className="text-sm text-slate-600">GST invoice included</p>
          </div>
        </div>
      </div>
    </>
  );
}
