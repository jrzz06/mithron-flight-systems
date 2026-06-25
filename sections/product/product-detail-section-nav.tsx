import type { ProductDetailSectionId } from "@/lib/product-detail-sections";
import { cn } from "@/lib/utils";
import styles from "./product-detail.module.css";

const sections: Array<{ id: ProductDetailSectionId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "features", label: "Features" },
  { id: "specs", label: "Specifications" },
  { id: "technical", label: "Technical Data" },
  { id: "downloads", label: "Downloads" },
  { id: "media", label: "Media Gallery" },
  { id: "applications", label: "Applications" },
  { id: "included", label: "What's Included" },
  { id: "warranty", label: "Warranty" },
  { id: "disclaimers", label: "Disclaimers" },
  { id: "faq", label: "FAQs" },
  { id: "reviews", label: "Reviews" },
  { id: "related", label: "Related Products" }
];

export function ProductDetailSectionNav({
  visibleSectionIds
}: {
  visibleSectionIds?: ProductDetailSectionId[];
}) {
  const visible = new Set(visibleSectionIds ?? sections.map((section) => section.id));
  const items = sections.filter((section) => visible.has(section.id));
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
