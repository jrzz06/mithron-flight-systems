"use client";

import { cn } from "@/lib/utils";
import styles from "./product-detail.module.css";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "specs", label: "Specs" },
  { id: "reviews", label: "Reviews" },
  { id: "accessories", label: "Related" }
] as const;

export function ProductDetailSectionNav({
  visibleSectionIds
}: {
  visibleSectionIds?: string[];
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
