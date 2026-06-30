"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { MithronCardImage } from "@/components/media/mithron-card-image";
import { clipProductPreviewText } from "@/lib/product-preview-text";
import { formatINR } from "@/lib/utils";
import type { ProductShellItem } from "@/services/catalog";
import styles from "./product-detail.module.css";
import showcaseStyles from "./showcase/product-showcase.module.css";

function isRemoteImageSrc(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

function pickRelatedCardImage(item: ProductShellItem) {
  const candidates = [item.image.src, item.image.responsive?.fallbackSrc].filter(Boolean) as string[];
  const remoteCandidate = candidates.find(isRemoteImageSrc);

  if (remoteCandidate) {
    return { src: remoteCandidate, useSourceImage: true as const, responsive: undefined };
  }

  return { src: item.image.src, useSourceImage: false as const, responsive: item.image.responsive };
}

function ProductRelatedCard({ item }: { item: ProductShellItem }) {
  const [imageFailed, setImageFailed] = useState(false);
  const description = clipProductPreviewText(item.tagline, 88);
  const pickedImage = pickRelatedCardImage(item);
  const showPlaceholder = imageFailed;

  return (
    <article className={styles.relatedCard}>
      <Link href={`/product/${item.slug}`} className={styles.relatedCardLink}>
        <div className={styles.relatedCardMedia}>
          <div className={styles.relatedCardMediaGlow} aria-hidden="true" />
          <div className={styles.relatedCardImageFrame}>
            {showPlaceholder ? (
              <div className={styles.relatedCardImagePlaceholder} aria-hidden="true" />
            ) : (
              <MithronCardImage
                src={pickedImage.src}
                alt={item.image.alt}
                fill
                responsive={pickedImage.responsive}
                useSourceImage={pickedImage.useSourceImage}
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                className={styles.relatedCardImage}
                onError={() => setImageFailed(true)}
              />
            )}
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

function RelatedRail({ title, items }: { title: string; items: ProductShellItem[] }) {
  if (!items.length) return null;

  return (
    <div className={showcaseStyles.relatedRail}>
      <h3 className={showcaseStyles.relatedRailTitle}>{title}</h3>
      <div className={styles.relatedProductGrid}>
        {items.map((item) => (
          <ProductRelatedCard key={item.slug} item={item} />
        ))}
      </div>
    </div>
  );
}

export function ProductRelatedSection({
  relatedProducts,
  similarProducts,
  accessoryProducts
}: {
  relatedProducts?: ProductShellItem[];
  similarProducts?: ProductShellItem[];
  accessoryProducts?: ProductShellItem[];
}) {
  const similar = similarProducts ?? relatedProducts ?? [];
  const accessories = accessoryProducts ?? [];
  const hasRails = similar.length > 0 || accessories.length > 0;

  if (!hasRails) return null;

  return (
    <section id="related" className={styles.relatedSection} aria-labelledby="product-related-title">
      <div className={styles.relatedInner}>
        <div className={styles.relatedSectionHeader}>
          <div>
            <h2 id="product-related-title" className={styles.relatedSectionTitle}>
              Recommended next
            </h2>
            <p className={styles.relatedSectionSubtitle}>Similar systems and compatible accessories selected for your mission profile.</p>
          </div>
          <Link href="/products" className={styles.relatedSectionLink}>
            View all
          </Link>
        </div>
        <RelatedRail title="Similar systems" items={similar} />
        <RelatedRail title="Accessories and add-ons" items={accessories} />
      </div>
    </section>
  );
}
