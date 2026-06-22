import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import type { Product } from "@/config/types";
import { cn } from "@/lib/utils";
import styles from "./product-detail.module.css";

function categoryHref(product: Product) {
  const interest = product.interests[0];
  if (!interest) return "/products";
  return `/${interest}`;
}

export function ProductDetailHeader({ product }: { product: Product }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/" className={cn(styles.breadcrumbLink, "inline-flex items-center gap-1")}>
            <Home className="size-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Home</span>
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
          <Link href="/products" className={styles.breadcrumbLink}>
            Products
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
          <Link href={categoryHref(product)} className={cn(styles.breadcrumbLink, "max-w-[12rem] truncate sm:max-w-none")}>
            {product.category}
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
          <span aria-current="page" className={styles.breadcrumbCurrent}>
            {product.name}
          </span>
        </nav>
      </div>
    </header>
  );
}
