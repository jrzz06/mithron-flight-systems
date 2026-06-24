import Link from "next/link";
import type { Product } from "@/config/types";
import {
  getProductApplications,
  getProductDownloads,
  getProductFeatureItems,
  getProductIncludedItems,
  getProductMediaGallery,
  getProductTechnicalSpecs
} from "@/lib/product-detail-sections";
import { getHighlightSpecs } from "@/lib/product-detail-content";
import { cn } from "@/lib/utils";
import styles from "./product-detail.module.css";

export function ProductFeaturesSection({ product }: { product: Product }) {
  const features = getProductFeatureItems(product);
  if (!features.length) return null;

  return (
    <section id="features" className={styles.detailSection} aria-labelledby="product-features-title">
      <div className={styles.detailSectionInner}>
        <p className={styles.detailSectionKicker}>Features</p>
        <h2 id="product-features-title" className={styles.detailSectionTitle}>Mission features</h2>
        <ul className={styles.featureList}>
          {features.map((feature) => (
            <li key={feature} className={styles.featureListItem}>{feature}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ProductTechnicalSection({ product }: { product: Product }) {
  const specs = getProductTechnicalSpecs(product);
  if (!specs.length) return null;

  return (
    <section id="technical" className={styles.detailSection} aria-labelledby="product-technical-title">
      <div className={styles.detailSectionInner}>
        <p className={styles.detailSectionKicker}>Technical Data</p>
        <h2 id="product-technical-title" className={styles.detailSectionTitle}>Extended technical specifications</h2>
        <dl className={styles.specTable}>
          {specs.map(([key, value]) => (
            <div key={key} className={styles.specRow}>
              <dt className={cn("type-meta", styles.specKey)}>{key}</dt>
              <dd className={cn("type-body", styles.specValue)}>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function ProductDownloadsSection({ product }: { product: Product }) {
  const downloads = getProductDownloads(product);
  if (!downloads.length) return null;

  return (
    <section id="downloads" className={styles.detailSection} aria-labelledby="product-downloads-title">
      <div className={styles.detailSectionInner}>
        <p className={styles.detailSectionKicker}>Downloads</p>
        <h2 id="product-downloads-title" className={styles.detailSectionTitle}>Documents & manuals</h2>
        <ul className={styles.downloadList}>
          {downloads.map((item) => (
            <li key={item.url}>
              <Link href={item.url} className={styles.downloadLink} target="_blank" rel="noopener noreferrer">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ProductMediaGallerySection({ product }: { product: Product }) {
  const gallery = getProductMediaGallery(product);
  if (gallery.length <= 1) return null;

  return (
    <section id="media" className={styles.detailSection} aria-labelledby="product-media-title">
      <div className={styles.detailSectionInner}>
        <p className={styles.detailSectionKicker}>Media Gallery</p>
        <h2 id="product-media-title" className={styles.detailSectionTitle}>Product imagery</h2>
        <div className={styles.mediaGalleryGrid}>
          {gallery.map((item) => (
            <figure key={item.src} className={styles.mediaGalleryItem}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.alt || product.name} className={styles.mediaGalleryImage} loading="lazy" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProductApplicationsSection({ product }: { product: Product }) {
  const applications = getProductApplications(product);
  if (!applications) return null;

  return (
    <section id="applications" className={styles.detailSection} aria-labelledby="product-applications-title">
      <div className={styles.detailSectionInner}>
        <p className={styles.detailSectionKicker}>Applications</p>
        <h2 id="product-applications-title" className={styles.detailSectionTitle}>Operational applications</h2>
        <p className={styles.detailSectionBody}>{applications}</p>
      </div>
    </section>
  );
}

export function ProductIncludedSection({ product }: { product: Product }) {
  const items = getProductIncludedItems(product);
  if (!items.length) return null;

  return (
    <section id="included" className={styles.detailSection} aria-labelledby="product-included-title">
      <div className={styles.detailSectionInner}>
        <p className={styles.detailSectionKicker}>What&apos;s Included</p>
        <h2 id="product-included-title" className={styles.detailSectionTitle}>Package contents</h2>
        <ul className={styles.featureList}>
          {items.map((item) => (
            <li key={item} className={styles.featureListItem}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ProductSpecificationHighlightsSection({ product }: { product: Product }) {
  const highlights = getHighlightSpecs(product);
  if (!highlights.length) return null;

  return (
    <section id="specs" className={styles.detailSection} aria-labelledby="product-specs-title">
      <div className={styles.detailSectionInner}>
        <p className={styles.detailSectionKicker}>Specifications</p>
        <h2 id="product-specs-title" className={styles.detailSectionTitle}>Key specifications</h2>
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
