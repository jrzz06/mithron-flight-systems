"use client";

import { MithronPageHeroImage } from "@/components/media/mithron-page-hero-image";
import { EditorRenderedContent } from "@/components/editor/editor-rendered-content";
import type { ProductNarrativeChapter } from "@/lib/product-detail-experience";
import { ProductRevealSection } from "@/sections/product/showcase/product-reveal-section";
import { cn } from "@/lib/utils";
import styles from "./product-showcase.module.css";

export function ProductNarrativeChapters({ chapters }: { chapters: ProductNarrativeChapter[] }) {
  if (!chapters.length) return null;

  return (
    <ProductRevealSection id="narrative" className={styles.section}>
      <div className={styles.innerWide}>
        {chapters.map((chapter, index) => (
          <article
            key={chapter.id}
            className={cn(styles.narrativeChapter, index % 2 === 1 && styles.narrativeChapterReverse)}
          >
            <div>
              <p className={styles.kicker}>{chapter.kicker}</p>
              <h2 className={styles.featureCopyTitle}>{chapter.title}</h2>
              <EditorRenderedContent html={chapter.body} className={styles.featureCopyBody} />
            </div>
            {chapter.media ? (
              <div className={styles.featureMedia}>
                <MithronPageHeroImage
                  src={chapter.media.src}
                  alt={chapter.media.alt}
                  fill
                  responsive={chapter.media.responsive}
                  className="object-cover"
                  sizes="(min-width: 960px) 45vw, 100vw"
                />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </ProductRevealSection>
  );
}
