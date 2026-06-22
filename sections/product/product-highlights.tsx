import type { Product } from "@/config/types";
import { getHighlightSpecs } from "@/lib/product-detail-content";
import styles from "./product-detail.module.css";

export function ProductHighlights({ product }: { product: Product }) {
  const highlights = getHighlightSpecs(product);
  if (!highlights.length) return null;

  return (
    <section className={styles.highlightsSection} aria-labelledby="product-highlights-title">
      <div className={styles.highlightsInner}>
        <h2 id="product-highlights-title" className={styles.highlightsTitle}>
          Key specifications
        </h2>
        <p className={styles.highlightsSubtitle}>
          Mission-critical performance figures for field planning, deployment, and procurement review.
        </p>
        <dl className={styles.highlightGrid}>
          {highlights.map(([label, value]) => (
            <div key={label} className={styles.highlightCard}>
              <dt className={styles.highlightLabel}>{label}</dt>
              <dd className={styles.highlightValue}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
