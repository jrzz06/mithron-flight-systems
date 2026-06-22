"use client";

import Link from "next/link";
import { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ProductHoverCard } from "@/components/cards/product-hover-card";
import type { Product } from "@/config/types";
import { getCustomerFacingSpecs } from "@/lib/product-detail-content";
import { cn } from "@/lib/utils";
import type { ProductShellItem } from "@/services/catalog";
import { productSupportContent, type ProductSupportContent } from "@/config/storefront-content";
import styles from "./product-detail.module.css";

type SupportTab = "faq" | "reviews" | "related";

function shellItemToProduct(item: ProductShellItem): Product {
  return {
    slug: item.slug,
    productUrl: `/product/${item.slug}`,
    name: item.name,
    tagline: item.tagline,
    price: item.price,
    badge: item.badge,
    category: item.category,
    interests: item.interests,
    image: item.image,
    hero: item.image,
    gallery: [],
    variants: [],
    bundles: [],
    story: [],
    specs: {},
    anchors: []
  };
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
  const specs = getCustomerFacingSpecs(product);
  const scopedReviews = support.reviews.filter((review) => review.productSlug === product.slug);
  const reviews = scopedReviews.length
    ? scopedReviews
    : support.reviews.filter((review) => !review.productSlug);

  const tabs = [
    { id: "faq" as SupportTab, label: "FAQ", visible: support.faqs.length > 0 },
    { id: "reviews" as SupportTab, label: "Reviews", visible: reviews.length > 0 },
    { id: "related" as SupportTab, label: "Related", visible: relatedProducts.length > 0 }
  ].filter((tab) => tab.visible);

  const [activeTab, setActiveTab] = useState<SupportTab>(tabs[0]?.id ?? "faq");

  return (
    <section className={cn("product-detail-support", styles.supportSection)}>
      <div className={styles.supportInner}>
        <div className={styles.supportHeader}>
          <div>
            <h2 className={styles.supportTitle}>Technical details</h2>
            <p className={styles.supportSubtitle}>Full specifications, deployment questions, and related systems.</p>
          </div>
        </div>

        {specs.length > 0 ? (
          <div className={styles.fullSpecsSection} id="specs">
            <h3 className={styles.fullSpecsHeading}>Full specifications</h3>
            <dl className={styles.specTable}>
              {specs.map(([key, value]) => (
                <div key={key} className={styles.specRow}>
                  <dt className={cn("type-meta", styles.specKey)}>{key}</dt>
                  <dd className={cn("type-body", styles.specValue)}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        {tabs.length > 0 ? (
          <>
            {tabs.length > 1 ? (
              <div className={cn(styles.tabList, specs.length > 0 && "mt-10")} role="tablist" aria-label="Product support sections">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "type-button",
                      styles.tabPill,
                      activeTab === tab.id && styles.tabPillActive
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className={styles.tabPanel}>
              {activeTab === "faq" ? (
                <div id="faq" role="tabpanel">
                  <Accordion type="single" collapsible className={styles.faqPanel}>
                    {support.faqs.map(([question, answer]) => (
                      <AccordionItem key={question} value={question}>
                        <AccordionTrigger className="text-left text-[var(--text-primary,#0f172a)]">{question}</AccordionTrigger>
                        <AccordionContent className="text-slate-600">{answer}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ) : null}

              {activeTab === "reviews" && reviews.length > 0 ? (
                <div id="reviews" role="tabpanel">
                  <div className={styles.reviewGrid}>
                    {reviews.map((review) => (
                      <div key={review.name} className={styles.reviewCard}>
                        <p className="type-card-title text-base text-[var(--text-primary,#0f172a)]">{review.name}</p>
                        <p className="type-body mt-2 text-sm leading-relaxed text-slate-600">{review.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {activeTab === "related" && relatedProducts.length > 0 ? (
                <div id="accessories" role="tabpanel">
                  <div className={styles.relatedHeader}>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/products">View all products</Link>
                    </Button>
                  </div>
                  <div className={styles.relatedGrid}>
                    {relatedProducts.map((item) => (
                      <ProductHoverCard
                        key={item.slug}
                        product={shellItemToProduct(item)}
                        variant="related"
                        showCategory
                        cta="arrow"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
