import Link from "next/link";
import { ProductHoverCard } from "@/components/cards/product-hover-card";
import type { Product } from "@/config/types";
import type { ProductShellItem } from "@/services/catalog";
import styles from "./product-detail.module.css";

function shellItemToProduct(item: ProductShellItem): Product {
  return {
    slug: item.slug,
    productUrl: `/product/${item.slug}`,
    name: item.name,
    tagline: item.tagline,
    price: item.price,
    badge: item.badge,
    category: item.category,
    interests: item.interests,
    image: item.image,
    hero: item.image,
    gallery: [],
    variants: [],
    bundles: [],
    story: [],
    specs: {},
    anchors: []
  };
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
        <div className={styles.relatedGrid}>
          {relatedProducts.map((item) => (
            <ProductHoverCard
              key={item.slug}
              product={shellItemToProduct(item)}
              variant="related"
              showCategory
              cta="arrow"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
