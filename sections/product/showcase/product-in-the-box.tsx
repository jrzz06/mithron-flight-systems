"use client";

import { Package } from "lucide-react";
import type { ProductInTheBoxItem } from "@/lib/product-detail-experience";
import { ProductRevealSection } from "@/sections/product/showcase/product-reveal-section";
import styles from "./product-showcase.module.css";

export function ProductInTheBox({ items }: { items: ProductInTheBoxItem[] }) {
  if (!items.length) return null;

  return (
    <ProductRevealSection id="included" className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.kicker}>In the box</p>
        <h2 className={styles.displayTitle}>What&apos;s included</h2>
        <p className={styles.lead}>Everything configured for your deployment, presented clearly before checkout.</p>
        <div className={styles.inBoxGrid}>
          {items.map((item) => (
            <article key={item.id} className={styles.inBoxCard}>
              <Package className="mb-3 size-5 text-slate-500" aria-hidden="true" />
              <h3 className="text-base font-semibold leading-snug">{item.label}</h3>
            </article>
          ))}
        </div>
      </div>
    </ProductRevealSection>
  );
}
