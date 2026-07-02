"use client";

import { useCartHasHydrated } from "@/store/cart";
import { useDesktopPurchaseLayout } from "@/hooks/use-desktop-purchase-layout";
import { formatINR, cn } from "@/lib/utils";
import { useProductPurchaseActions } from "@/sections/product/product-purchase-context";
import styles from "./product-showcase.module.css";

type PurchaseSummary = {
  name: string;
  price: number;
  compareAt?: number;
};

export function ProductStickyPurchase({
  children,
  summary
}: {
  children: React.ReactNode;
  summary: PurchaseSummary;
}) {
  const isDesktop = useDesktopPurchaseLayout();
  const purchaseActions = useProductPurchaseActions();
  const cartHasHydrated = useCartHasHydrated();
  const actionsReady = Boolean(purchaseActions);
  const actionsBusy = purchaseActions?.isAdding ?? false;
  const purchaseDisabled = !actionsReady || actionsBusy || !cartHasHydrated;

  return (
    <>
      <div className={cn(styles.purchasePanel, isDesktop && styles.purchasePanelDesktop)} data-product-purchase-panel>
        {children}
      </div>

      {!isDesktop ? (
        <div className={styles.mobilePurchaseBar} data-product-mobile-purchase-bar>
          <div className={styles.mobilePurchaseMeta}>
            <p className={styles.mobilePurchaseName}>{summary.name}</p>
            <p className={styles.mobilePurchasePrice}>
              {formatINR(summary.price)}
              {summary.compareAt && summary.compareAt > summary.price ? (
                <span className={styles.mobilePurchaseCompare}>{formatINR(summary.compareAt)}</span>
              ) : null}
            </p>
          </div>
          <div className={styles.mobilePurchaseActions}>
            <button
              type="button"
              className={styles.mobilePurchaseSecondaryCta}
              disabled={purchaseDisabled}
              onClick={() => purchaseActions?.addToCart()}
            >
              Add to Cart
            </button>
            <button
              type="button"
              className={styles.mobilePurchaseCta}
              disabled={purchaseDisabled}
              onClick={() => purchaseActions?.buyNow()}
            >
              Buy Now
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
