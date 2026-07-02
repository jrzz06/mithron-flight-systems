"use client";

import { useEffect, useMemo, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { ProductHoverCard } from "@/components/cards/product-hover-card";
import type { Product } from "@/config/types";
import { dedupeProductsBySlug } from "@/lib/catalog-shelf-layout";

type CatalogVirtualizedGridProps = {
  products: Product[];
  className?: string;
  presentation?: "standard" | "showroom";
};

const ESTIMATED_ROW_HEIGHT = 420;

function resolveColumnCount(width: number) {
  if (width < 360) return 1;
  if (width < 1024) return 2;
  return 4;
}

export function CatalogVirtualizedGrid({
  products,
  className,
  presentation = "standard"
}: CatalogVirtualizedGridProps) {
  const items = dedupeProductsBySlug(products);
  const [columns, setColumns] = useState(4);

  useEffect(() => {
    const updateColumns = () => setColumns(resolveColumnCount(window.innerWidth));
    updateColumns();
    window.addEventListener("resize", updateColumns);
    return () => window.removeEventListener("resize", updateColumns);
  }, []);

  const rowCount = Math.max(1, Math.ceil(items.length / columns));
  const rowVirtualizer = useWindowVirtualizer({
    count: items.length ? rowCount : 0,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 2
  });

  const virtualRows = useMemo(() => rowVirtualizer.getVirtualItems(), [rowVirtualizer, items.length, columns]);

  if (!items.length) {
    return <div className={className} data-catalog-continued-grid />;
  }

  return (
    <div className={className} data-catalog-continued-grid>
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative"
        }}
      >
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columns;
          const rowItems = items.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: columns <= 2 ? "10px" : "1.25rem"
              }}
            >
              {rowItems.map((product, index) => (
                <ProductHoverCard
                  key={product.slug}
                  product={product}
                  variant="catalog"
                  showCategory
                  cta="catalog"
                  presentation={presentation}
                  priority={startIndex + index < 4}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
