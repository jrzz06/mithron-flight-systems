"use client";

import { MithronPageHeroImage } from "@/components/media/mithron-page-hero-image";
import { EditorRenderedContent } from "@/components/editor/editor-rendered-content";
import type { ProductFeatureSpotlight } from "@/lib/product-detail-experience";
import { ProductRevealSection } from "@/sections/product/showcase/product-reveal-section";
import { cn } from "@/lib/utils";
import styles from "./product-showcase.module.css";

export function ProductFeatureSpotlights({ features }: { features: ProductFeatureSpotlight[] }) {
  if (!features.length) return null;

  return (
    <ProductRevealSection id="features" className={styles.sectionMist}>
      <div className={styles.innerWide}>
        <p className={styles.kicker}>Highlights</p>
        <h2 className={styles.displayTitle}>Engineered capabilities</h2>
        <div className={styles.featureGrid}>
          {features.map((feature, index) => (
            <article
              key={feature.id}
              className={cn(styles.featureBlock, index % 2 === 1 && styles.featureBlockReverse)}
            >
              <div className={styles.featureCopy}>
                <p className={styles.kicker}>{feature.kicker}</p>
                <h3 className={styles.featureCopyTitle}>{feature.title}</h3>
                <EditorRenderedContent html={feature.body} className={styles.featureCopyBody} />
              </div>
              {feature.media ? (
                <div className={styles.featureMedia}>
                  <MithronPageHeroImage
                    src={feature.media.src}
                    alt={feature.media.alt}
                    fill
                    responsive={feature.media.responsive}
                    className="object-contain p-6"
                    sizes="(min-width: 960px) 45vw, 100vw"
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </ProductRevealSection>
  );
}
