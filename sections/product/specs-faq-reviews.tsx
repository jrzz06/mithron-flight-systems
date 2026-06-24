import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductHoverCard } from "@/components/cards/product-hover-card";
import type { Product } from "@/config/types";
import { getCustomerFacingSpecs } from "@/lib/product-detail-content";
import { cn } from "@/lib/utils";
import type { ProductShellItem } from "@/services/catalog";
import { productSupportContent, type ProductSupportContent } from "@/config/storefront-content";
import styles from "./product-detail.module.css";

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
  support = productSupportContent,
  showSpecs = true
}: {
  product: Product;
  relatedProducts: ProductShellItem[];
  support?: ProductSupportContent;
  showSpecs?: boolean;
}) {
  const specs = showSpecs ? getCustomerFacingSpecs(product) : [];
  const showFaq = support.faqs.length > 0;
  const showRelated = relatedProducts.length > 0;
  const showTabs = showFaq && showRelated;
  const defaultTab = showFaq ? "faq" : "related";

  if (!specs.length && !showFaq && !showRelated) return null;

  return (
    <section className={cn("product-detail-support", styles.supportSection)}>
      <div className={styles.supportInner}>
        {specs.length > 0 ? (
          <div className={styles.fullSpecsSection} id="specs">
            <div className={styles.supportHeader}>
              <div>
                <h2 className={styles.supportTitle}>Specs</h2>
                <p className={styles.supportSubtitle}>Full technical specifications for deployment and procurement review.</p>
              </div>
            </div>
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

        {showFaq || showRelated ? (
          <div className={cn(styles.supportTabs, specs.length > 0 && "mt-10")} data-support-tabs>
            {showTabs ? (
              <>
                <input type="radio" name={`support-tab-${product.slug}`} id={`support-faq-${product.slug}`} defaultChecked={defaultTab === "faq"} className="sr-only" />
                <input type="radio" name={`support-tab-${product.slug}`} id={`support-related-${product.slug}`} defaultChecked={defaultTab === "related"} className="sr-only" />
                <div className={styles.tabList} role="tablist" aria-label="Product support sections">
                  {showFaq ? (
                    <label htmlFor={`support-faq-${product.slug}`} className={cn("type-button", styles.tabPill, styles.tabPillLabel)}>
                      FAQ
                    </label>
                  ) : null}
                  {showRelated ? (
                    <label htmlFor={`support-related-${product.slug}`} className={cn("type-button", styles.tabPill, styles.tabPillLabel)}>
                      Related
                    </label>
                  ) : null}
                </div>
              </>
            ) : null}

            {showFaq ? (
              <div id="faq" className={cn(styles.tabPanel, showTabs ? styles.supportTabPanelFaq : undefined)} role="tabpanel">
                <div className={styles.faqPanel}>
                  {support.faqs.map(([question, answer]) => (
                    <details key={question} className={styles.faqItem}>
                      <summary className={styles.faqQuestion}>{question}</summary>
                      <p className={styles.faqAnswer}>{answer}</p>
                    </details>
                  ))}
                </div>
              </div>
            ) : null}

            {showRelated && relatedProducts.length > 0 ? (
              <div id="accessories" className={cn(styles.tabPanel, showTabs ? styles.supportTabPanelRelated : undefined)} role="tabpanel">
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
        ) : null}
      </div>
    </section>
  );
}
