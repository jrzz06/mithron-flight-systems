"use client";

import { Check, Headset, Package, ShieldCheck, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Bundle, MediaAsset, ProductVariant } from "@/config/types";
import type { ProductReviewSummary } from "@/lib/product-reviews/types";
import { isSpecLikeBlob } from "@/lib/product-spec-text";
import { glassPillClassName } from "@/lib/glass-ui";
import { cn, formatUsd } from "@/lib/utils";
import { formatProductTaxPriceLabel } from "@/lib/product-tax";
import { useCartStore } from "@/store/cart";
import styles from "./product-detail.module.css";

export type ProductConfiguratorModel = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  badge?: string;
  price: number;
  compareAt?: number;
  chargeTax?: boolean;
  taxGroup?: string;
  taxRate?: number;
  taxIncluded?: boolean;
  image: MediaAsset;
  variants: ProductVariant[];
  bundles: Bundle[];
  reviewSummary?: ProductReviewSummary;
};

const trustSignals = [
  { icon: ShieldCheck, label: "Verified platform listing" },
  { icon: Headset, label: "Deployment support available" },
  { icon: Package, label: "Configured for field delivery" }
] as const;

function isAvailabilityVariant(variants: ProductVariant[]) {
  return variants.length === 1 && variants[0]?.id === "availability";
}

function BuyBoxStarRow({ rating }: { rating: number }) {
  const roundedRating = Math.round(rating);

  return (
    <div className={styles.buyBoxStarRow} aria-hidden="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <span key={index} className={index < roundedRating ? styles.reviewStarFilled : styles.reviewStarEmpty} />
      ))}
    </div>
  );
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
      image: product.image.src,
      chargeTax: product.chargeTax,
      taxGroup: product.taxGroup,
      taxRate: product.taxRate,
      taxIncluded: product.taxIncluded
    });
    setCartOpen(true);
    toast.success(`${product.name} added to cart`, { description: bundle.name });
    window.setTimeout(() => setIsAdding(false), 400);
  };

  return (
    <aside className={cn("product-configurator", styles.buyBox)}>
      <div className={styles.buyBoxInner}>
        <div className={styles.badgeRow}>
          <span className={styles.categoryBadge}>{product.category}</span>
          {product.badge ? <span className={styles.featureBadge}>{product.badge}</span> : null}
        </div>

        <h1 className={cn("type-section", styles.productTitle)}>{product.name}</h1>
        {product.reviewSummary ? (
          <a href="#reviews" className={styles.buyBoxRating}>
            <BuyBoxStarRow rating={product.reviewSummary.averageRating} />
            <span className={styles.buyBoxRatingMeta}>
              {product.reviewSummary.averageRating.toFixed(1)} · {product.reviewSummary.totalReviews} reviews
            </span>
          </a>
        ) : null}
        {showTagline ? (
          <p className={cn("type-body", styles.productTagline)}>{product.tagline}</p>
        ) : null}

        <div className={styles.priceRow}>
          <p className={cn("type-price", styles.priceCurrent)}>
            {formatProductTaxPriceLabel({
              unitPrice: displayPrice,
              chargeTax: product.chargeTax,
              taxGroup: product.taxGroup,
              taxRate: product.taxRate,
              taxIncluded: product.taxIncluded
            })}
          </p>
          {product.compareAt && product.compareAt > displayPrice ? (
            <p className={cn("type-body", styles.priceCompare)}>{formatUsd(product.compareAt)}</p>
          ) : null}
        </div>

        {isAvailabilityVariant(product.variants) && selectedVariant ? (
          <div className={cn(glassPillClassName("mt-4 inline-flex w-fit items-center gap-2 px-3 py-1.5 text-sm"))}>
            <span className="size-2 rounded-full bg-[var(--brand-accent)]" aria-hidden="true" />
            {selectedVariant.name}
          </div>
        ) : null}

        <ul className={styles.trustRow}>
          {trustSignals.map(({ icon: Icon, label }) => (
            <li key={label} className={styles.trustItem}>
              <Icon className={styles.trustIcon} aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>

        {showVariantPicker ? (
          <section className={styles.optionSection} aria-labelledby="variant-heading">
            <h2 id="variant-heading" className={styles.optionHeading}>
              Finish
            </h2>
            <div className={styles.optionGrid}>
              {product.variants.map((variant) => {
                const isSelected = variantId === variant.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setVariantId(variant.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      "type-button",
                      styles.optionCard,
                      styles.variantCard,
                      isSelected && styles.variantCardSelected
                    )}
                  >
                    <span className={styles.variantSwatch} style={{ background: variant.tone }} />
                    <span className="line-clamp-2">{variant.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {showBundlePicker ? (
          <section className={styles.optionSection} aria-labelledby="bundle-heading">
            <h2 id="bundle-heading" className={styles.optionHeading}>
              Configuration
            </h2>
            <div className={styles.optionStack}>
              {product.bundles.map((bundle) => {
                const isSelected = bundleId === bundle.id;
                return (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => setBundleId(bundle.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      styles.optionCard,
                      styles.bundleCard,
                      isSelected && styles.optionCardSelected
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
                );
              })}
            </div>
          </section>
        ) : showBundleDescription ? (
          <p className="type-body mt-6 text-sm leading-relaxed text-slate-600">{selectedBundle.description}</p>
        ) : null}

        {bundleIncludes.length > 0 ? (
          <section className={styles.includesBox} aria-labelledby="includes-heading">
            <h2 id="includes-heading" className={styles.includesHeading}>
              What&apos;s included
            </h2>
            <ul className={styles.includesList}>
              {bundleIncludes.slice(0, 6).map((item) => (
                <li key={item} className={styles.includesItem}>
                  <Check className={styles.includesCheck} aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className={cn("hidden md:block", styles.desktopCta)}>
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

      <div className={styles.fixedBar}>
        <div className={styles.fixedBarInner}>
          <div className={styles.fixedBarMeta}>
            <p className={styles.fixedBarName}>{product.name}</p>
            <p className={cn("type-price text-lg font-semibold tabular-nums md:hidden")}>{formatUsd(displayPrice)}</p>
          </div>
          <div className={styles.fixedBarActions}>
            <span className="type-price hidden text-xl font-semibold tabular-nums md:inline">
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
