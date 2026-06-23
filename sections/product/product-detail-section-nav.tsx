"use client";

import { cn } from "@/lib/utils";

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
    <nav
      aria-label="Product sections"
      className="sticky top-[104px] z-30 border-b border-slate-200/80 bg-[color-mix(in_srgb,var(--surface-page)_94%,transparent)] backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-5 py-2.5 md:px-10">
        {items.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className={cn(
              "type-button min-h-11 shrink-0 rounded-full px-4 py-2.5 text-sm text-slate-600 transition-colors",
              "hover:bg-white hover:text-[#0f172a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            )}
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
