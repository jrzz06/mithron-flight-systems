import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MithronCardImage } from "@/components/media/mithron-card-image";
import { clipProductPreviewText } from "@/lib/product-preview-text";
import { formatINR } from "@/lib/utils";
import type { ProductShellItem } from "@/services/catalog";
import styles from "./product-detail.module.css";

function ProductRelatedCard({ item }: { item: ProductShellItem }) {
  const description = clipProductPreviewText(item.tagline, 88);

  return (
    <article className={styles.relatedCard}>
      <Link href={`/product/${item.slug}`} className={styles.relatedCardLink}>
        <div className={styles.relatedCardMedia}>
          <div className={styles.relatedCardMediaGlow} aria-hidden="true" />
          <div className={styles.relatedCardImageFrame}>
            <MithronCardImage
              src={item.image.src}
              alt={item.image.alt}
              fill
              responsive={item.image.responsive}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className={styles.relatedCardImage}
            />
          </div>
        </div>

        <div className={styles.relatedCardBody}>
          <p className={styles.relatedCardCategory}>{item.category}</p>
          <h3 className={styles.relatedCardTitle}>{item.name}</h3>
          <p className={styles.relatedCardDescription}>{description}</p>
          <div className={styles.relatedCardFooter}>
            <span className={styles.relatedCardCta} aria-hidden="true">
              <ArrowRight className="size-4" />
            </span>
            <p className={styles.relatedCardPrice}>From {formatINR(item.price)}</p>
          </div>
        </div>
      </Link>
    </article>
  );
}

export function ProductRelatedSection({ relatedProducts }: { relatedProducts: ProductShellItem[] }) {
  if (!relatedProducts.length) return null;

  return (
    <section id="accessories" className={styles.relatedSection} aria-labelledby="product-related-title">
      <div className={styles.relatedInner}>
        <div className={styles.relatedSectionHeader}>
          <div>
            <h2 id="product-related-title" className={styles.relatedSectionTitle}>
              You might also like
            </h2>
            <p className={styles.relatedSectionSubtitle}>Compatible systems and accessories selected for similar missions.</p>
          </div>
          <Link href="/products" className={styles.relatedSectionLink}>
            View all
          </Link>
        </div>
        <div className={styles.relatedProductGrid}>
          {relatedProducts.map((item) => (
            <ProductRelatedCard key={item.slug} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
