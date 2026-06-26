import type { Product } from "@/config/types";
import { getProductOverviewHtml, getProductOverviewText } from "@/lib/product-detail-content";
import styles from "./product-detail.module.css";

function toParagraphs(text: string) {
  const parts = text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [text.trim()];
}

export function ProductOverview({ product }: { product: Product }) {
  const overviewHtml = getProductOverviewHtml(product);
  const overview = getProductOverviewText(product);
  if (!overviewHtml && !overview) return null;

  const paragraphs = overview ? toParagraphs(overview) : [];

  return (
    <section className={styles.overviewSection} aria-labelledby="product-overview-title">
      <div className={styles.overviewInner}>
        <p className={styles.overviewKicker}>Overview</p>
        <h2 id="product-overview-title" className={styles.overviewTitle}>
          Built for {product.category.toLowerCase()} missions
        </h2>
        <div className={styles.overviewBody}>
          {overviewHtml ? (
            <div className="editor-rendered-content" dangerouslySetInnerHTML={{ __html: overviewHtml }} />
          ) : (
            paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
