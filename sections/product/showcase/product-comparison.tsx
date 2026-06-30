"use client";

import Link from "next/link";
import type { ProductComparison } from "@/lib/product-detail-experience";
import { ProductRevealSection } from "@/sections/product/showcase/product-reveal-section";
import styles from "./product-showcase.module.css";

export function ProductComparisonTable({ comparison }: { comparison: ProductComparison }) {
  return (
    <ProductRevealSection id="comparison" className={styles.sectionMist}>
      <div className={styles.innerWide}>
        <p className={styles.kicker}>Compare</p>
        <h2 className={styles.displayTitle}>How it stacks up</h2>
        <p className={styles.lead}>Scan the mission-critical differences against nearby Mithron systems.</p>
        <div className={styles.compareTableWrap}>
          <table className={styles.compareTable}>
            <thead>
              <tr>
                <th scope="col">Spec</th>
                {comparison.columns.map((column) => (
                  <th key={column.slug} scope="col" className={column.isCurrent ? styles.compareCurrent : undefined}>
                    {column.isCurrent ? column.name : (
                      <Link href={`/product/${column.slug}`}>{column.name}</Link>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((value, index) => (
                    <td key={`${row.label}-${index}`} className={index === 0 ? styles.compareCurrent : undefined}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ProductRevealSection>
  );
}
