import type { Product } from "@/config/types";
import { calculateProductTaxBreakdown } from "@/lib/product-tax";
import { getProductOverviewText } from "@/lib/product-detail-content";
import { toAbsoluteUrl } from "@/lib/site-url";

const ORGANIZATION_ID = "https://mithron.com/#organization";
const WEBSITE_ID = "https://mithron.com/#website";

function schemaAvailability(product: Product) {
  const availability = product.specs.Availability?.toLowerCase() ?? "";
  if (/out of stock|sold out|unavailable/.test(availability)) {
    return "https://schema.org/OutOfStock";
  }
  if (/pre-?order|backorder/.test(availability)) {
    return "https://schema.org/PreOrder";
  }
  return "https://schema.org/InStock";
}

function normalizeImageUrl(src: string) {
  if (/^https?:\/\//i.test(src)) {
    return src;
  }
  return toAbsoluteUrl(src);
}

function productImages(product: Product) {
  const images = [product.hero?.src, product.image?.src, ...product.gallery.map((item) => item.src)]
    .filter(Boolean)
    .map((src) => normalizeImageUrl(src));

  return [...new Set(images)];
}

function productDescription(product: Product) {
  return product.seoDescription?.trim()
    || product.tagline?.trim()
    || getProductOverviewText(product).trim()
    || product.name;
}

function productOfferPrice(product: Product) {
  const breakdown = calculateProductTaxBreakdown({
    unitPrice: product.price,
    quantity: 1,
    chargeTax: product.chargeTax,
    taxGroup: product.taxGroup,
    taxRate: product.taxRate,
    taxIncluded: product.taxIncluded
  });

  return breakdown.lineTotal.toFixed(2);
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Mithron Flight Systems",
    url: toAbsoluteUrl("/"),
    logo: toAbsoluteUrl("/favicon.svg"),
    sameAs: [] as string[]
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "Mithron Flight Systems",
    url: toAbsoluteUrl("/"),
    publisher: { "@id": ORGANIZATION_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${toAbsoluteUrl("/products")}?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

export function buildProductJsonLd(product: Product) {
  const productUrl = toAbsoluteUrl(product.productUrl ?? `/product/${product.slug}`);
  const images = productImages(product);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.name,
    description: productDescription(product),
    sku: product.slug,
    category: product.category,
    image: images,
    brand: {
      "@type": "Brand",
      name: "Mithron Flight Systems"
    },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "INR",
      price: productOfferPrice(product),
      availability: schemaAvailability(product),
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ORGANIZATION_ID }
    }
  };
}

export function buildProductBreadcrumbJsonLd(product: Product) {
  const productUrl = toAbsoluteUrl(product.productUrl ?? `/product/${product.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: toAbsoluteUrl("/")
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Products",
        item: toAbsoluteUrl("/products")
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: productUrl
      }
    ]
  };
}

export function buildSiteStructuredData() {
  return [buildOrganizationJsonLd(), buildWebSiteJsonLd()];
}

export function buildProductStructuredData(product: Product) {
  return [buildProductJsonLd(product), buildProductBreadcrumbJsonLd(product)];
}
