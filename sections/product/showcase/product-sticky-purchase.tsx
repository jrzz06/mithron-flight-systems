"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { formatINR } from "@/lib/utils";
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
  children: ReactNode;
  summary: PurchaseSummary;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const closeSheet = useCallback(() => setSheetOpen(false), []);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSheet();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [closeSheet, sheetOpen]);

  return (
    <>
      <div className={styles.desktopPurchase}>{children}</div>

      <div className={styles.mobilePurchaseBar}>
        <div className={styles.mobilePurchaseMeta}>
          <p className={styles.mobilePurchaseName}>{summary.name}</p>
          <p className={styles.mobilePurchasePrice}>
            {formatINR(summary.price)}
            {summary.compareAt && summary.compareAt > summary.price ? (
              <span className={styles.mobilePurchaseCompare}>{formatINR(summary.compareAt)}</span>
            ) : null}
          </p>
        </div>
        <button type="button" className={styles.mobilePurchaseCta} onClick={() => setSheetOpen(true)}>
          Buy Now
        </button>
      </div>

      {sheetOpen ? (
        <dialog open className={styles.purchaseSheet} aria-label={`Configure ${summary.name}`}>
          <div className={styles.purchaseSheetBackdrop} onClick={closeSheet} aria-hidden="true" />
          <div className={styles.purchaseSheetPanel}>
            <div className={styles.purchaseSheetHeader}>
              <p className={styles.purchaseSheetTitle}>{summary.name}</p>
              <button type="button" className={styles.purchaseSheetClose} onClick={closeSheet} aria-label="Close purchase panel">
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className={styles.purchaseSheetBody}>{children}</div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
