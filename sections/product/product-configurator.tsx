"use client";

import { Check, Headset, Package, ShieldCheck, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Bundle, MediaAsset, ProductVariant } from "@/config/types";
import { isSpecLikeBlob } from "@/lib/product-spec-text";
import { glassPillClassName } from "@/lib/glass-ui";
import { cn, formatUsd } from "@/lib/utils";
import { useCartStore } from "@/store/cart";

export type ProductConfiguratorModel = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  badge?: string;
  price: number;
  compareAt?: number;
  image: MediaAsset;
  variants: ProductVariant[];
  bundles: Bundle[];
};

const trustSignals = [
  { icon: ShieldCheck, label: "Verified platform listing" },
  { icon: Headset, label: "Deployment support available" },
  { icon: Package, label: "Configured for field delivery" }
] as const;

function isAvailabilityVariant(variants: ProductVariant[]) {
  return variants.length === 1 && variants[0]?.id === "availability";
}

export function ProductConfigurator({ product }: { product: ProductConfiguratorModel }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [bundleId, setBundleId] = useState(product.bundles[0]?.id ?? "");
  const [isAdding, setIsAdding] = useState(false);
  const selectedBundle = useMemo(
    () => product.bundles.find((bundle) => bundle.id === bundleId) ?? product.bundles[0],
    [bundleId, product.bundles]
  );
  const selectedVariant = product.variants.find((variant) => variant.id === variantId) ?? product.variants[0];
  const addItem = useCartStore((state) => state.addItem);
  const setCartOpen = useCartStore((state) => state.setCartOpen);
  const showVariantPicker = product.variants.length > 1 && !isAvailabilityVariant(product.variants);
  const showBundlePicker = product.bundles.length > 1;
  const displayPrice = selectedBundle?.price ?? product.price;
  const bundleIncludes = selectedBundle?.includes.filter(Boolean) ?? [];
  const showTagline = Boolean(product.tagline?.trim()) && !isSpecLikeBlob(product.tagline);
  const showBundleDescription = Boolean(selectedBundle?.description?.trim())
    && !isSpecLikeBlob(selectedBundle.description)
    && selectedBundle.description !== product.tagline;

  const addToCart = async (bundle: Bundle | undefined) => {
    if (!bundle || isAdding) return;
    setIsAdding(true);
    addItem({
      productSlug: product.slug,
      productName: product.name,
      bundleId: bundle.id,
      bundleName: bundle.name,
      unitPrice: bundle.price,
      image: product.image.src
    });
    setCartOpen(true);
    toast.success(`${product.name} added to cart`, { description: bundle.name });
    window.setTimeout(() => setIsAdding(false), 400);
  };

  return (
    <aside className="product-configurator relative flex flex-col border-t border-slate-200/80 bg-white md:border-l md:border-t-0">
      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col px-5 pb-24 pt-8 md:px-8 md:py-10 lg:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="rounded-full border-slate-200 bg-slate-100 px-3 py-1 font-normal normal-case tracking-normal text-slate-700">
            {product.category}
          </Badge>
          {product.badge ? (
            <Badge className="rounded-full border-emerald-100 bg-emerald-50 px-3 py-1 font-normal normal-case tracking-normal text-emerald-800">
              {product.badge}
            </Badge>
          ) : null}
        </div>

        <h1 className="type-section mt-4 text-3xl leading-tight text-[#0f172a] md:text-[2.35rem]">{product.name}</h1>
        {showTagline ? (
          <p className="type-body mt-3 text-base leading-relaxed text-slate-600">{product.tagline}</p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-baseline gap-3">
          <p className="type-price text-3xl font-semibold tabular-nums text-[#0f172a] md:text-4xl">{formatUsd(displayPrice)}</p>
          {product.compareAt && product.compareAt > displayPrice ? (
            <p className="type-body text-sm tabular-nums text-slate-400 line-through">{formatUsd(product.compareAt)}</p>
          ) : null}
        </div>

        {isAvailabilityVariant(product.variants) && selectedVariant ? (
          <div className={glassPillClassName("mt-4 inline-flex w-fit items-center gap-2 px-3 py-1.5 text-sm")}>
            <span className="size-2 rounded-full bg-[#111111]" aria-hidden="true" />
            {selectedVariant.name}
          </div>
        ) : null}

        <ul className="mt-6 grid gap-2 sm:grid-cols-3">
          {trustSignals.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-xs leading-snug text-slate-600"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>

        {showVariantPicker ? (
          <section className="mt-8" aria-labelledby="variant-heading">
            <h2 id="variant-heading" className="type-card-title mb-3 text-sm text-slate-500">
              Finish
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {product.variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setVariantId(variant.id)}
                  aria-pressed={variantId === variant.id}
                  className={cn(
                    "type-button flex min-h-11 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors duration-200",
                    variantId === variant.id
                      ? "border-[#0f172a] bg-[#0f172a] text-white"
                      : "border-slate-200 bg-slate-50 text-[#0f172a] hover:border-slate-300"
                  )}
                >
                  <span className="size-5 shrink-0 rounded-full border border-white/20" style={{ background: variant.tone }} />
                  <span className="line-clamp-2">{variant.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {showBundlePicker ? (
          <section className="mt-8" aria-labelledby="bundle-heading">
            <h2 id="bundle-heading" className="type-card-title mb-3 text-sm text-slate-500">
              Configuration
            </h2>
            <div className="flex flex-col gap-2">
              {product.bundles.map((bundle) => (
                <button
                  key={bundle.id}
                  type="button"
                  onClick={() => setBundleId(bundle.id)}
                  aria-pressed={bundleId === bundle.id}
                  className={cn(
                    "min-h-11 rounded-xl border p-4 text-left transition-colors duration-200",
                    bundleId === bundle.id
                      ? "border-[#0f172a] bg-slate-50 ring-1 ring-[#0f172a]"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="type-card-title text-sm">{bundle.name}</h3>
                      {bundle.description ? (
                        <p className="type-body mt-1 line-clamp-2 text-xs text-slate-500">{bundle.description}</p>
                      ) : null}
                    </div>
                    <p className="type-price shrink-0 text-sm font-medium tabular-nums">{formatUsd(bundle.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : showBundleDescription ? (
          <p className="type-body mt-6 text-sm leading-relaxed text-slate-600">{selectedBundle.description}</p>
        ) : null}

        {bundleIncludes.length > 0 ? (
          <section className="mt-6 rounded-xl border border-slate-100 bg-slate-50/70 p-4" aria-labelledby="includes-heading">
            <h2 id="includes-heading" className="type-card-title text-sm text-[#0f172a]">
              What&apos;s included
            </h2>
            <ul className="mt-3 space-y-2">
              {bundleIncludes.slice(0, 6).map((item) => (
                <li key={item} className="type-body flex items-start gap-2 text-sm text-slate-600">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-auto hidden pt-8 md:block">
          <Button
            variant="accentCart"
            size="lg"
            className="w-full"
            disabled={isAdding}
            onClick={() => addToCart(selectedBundle)}
          >
            <ShoppingCart data-icon="inline-start" />
            Add to cart
          </Button>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-[60] border-t border-slate-200 bg-white px-4 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_rgba(15,23,42,.08)] md:px-6">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
          <div className="min-w-0 flex-1 md:max-w-[50%]">
            <p className="type-card-title truncate text-sm text-[#0f172a] md:text-base">{product.name}</p>
            <p className="type-price text-lg font-semibold tabular-nums text-[#0f172a] md:hidden">{formatUsd(displayPrice)}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="type-price hidden text-xl font-semibold tabular-nums text-[#0f172a] md:inline">
              {formatUsd(displayPrice)}
            </span>
            <Button
              variant="accentCart"
              size="lg"
              className="min-h-11 min-w-[132px] md:min-w-[160px]"
              disabled={isAdding}
              onClick={() => addToCart(selectedBundle)}
            >
              <Check data-icon="inline-start" />
              Add to cart
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
