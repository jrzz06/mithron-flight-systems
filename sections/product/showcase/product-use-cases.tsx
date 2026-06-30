"use client";

import type { ProductUseCase } from "@/lib/product-detail-experience";
import { ProductRevealSection } from "@/sections/product/showcase/product-reveal-section";
import styles from "./product-showcase.module.css";

export function ProductUseCases({ cases }: { cases: ProductUseCase[] }) {
  if (!cases.length) return null;

  return (
    <ProductRevealSection id="use-cases" className={styles.sectionMist}>
      <div className={styles.inner}>
        <p className={styles.kicker}>Use cases</p>
        <h2 className={styles.displayTitle}>Mission-ready applications</h2>
        <p className={styles.lead}>Deploy this platform across the operational profiles your team runs every day.</p>
        <div className={styles.useCaseGrid}>
          {cases.map((item) => (
            <article key={item.id} className={styles.useCaseCard}>
              <h3 className={styles.featureCopyTitle}>{item.label}</h3>
              <p className={styles.featureCopyBody}>{item.description}</p>
              <ul className={styles.useCaseList}>
                {item.benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </ProductRevealSection>
  );
}
