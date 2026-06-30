"use client";

import { ProductRevealSection } from "@/sections/product/showcase/product-reveal-section";
import styles from "./product-showcase.module.css";

export function ProductFaqSection({ faqs }: { faqs: Array<[string, string]> }) {
  if (!faqs.length) return null;

  return (
    <ProductRevealSection id="faq" className={styles.sectionMist}>
      <div className={styles.inner}>
        <p className={styles.kicker}>FAQ</p>
        <h2 className={styles.displayTitle}>Questions before you buy</h2>
        <div className={styles.faqList}>
          {faqs.map(([question, answer]) => (
            <details key={question} className={styles.faqItem}>
              <summary className={styles.faqQuestion}>{question}</summary>
              <p className={styles.faqAnswer}>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </ProductRevealSection>
  );
}
