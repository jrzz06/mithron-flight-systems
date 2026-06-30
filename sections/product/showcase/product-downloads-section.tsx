"use client";

import Link from "next/link";
import { ProductRevealSection } from "@/sections/product/showcase/product-reveal-section";
import styles from "./product-showcase.module.css";

export function ProductDownloadsSection({
  downloads
}: {
  downloads: Array<{ label: string; url: string }>;
}) {
  if (!downloads.length) return null;

  return (
    <ProductRevealSection id="downloads" className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.kicker}>Downloads</p>
        <h2 className={styles.displayTitle}>Documents and manuals</h2>
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
    </ProductRevealSection>
  );
}
