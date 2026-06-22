import { MithronPageHeroImage } from "@/components/media/mithron-page-hero-image";
import { getStoryChapters } from "@/lib/product-detail-content";
import { cn } from "@/lib/utils";
import type { Product } from "@/config/types";
import styles from "./product-detail.module.css";

export function ProductStory({
  product,
  includeFallback = true
}: {
  product: Product;
  includeFallback?: boolean;
}) {
  const chapters = getStoryChapters(product, { includeFallback });
  if (!chapters.length) return null;

  return (
    <div className="product-story-sections">
      {chapters.map((chapter, index) => {
        const reverse = index % 2 === 1;
        const showBody = Boolean(chapter.body?.trim()) && chapter.body !== chapter.title;

        return (
          <section
            key={chapter.id}
            id={index === 0 ? "overview" : `story-${chapter.id}`}
            className={cn(
              styles.storyChapter,
              index % 2 === 1 ? styles.storyChapterAlt : styles.storySection
            )}
          >
            <div className={cn(styles.storyChapterGrid, reverse && styles.storyChapterGridReverse)}>
              <div className={styles.storyCopy}>
                <p className={styles.storyKicker}>{chapter.kicker}</p>
                <h2 className={styles.storyTitle}>{chapter.title}</h2>
                {showBody ? (
                  <p className={cn("type-body", styles.storyBody)}>{chapter.body}</p>
                ) : null}
              </div>

              <div className={styles.storyMediaStage}>
                <MithronPageHeroImage
                  src={chapter.media.src}
                  alt={chapter.media.alt}
                  fill
                  className={styles.storyImage}
                  sizes="(min-width:768px) 45vw, 100vw"
                />
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
