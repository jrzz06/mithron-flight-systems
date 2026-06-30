"use client";

import type { ProductSpecGroup } from "@/lib/product-detail-experience";
import { ProductRevealSection } from "@/sections/product/showcase/product-reveal-section";
import styles from "./product-showcase.module.css";

export function ProductSpecExplorer({ groups }: { groups: ProductSpecGroup[] }) {
  if (!groups.length) return null;

  return (
    <ProductRevealSection id="specs" className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.kicker}>Specifications</p>
        <h2 className={styles.displayTitle}>Technical profile</h2>
        <p className={styles.lead}>Grouped specifications for procurement, integration, and field deployment review.</p>
        <div className={styles.specExplorer}>
          {groups.map((group) => (
            <details key={group.id} className={styles.specGroup} open={group.id === groups[0]?.id}>
              <summary className={styles.specGroupSummary}>{group.label}</summary>
              <dl className={styles.specTable}>
                {group.entries.map(([key, value]) => (
                  <div key={key} className={styles.specRow}>
                    <dt className={styles.specKey}>{key}</dt>
                    <dd className={styles.specValue}>{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
      </div>
    </ProductRevealSection>
  );
}
