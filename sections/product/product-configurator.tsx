"use client";

import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Bundle, MediaAsset, ProductVariant } from "@/config/types";
import { cn, formatINR } from "@/lib/utils";
import { formatAvailability } from "@/lib/product-spec-text";
import { deriveProductSku } from "@/lib/product-sku";
import { useCartStore } from "@/store/cart";
import styles from "./product-detail.module.css";

export type ProductConfiguratorModel = {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  badge?: string;
  badgeStyle?: import("@/lib/product-badge").ProductBadgeStyle;
  price: number;
  compareAt?: number;
  chargeTax?: boolean;
  taxGroup?: string;
  taxRate?: number;
  taxIncluded?: boolean;
  image: MediaAsset;
  variants: ProductVariant[];
  bundles: Bundle[];
};

function isAvailabilityVariant(variants: ProductVariant[]) {
  return variants.length === 1 && variants[0]?.id === "availability";
}

function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className={styles.quantityStepper} role="group" aria-label="Quantity">
      <button
        type="button"
        className={styles.quantityButton}
        aria-label="Decrease quantity"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <span className={styles.quantityValue} aria-live="polite" aria-atomic="true">
        {value}
      </span>
      <button
        type="button"
        className={styles.quantityButton}
        aria-label="Increase quantity"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function ProductConfigurator({ product }: { product: ProductConfiguratorModel }) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [bundleId, setBundleId] = useState(product.bundles[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const selectedBundle = useMemo(
    () => product.bundles.find((bundle) => bundle.id === bundleId) ?? product.bundles[0],
    [bundleId, product.bundles]
  );
  const selectedVariant = product.variants.find((variant) => variant.id === variantId) ?? product.variants[0];
  const addItem = useCartStore((state) => state.addItem);
  const setCartQuantity = useCartStore((state) => state.setQuantity);
  const setCartOpen = useCartStore((state) => state.setCartOpen);
  const showVariantPicker = product.variants.length > 1 && !isAvailabilityVariant(product.variants);
  const showBundlePicker = product.bundles.length > 1;
  const displayPrice = selectedBundle?.price ?? product.price;
  const showGstNote = Boolean(product.chargeTax) && !product.taxIncluded;
  const showCompareAt = Boolean(product.compareAt && product.compareAt > displayPrice);
  const stockLabel = isAvailabilityVariant(product.variants)
    ? formatAvailability(selectedVariant?.name ?? "In stock")
    : "In stock";
  const buyBoxTagline = product.tagline?.trim() ?? "";

  const commitPurchase = async (mode: "cart" | "checkout") => {
    const bundle = selectedBundle;
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
      taxIncluded: product.taxIncluded,
      category: product.category,
      sku: deriveProductSku(product.slug),
      availabilityLabel: isAvailabilityVariant(product.variants) ? selectedVariant?.name : undefined
    });
    setCartQuantity(product.slug, bundle.id, quantity);

    if (mode === "checkout") {
      router.push("/checkout");
    } else {
      setCartOpen(true);
      toast.success(`${product.name} added to cart`, { description: bundle.name });
    }

    window.setTimeout(() => setIsAdding(false), 400);
  };

  return (
    <aside className={cn("product-configurator", styles.buyBox, styles.buyBoxPremium)}>
      <div className={styles.buyBoxInner}>
        <h1 className={styles.productTitlePremium}>{product.name}</h1>

        {buyBoxTagline ? <p className={styles.productSubtitle}>{buyBoxTagline}</p> : null}

        <div className={styles.priceBlock}>
          <p className={styles.priceHero}>{formatINR(displayPrice)}</p>
          {showGstNote ? <p className={styles.priceGstNote}>+ GST</p> : null}
          {showCompareAt ? (
            <p className={styles.priceComparePremium}>{formatINR(product.compareAt!)}</p>
          ) : null}
        </div>

        <p className={styles.stockStatus}>
          <span className={styles.stockDot} aria-hidden="true" />
          {stockLabel}
        </p>

        {showVariantPicker ? (
          <section className={styles.compactOptions} aria-labelledby="variant-heading">
            <h2 id="variant-heading" className={styles.compactOptionsLabel}>
              Finish
            </h2>
            <div className={styles.compactOptionRow}>
              {product.variants.map((variant) => {
                const isSelected = variantId === variant.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => setVariantId(variant.id)}
                    aria-pressed={isSelected}
                    className={cn(styles.compactOptionChip, isSelected && styles.compactOptionChipSelected)}
                  >
                    <span className={styles.variantSwatch} style={{ background: variant.tone }} />
                    <span>{variant.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        {showBundlePicker ? (
          <section className={styles.compactOptions} aria-labelledby="bundle-heading">
            <h2 id="bundle-heading" className={styles.compactOptionsLabel}>
              Configuration
            </h2>
            <div className={styles.compactOptionStack}>
              {product.bundles.map((bundle) => {
                const isSelected = bundleId === bundle.id;
                return (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => setBundleId(bundle.id)}
                    aria-pressed={isSelected}
                    className={cn(styles.compactBundleRow, isSelected && styles.compactBundleRowSelected)}
                  >
                    <span className={styles.compactBundleName}>{bundle.name}</span>
                    <span className={styles.compactBundlePrice}>{formatINR(bundle.price)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <div className={styles.quantityRow}>
          <span className={styles.quantityLabel}>Quantity</span>
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </div>

        <div className={styles.purchaseActions}>
          <Button
            variant="accent"
            size="lg"
            className={styles.purchaseButton}
            disabled={isAdding}
            onClick={() => commitPurchase("checkout")}
          >
            Buy Now
          </Button>
          <Button
            variant="outline"
            size="lg"
            className={styles.purchaseButton}
            disabled={isAdding}
            onClick={() => commitPurchase("cart")}
          >
            Add to Cart
          </Button>
        </div>
      </div>
    </aside>
  );
}
