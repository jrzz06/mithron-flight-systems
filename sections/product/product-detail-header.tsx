import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import type { Product } from "@/config/types";

function categoryHref(product: Product) {
  const interest = product.interests[0];
  if (!interest) return "/products";
  return `/${interest}`;
}

export function ProductDetailHeader({ product }: { product: Product }) {
  return (
    <header className="border-b border-slate-200/80 bg-[var(--surface-page)]">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-2 gap-y-2 px-5 py-4 md:px-10">
        <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm text-slate-500">
          <Link href="/" className="inline-flex items-center gap-1 transition-colors hover:text-[#0f172a]">
            <Home className="size-3.5" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Home</span>
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
          <Link href="/products" className="transition-colors hover:text-[#0f172a]">
            Products
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
          <Link href={categoryHref(product)} className="max-w-[12rem] truncate transition-colors hover:text-[#0f172a] sm:max-w-none">
            {product.category}
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
          <span aria-current="page" className="max-w-[14rem] truncate font-medium text-[#0f172a] sm:max-w-xs md:max-w-md">
            {product.name}
          </span>
        </nav>
      </div>
    </header>
  );
}
