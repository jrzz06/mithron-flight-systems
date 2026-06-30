"use client";

import type { Product } from "@/config/types";
import { ProductRevealSection } from "@/sections/product/showcase/product-reveal-section";
import styles from "./product-showcase.module.css";

export function ProductValueProposition({
  product,
  overviewText,
  overviewHtml,
  highlightStats
}: {
  product: Product;
  overviewText: string;
  overviewHtml: string | null;
  highlightStats: Array<[string, string]>;
}) {
  if (!overviewText && !overviewHtml && !highlightStats.length) return null;

  return (
    <ProductRevealSection id="overview" className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.kicker}>Why {product.name}</p>
        <h2 className={styles.displayTitle}>
          {product.tagline?.trim() || `Built for ${product.category.toLowerCase()} missions`}
        </h2>
        {overviewHtml ? (
          <div className={`${styles.lead} editor-rendered-content`} dangerouslySetInnerHTML={{ __html: overviewHtml }} />
        ) : overviewText ? (
          <p className={styles.lead}>{overviewText}</p>
        ) : null}
        {highlightStats.length ? (
          <dl className={styles.statGrid}>
            {highlightStats.map(([label, value]) => (
              <div key={label} className={styles.statCard}>
                <dt className={styles.statLabel}>{label}</dt>
                <dd className={styles.statValue}>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </ProductRevealSection>
  );
}
