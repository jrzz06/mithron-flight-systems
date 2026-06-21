"use client";

import Link from "next/link";
import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { MithronResponsiveImage } from "@/components/media/mithron-responsive-image";
import type { Product } from "@/config/types";
import { sortSpecEntries } from "@/lib/product-spec-text";
import type { ProductShellItem } from "@/services/catalog";
import { productSupportContent, type ProductSupportContent } from "@/config/storefront-content";
import { cn, formatUsd } from "@/lib/utils";

const HIDDEN_SPEC_KEYS = new Set(["Product ID", "Source", "Currency", "Category", "Availability"]);

type SupportTab = "specs" | "faq" | "reviews" | "related";

function displaySpecs(product: Product) {
  return sortSpecEntries(
    Object.entries(product.specs).filter(([key, value]) => {
      if (HIDDEN_SPEC_KEYS.has(key)) return false;
      if (!value.trim()) return false;
      return true;
    })
  );
}

export function SpecsFaqReviews({
  product,
  relatedProducts,
  support = productSupportContent
}: {
  product: Product;
  relatedProducts: ProductShellItem[];
  support?: ProductSupportContent;
}) {
  const specs = displaySpecs(product);
  const scopedReviews = support.reviews.filter((review) => review.productSlug === product.slug);
  const reviews = scopedReviews.length
    ? scopedReviews
    : support.reviews.filter((review) => !review.productSlug);

  const tabs = [
    { id: "specs" as SupportTab, label: "Specs", visible: specs.length > 0 },
    { id: "faq" as SupportTab, label: "FAQ", visible: support.faqs.length > 0 },
    { id: "reviews" as SupportTab, label: "Reviews", visible: reviews.length > 0 },
    { id: "related" as SupportTab, label: "Related", visible: relatedProducts.length > 0 }
  ].filter((tab) => tab.visible);

  const [activeTab, setActiveTab] = useState<SupportTab>(tabs[0]?.id ?? "faq");

  return (
    <section className="product-detail-support border-t border-slate-200 bg-[var(--surface-muted)] px-6 py-14 md:px-12 md:py-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="pt-1 text-2xl font-semibold leading-tight text-[#0f172a] md:text-3xl">Product details</h2>
            <p className="type-body mt-2 text-sm text-slate-500">Specifications, deployment questions, and related systems.</p>
          </div>
        </div>

        {tabs.length > 1 ? (
          <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Product detail sections">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "type-button min-h-11 rounded-full px-4 py-2.5 text-sm transition-colors duration-200",
                  activeTab === tab.id
                    ? "bg-[#0f172a] text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-[#0f172a]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-8">
          {activeTab === "specs" && specs.length > 0 ? (
            <div id="specs" role="tabpanel">
              <dl className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {specs.map(([key, value]) => (
                  <div
                    key={key}
                    className="product-spec-row grid gap-1 px-5 py-4 sm:grid-cols-[minmax(0,34%)_1fr] sm:items-center sm:gap-6"
                  >
                    <dt className="product-spec-key type-meta text-sm text-slate-500">{key}</dt>
                    <dd className="product-spec-value type-body text-sm text-[#0f172a] sm:text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {activeTab === "faq" ? (
            <div id="faq" role="tabpanel">
              <Accordion type="single" collapsible className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-5">
                {support.faqs.map(([question, answer]) => (
                  <AccordionItem key={question} value={question}>
                    <AccordionTrigger className="text-left text-[#0f172a]">{question}</AccordionTrigger>
                    <AccordionContent className="text-slate-600">{answer}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ) : null}

          {activeTab === "reviews" && reviews.length > 0 ? (
            <div id="reviews" role="tabpanel">
              <div className="grid gap-4 md:grid-cols-3">
                {reviews.map((review) => (
                  <div key={review.name} className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="type-card-title text-base text-[#0f172a]">{review.name}</p>
                    <p className="type-body mt-2 text-sm leading-relaxed text-slate-600">{review.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "related" && relatedProducts.length > 0 ? (
            <div id="accessories" role="tabpanel">
              <div className="mb-6 flex items-center justify-end">
                <Button asChild variant="outline" size="sm">
                  <Link href="/products">View all products</Link>
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {relatedProducts.map((item) => (
                  <Link
                    key={item.slug}
                    href={`/product/${item.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3 transition-[border-color,box-shadow] duration-200 hover:border-slate-300 hover:shadow-[var(--surface-shadow-soft)]"
                  >
                    <span className="relative block aspect-square overflow-hidden rounded-xl bg-[var(--surface-muted)]">
                      <MithronResponsiveImage
                        src={item.image.src}
                        alt={item.image.alt}
                        fill
                        className="object-contain p-4 transition-transform duration-200 group-hover:scale-[1.02]"
                        sizes="(min-width: 768px) 240px, 50vw"
                      />
                    </span>
                    <span className="type-meta mt-3 text-xs text-slate-400">{item.category}</span>
                    <h3 className="type-card-title mt-1 line-clamp-2 text-sm text-[#0f172a]">{item.name}</h3>
                    <p className="type-price mt-2 text-sm font-medium tabular-nums text-[#0f172a]">From {formatUsd(item.price)}</p>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
