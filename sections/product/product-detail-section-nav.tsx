import type { ShowcaseSection, ShowcaseSectionId } from "@/lib/product-detail-experience";
import { cn } from "@/lib/utils";
import styles from "./product-detail.module.css";

const FALLBACK_SECTIONS: ShowcaseSection[] = [
  { id: "description", label: "Description" },
  { id: "features", label: "Features" },
  { id: "narrative", label: "Story" },
  { id: "use-cases", label: "Use Cases" },
  { id: "specs", label: "Specifications" },
  { id: "comparison", label: "Compare" },
  { id: "included", label: "In the Box" },
  { id: "trust", label: "Trust" },
  { id: "downloads", label: "Downloads" },
  { id: "reviews", label: "Reviews" },
  { id: "faq", label: "FAQ" },
  { id: "related", label: "Related" }
];

export function ProductDetailSectionNav({
  sections
}: {
  sections?: ShowcaseSection[];
  visibleSectionIds?: ShowcaseSectionId[];
}) {
  const items = sections?.length
    ? sections
    : FALLBACK_SECTIONS;

  if (!items.length) return null;

  return (
    <div className={styles.sectionNavBand}>
      <nav aria-label="Product sections" className={styles.sectionNav}>
        <div className={styles.sectionNavInner}>
          {items.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={cn("type-button", styles.sectionNavLink)}
            >
              {section.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}
