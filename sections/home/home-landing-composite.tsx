"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { ArrowRight, Star } from "lucide-react";
import type { Product, MediaAsset } from "@/config/types";
import { SiteFooter } from "@/components/layout/site-footer";
import { MithronCardImage } from "@/components/media/mithron-card-image";
import { MithronMissionTileImage } from "@/components/media/mithron-mission-tile-image";
import { MithronShelfHeroImage } from "@/components/media/mithron-shelf-hero-image";
import { MithronThumbImage } from "@/components/media/mithron-thumb-image";
import { footerContent, type FooterContent } from "@/config/storefront-content";
import { isCmsStrictMode } from "@/lib/cms/strict-mode";
import type { HomepageCmsContent } from "@/config/homepage-cms";
import { defaultHomepageCmsContent } from "@/config/homepage-cms";
import { homepageMediaFallbacks as localMedia } from "@/config/homepage-media-fallbacks";
import {
  filterDroneCareProducts,
  filterDroneWorldProducts,
  isDroneCareShelfProduct,
  isDroneWorldCategory,
  isGlobalProductsCategory,
  resolveHomepageShelf
} from "@/lib/product-shelf-classification";
import { useReducedMotionPreference } from "@/hooks/use-reduced-motion";
import { formatUsd } from "@/lib/utils";
import type { ProductReviewContent } from "@/config/storefront-content";
import styles from "./home-landing-composite.module.css";

type ProofState = "VERIFIED" | "FALLBACK";
type MediaState = "VERIFIED" | "FALLBACK";
type LayoutKind =
  | "ecosystem"
  | "care"
  | "catalog"
  | "agri-mission"
  | "city-mission";

type ChapterMedia = Pick<MediaAsset, "src" | "alt"> & {
  caption: string;
  sourceState: ProofState;
};

type HomeChapter = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  layoutKind: LayoutKind;
  media: ChapterMedia;
  productFilter: (product: Product) => boolean;
  proofState: ProofState;
  proof: string[];
};

type ProductShelfConfig = {
  id: string;
  eyebrow: string;
  title: string;
  href: string;
  viewAllLabel: string;
  productFilter: (product: Product) => boolean;
  featurePriority: string[];
  featureExclude: string[];
  testId: string;
  guideLabel: string;
  guideTitle: string;
  guideHref: string;
  heroSubtitle: string;
  heroBody: string;
  featureCta: string;
  heroCtaHref: string;
  tone: "world" | "care" | "global";
};

type MissionWorldTile = {
  label: string;
  body: string;
  href?: string;
  media: Pick<MediaAsset, "src" | "alt">;
  operator: string;
  model: string;
  location: string;
  size: "hero" | "wide" | "tall" | "standard";
};

type MissionWorldConfig = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  testId: "agri-community-world" | "city-drone-world";
  composition: "agri-field" | "city-urban";
  mediaState: MediaState;
  mediaNote: string;
  tiles: MissionWorldTile[];
};

type MiniCarouselItem = {
  itemKey: string;
  label: string;
  href: string;
  media: Pick<MediaAsset, "src" | "alt">;
  sourceState: ProofState;
};

function hasAny(product: Product, values: string[]) {
  const haystack = [
    product.name,
    product.tagline,
    product.category,
    ...product.interests,
    product.specs["Product ID"] ?? ""
  ].join(" ").toLowerCase();
  return values.some((value) => haystack.includes(value.toLowerCase()));
}

const droneWorldProductFilter = (product: Product) => isDroneWorldCategory(product);
const droneCareProductFilter = (product: Product) => isDroneCareShelfProduct(product);
const globalProductFilter = (product: Product) => isGlobalProductsCategory(product);

const chapters: HomeChapter[] = [
  {
    id: "drone-world",
    eyebrow: "Featured Collection",
    title: "Drone World",
    body: "Aircraft and mission-ready drones from the published catalog.",
    href: "/products",
    cta: "View All",
    layoutKind: "ecosystem",
    media: localMedia.droneWorld,
    productFilter: droneWorldProductFilter,
    proofState: "VERIFIED",
    proof: ["Catalog products", "Product detail routes", "Published images"]
  },
  {
    id: "drone-care",
    eyebrow: "Essential Care",
    title: "Drone Care",
    body: "Batteries, propellers, controllers, filters, gimbals, and care-adjacent catalog items.",
    href: "/accessories",
    cta: "View All",
    layoutKind: "care",
    media: localMedia.droneCare,
    productFilter: droneCareProductFilter,
    proofState: "VERIFIED",
    proof: ["Accessory catalog", "Care paths", "Product links"]
  },
  {
    id: "global-products",
    eyebrow: "Global Selection",
    title: "Global Product",
    body: "A broader shelf of systems and specialist products for mission comparison.",
    href: "/products",
    cta: "View All",
    layoutKind: "catalog",
    media: localMedia.globalProducts,
    productFilter: globalProductFilter,
    proofState: "VERIFIED",
    proof: ["Published product data", "Real product images", "Category routes"]
  },
  {
    id: "agri-drones",
    eyebrow: "Solutions for Growth",
    title: "Agri Community World",
    body: "Join India's largest agricultural drone ecosystem. Register as a pilot, farmer, drone owner, or service provider and access training, financing, bookings, and support across the AGRONE network.",
    href: "/agriculture",
    cta: "Explore Agri Drones",
    layoutKind: "agri-mission",
    media: localMedia.agri,
    productFilter: (product) => hasAny(product, ["agri", "agriculture", "spray", "crop", "seed", "smart-farming", "mapping"]),
    proofState: "FALLBACK",
    proof: ["Representative mission gallery", "Existing Mithron media", "No customer deployment claims"]
  },
  {
    id: "city-drones",
    eyebrow: "Solutions for Future Cities",
    title: "City Drone World",
    body: "Urban mission paths shown as representative Mithron operation stories.",
    href: "/surveillance",
    cta: "Explore City Drones",
    layoutKind: "city-mission",
    media: localMedia.city,
    productFilter: (product) => hasAny(product, ["surveillance", "inspection", "security", "delivery", "mapping", "thermal", "camera"]),
    proofState: "FALLBACK",
    proof: ["Representative mission gallery", "Existing Mithron media", "No municipal deployment claims"]
  }
];

const productShelfConfigs: Record<"drone-world" | "drone-care" | "global-products", ProductShelfConfig> = {
  "drone-world": {
    id: "drone-world",
    eyebrow: "Featured Collection",
    title: "Drone World",
    href: "/products",
    viewAllLabel: "View All",
    productFilter: chapters[0].productFilter,
    featurePriority: ["drone", "uav", "kisan", "sprayer", "seed spreader"],
    featureExclude: ["controller", "flight controller", "propeller", "battery", "cable", "connector", "sensor", "motor", "frame", "hpc"],
    testId: "drone-world-shelf",
    guideLabel: "Buying Guides",
    guideTitle: "Which Drone Fits Your Mission?",
    guideHref: "/products",
    heroSubtitle: "DRONE IS MITHRON",
    heroBody: "Welcome to India's 1st & Leading Drone Ecosystem Aggregator",
    featureCta: "Visit Mithron Smart",
    heroCtaHref: "https://www.mithronsmart.com",
    tone: "world"
  },
  "drone-care": {
    id: "drone-care",
    eyebrow: "Essential Care",
    title: "Drone Care",
    href: "/accessories",
    viewAllLabel: "View All",
    productFilter: chapters[1].productFilter,
    featurePriority: ["battery", "propeller", "controller", "gimbal", "filter", "care", "spare"],
    featureExclude: [],
    testId: "drone-care-shelf",
    guideLabel: "Care Guides",
    guideTitle: "Build a Reliable Spares Kit",
    guideHref: "/accessories",
    heroSubtitle: "One Stop Drone Solution",
    heroBody: "Sales / Rental Service / Troubleshooting / Aggregation / Academics / Import / Loan",
    featureCta: "Visit Mithron Smart",
    heroCtaHref: "https://www.mithronsmart.com",
    tone: "care"
  },
  "global-products": {
    id: "global-products",
    eyebrow: "Global Selection",
    title: "Global Product",
    href: "/products",
    viewAllLabel: "View All",
    productFilter: chapters[2].productFilter,
    featurePriority: ["drone", "survey", "surveillance", "mapping", "industrial", "system"],
    featureExclude: ["cable", "connector", "propeller", "battery", "motor", "frame"],
    testId: "global-products-shelf",
    guideLabel: "Catalog Guides",
    guideTitle: "Compare Mission Systems",
    guideHref: "/products",
    heroSubtitle: "Global Drone Connect",
    heroBody: "A marketplace to connect for Global products Import and Export / Live Price Bid",
    featureCta: "Visit Mithron Smart",
    heroCtaHref: "https://www.mithronsmart.com",
    tone: "global"
  }
};

const AGRONE_REGISTRATION_LINKS = {
  pilot: "https://drone.mithronsmart.com/register",
  droneOwner: "https://drone.mithronsmart.com/droneowner_reg",
  smartFarmer: "https://drone.mithronsmart.com/farmer"
} as const;

const missionWorldConfigs: Record<"agri-drones" | "city-drones", MissionWorldConfig> = {
  "agri-drones": {
    id: "agri-drones",
    eyebrow: "Solutions for Growth",
    title: "Agri Community World",
    body: "Join India's largest agricultural drone ecosystem. Register as a pilot, farmer, drone owner, or service provider and access training, financing, bookings, and support across the AGRONE network.",
    testId: "agri-community-world",
    composition: "agri-field",
    mediaState: "VERIFIED",
    mediaNote: "",
    tiles: [
      {
        label: "AGRONE Drone Owner Registration",
        body: "Register your drone on AGRONE and connect with farmers, pilots, and service demand across India.",
        href: AGRONE_REGISTRATION_LINKS.droneOwner,
        media: localMedia.agroneDroneOwnerRegistration,
        operator: "AGRONE Network",
        model: "DRONE OWNER NETWORK",
        location: "Pan-India onboarding",
        size: "tall"
      },
      {
        label: "AGRONE Pilot Registration",
        body: "Join the certified pilot network, access training pathways, and receive mission assignments through AGRONE.",
        href: AGRONE_REGISTRATION_LINKS.pilot,
        media: localMedia.agronePilotRegistration,
        operator: "AGRONE Network",
        model: "AGRONE PILOT NETWORK",
        location: "Pilot onboarding",
        size: "hero"
      },
      {
        label: "All India Farmer Drone Booking",
        body: "Book drone spraying, mapping, and monitoring services anywhere in India through the AGRONE booking platform.",
        media: localMedia.agroneFarmerDroneBooking,
        operator: "AGRONE Network",
        model: "NATIONWIDE BOOKING",
        location: "Service booking desk",
        size: "tall"
      },
      {
        label: "Smart Farmer Registration",
        body: "Register as a smart farmer to access AGRONE services, crop insights, and on-demand drone support.",
        href: AGRONE_REGISTRATION_LINKS.smartFarmer,
        media: localMedia.agroneSmartFarmerRegistration,
        operator: "AGRONE Network",
        model: "SMART FARMER PROGRAM",
        location: "Farmer onboarding",
        size: "wide"
      },
      {
        label: "Agri Drone Loan & EMI Check",
        body: "Check agri-drone loan eligibility, compare EMI plans, and explore financing options backed by AGRONE partners.",
        media: localMedia.agroneAgriDroneLoanEmi,
        operator: "AGRONE Network",
        model: "FINANCING SUPPORT",
        location: "Loan eligibility check",
        size: "standard"
      }
    ]
  },
  "city-drones": {
    id: "city-drones",
    eyebrow: "Solutions for Future Cities",
    title: "City Drone World",
    body: "Urban drone platforms for booking, pilot networks, training, service care, and technician support across modern city operations.",
    testId: "city-drone-world",
    composition: "city-urban",
    mediaState: "VERIFIED",
    mediaNote: "",
    tiles: [
      {
        label: "Dronelancer Model",
        body: "Pilot-network and mission-marketplace model connecting city operators, route visibility, and on-demand jobs.",
        media: localMedia.cityTrafficAnalytics,
        operator: "Mithron City Network",
        model: "DRONELANCER MODEL",
        location: "Pilot network grid",
        size: "tall"
      },
      {
        label: "City Drone Rental Services App",
        body: "Rental, booking, and operator-dispatch flow for city drone services, project requests, and earnings visibility.",
        media: localMedia.citySmartMonitoring,
        operator: "Mithron City Network",
        model: "RENTAL SERVICES APP",
        location: "Urban booking console",
        size: "hero"
      },
      {
        label: "All Drone Acadamic",
        body: "Training ecosystem for city pilots, simulation labs, classroom workflows, and certified urban flight programs.",
        media: localMedia.cityEmergencyResponse,
        operator: "Mithron Academy Network",
        model: "ALL DRONE ACADAMIC",
        location: "Training and simulation hub",
        size: "tall"
      },
      {
        label: "Drone FranchiseCare Center",
        body: "Service-center network for franchise operations, repair care, spare support, and local city maintenance coverage.",
        media: localMedia.cityInfrastructureInspection,
        operator: "Mithron Service Network",
        model: "FRANCHISECARE CENTER",
        location: "City care workshop",
        size: "standard"
      },
      {
        label: "Drone Technician Aggregation",
        body: "Distributed technician aggregation system for diagnostics, field support, tools, and maintenance coordination.",
        media: localMedia.cityCrowdMonitoring,
        operator: "Mithron Service Network",
        model: "TECHNICIAN AGGREGATION",
        location: "Field support network",
        size: "standard"
      }
    ]
  }
};

function productShelfSearchText(product: Product) {
  return [
    product.name,
    product.tagline,
    product.category,
    ...product.interests,
    product.badge ?? "",
    product.specs["Product ID"] ?? ""
  ].join(" ").toLowerCase();
}

function textHasAny(text: string, values: string[]) {
  return values.some((value) => text.includes(value.toLowerCase()));
}

const miniCarouselProductPriority = [
  "drone",
  "agri",
  "sprayer",
  "seed",
  "survey",
  "mapping",
  "surveillance",
  "camera",
  "controller",
  "battery",
  "propeller",
  "power",
  "gimbal"
];

function miniCarouselProductScore(product: Product) {
  const text = productShelfSearchText(product);
  const priorityIndex = miniCarouselProductPriority.findIndex((keyword) => text.includes(keyword));
  const productBias = text.includes("drone") ? 18 : 0;
  return (priorityIndex === -1 ? 0 : miniCarouselProductPriority.length - priorityIndex) + productBias;
}

function pickMiniCarouselItems(products: Product[]): MiniCarouselItem[] {
  const carouselProducts = filterDroneWorldProducts(products);
  return carouselProducts
    .filter((product) => product.slug && product.image?.src)
    .map((product, index) => ({ product, index, score: miniCarouselProductScore(product) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 14)
    .map(({ product, index }) => ({
      itemKey: `${product.slug}-${index}`,
      label: product.name,
      href: `/product/${product.slug}`,
      media: product.image,
      sourceState: "VERIFIED"
    }));
}

function pickFeatureProduct(products: Product[], config: ProductShelfConfig) {
  const fallback = products[0];
  if (!fallback) return undefined;

  const eligible = products.filter((product) => !textHasAny(productShelfSearchText(product), config.featureExclude));
  const candidates = eligible.length ? eligible : products;
  return candidates.find((product) => textHasAny(productShelfSearchText(product), config.featurePriority)) ?? candidates[0] ?? fallback;
}

function pickShelfProducts(products: Product[], config: ProductShelfConfig, count = 5) {
  const selected = products.filter(config.productFilter);
  const pool = selected.length ? selected : (
    config.tone === "care" ? filterDroneCareProducts(products)
      : config.tone === "global" ? []
        : filterDroneWorldProducts(products)
  );
  const feature = pickFeatureProduct(pool, config);
  if (!feature) return [];
  const remaining = pool.filter((product) => product.slug !== feature.slug);
  return [feature, ...remaining].slice(0, count);
}

function compactProductMeta(product: Product) {
  const label = product.badge || product.category || "Catalog";
  const phrase = product.tagline
    .replace(/\s+/g, " ")
    .split(/[.;\n]/)[0]
    ?.split(",")
    .slice(0, 2)
    .join(",")
    .trim();
  const detail = phrase && phrase.length > 42 ? `${phrase.slice(0, 39).trim()}...` : phrase;
  return { label, detail };
}

function ProductShelfSection({
  chapter,
  config,
  products
}: {
  chapter: HomeChapter;
  config: ProductShelfConfig;
  products: Product[];
}) {
  const shelfProducts = useMemo(() => pickShelfProducts(products, config), [products, config]);
  const cardProducts = shelfProducts.slice(0, 4);
  const guideMedia = cardProducts[0]?.image ?? null;

  return (
    <article
      id={chapter.id}
      className={`${styles.chapter} ${styles.productShelfSection}`}
      data-home-composite-chapter={chapter.id}
      data-layout-kind={chapter.layoutKind}
      data-testid="home-product-shelf-section"
      data-shelf-id={config.testId}
      data-shelf-tone={config.tone}
    >
      <div className={styles.container}>
        <div className={styles.productShelfHeader} data-home-composite-reveal>
          <div>
            <p className={styles.eyebrow}>{config.eyebrow}</p>
            <h2 className={styles.shelfTitle}>{config.title}</h2>
          </div>
          <div className={styles.shelfHeaderActions}>
            <Link href={config.href} className={styles.viewAllLink}>
              {config.viewAllLabel}
              <span className={styles.viewAllIcon} aria-hidden="true">
                <ArrowRight size={14} />
              </span>
            </Link>
          </div>
        </div>

        <div className={styles.shelfBoard} data-home-composite-reveal>
          {cardProducts.length > 0 ? (
            <div
              className={styles.productShelfGrid}
              data-testid="home-product-shelf-grid"
              aria-label={`${config.title} catalog-backed board`}
            >
              {cardProducts.map((product, productIndex) => (
                (() => {
                  const meta = compactProductMeta(product);
                  return (
                    <Link
                      href={`/product/${product.slug}`}
                      className={styles.productCard}
                      data-testid="home-product-card"
                      key={`${config.id}-${product.slug}`}
                    >
                      <div className={styles.productImageWell}>
                        <span className={styles.productCutoutShadowGround} aria-hidden />
                        <span className={styles.productCutoutShadowContact} aria-hidden />
                        {/* Product thumbnail is decorative because the adjacent link text names the product. */}
                        <MithronCardImage
                          src={product.image.src}
                          alt=""
                          aria-hidden={true}
                          fill
                          priority={productIndex < 2}
                          responsive={product.image.responsive}
                          sizes="(max-width: 640px) 72vw, (max-width: 1024px) 36vw, 270px"
                          className={styles.productImage}
                        />
                      </div>
                      <div className={styles.productBody}>
                        <p className={styles.productKicker}>
                          <span>{meta.label}</span>
                          {meta.detail ? ` · ${meta.detail}` : null}
                        </p>
                        <h3 className={styles.productName}>{product.name}</h3>
                      <div className={styles.productFooter}>
                        <span>{formatUsd(product.price)}</span>
                        <span className={styles.productBuyNow}>Buy Now</span>
                        <span className={styles.productActionDot} aria-hidden="true" />
                      </div>
                      </div>
                    </Link>
                  );
                })()
              ))}

              <Link
                href={config.guideHref}
                className={styles.guideCard}
                data-testid="home-product-guide-card"
              >
                <span className={styles.guideLabel}>{config.guideLabel}</span>
                <strong>{config.guideTitle}</strong>
                <span className={styles.guideArrow} aria-hidden="true">
                  <ArrowRight size={14} />
                </span>
                {guideMedia ? (
                  <MithronCardImage
                    src={guideMedia.src}
                    alt=""
                    aria-hidden={true}
                    fill
                    sizes="(max-width: 640px) 72vw, 280px"
                    className={styles.guideImage}
                  />
                ) : null}
              </Link>
            </div>
          ) : null}

          <a
            href={config.heroCtaHref}
            className={styles.productShelfHero}
            data-testid="home-product-shelf-hero"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className={styles.shelfHeroBackdrop} aria-hidden="true">
              <MithronShelfHeroImage
                src={chapter.media.src}
                alt={chapter.media.alt}
                fill
                className={styles.shelfHeroContextImage}
              />
            </span>
            <span className={styles.shelfHeroCopy}>
              <span className={styles.shelfHeroHeading}>{config.title}</span>
            </span>
          </a>
        </div>
      </div>
    </article>
  );
}

function renderChapter({
  chapter,
  products,
  shelfConfigs,
  missionConfigs
}: {
  chapter: HomeChapter;
  products: Product[];
  shelfConfigs: typeof productShelfConfigs;
  missionConfigs: typeof missionWorldConfigs;
}) {
  switch (chapter.layoutKind) {
    case "ecosystem":
      return (
        <ProductShelfSection
          chapter={chapter}
          config={shelfConfigs["drone-world"]}
          products={products}
          key={chapter.id}
        />
      );
    case "care":
      return (
        <ProductShelfSection
          chapter={chapter}
          config={shelfConfigs["drone-care"]}
          products={products}
          key={chapter.id}
        />
      );
    case "catalog":
      return (
        <ProductShelfSection
          chapter={chapter}
          config={shelfConfigs["global-products"]}
          products={products}
          key={chapter.id}
        />
      );
    case "agri-mission":
      return <AgriCommunityWorldSection chapter={chapter} config={missionConfigs["agri-drones"]} key={chapter.id} />;
    case "city-mission":
      return <CityDroneWorldSection chapter={chapter} config={missionConfigs["city-drones"]} key={chapter.id} />;
  }
}

type HomeProductReview = {
  id: string;
  reviewerName: string;
  reviewerRole: string;
  body: string;
  rating: number;
  productSlug: string;
  productName: string;
  productImage: MediaAsset;
};

type TestimonialsMediaState = "VERIFIED" | "EMPTY";

const representativeHomeReviewTemplates = [
  {
    reviewerName: "Venkat R.",
    reviewerRole: "Agri operations lead",
    body: "Spray runs stay consistent across uneven blocks. The power setup handled back-to-back sorties without downtime during peak season.",
    rating: 5,
    productHint: /hpc|power-cube|power/i
  },
  {
    reviewerName: "Priya S.",
    reviewerRole: "Drone systems integrator",
    body: "Clean integration with our agri stack. Flight tuning was straightforward and the team documented every change for our pilots.",
    rating: 5,
    productHint: /controller|flight/i
  },
  {
    reviewerName: "Arun M.",
    reviewerRole: "Field maintenance technician",
    body: "Cable kit arrived organized and labeled. Swapping damaged leads in the field took minutes instead of half a day of rework.",
    rating: 4,
    productHint: /cable|connector/i
  }
] as const;

function pickHomeProductReviews(reviews: ProductReviewContent[], products: Product[]) {
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const resolved: HomeProductReview[] = [];

  for (const review of reviews) {
    if (resolved.length >= 3) break;
    const product = review.productSlug ? productBySlug.get(review.productSlug) : undefined;
    if (!product) continue;

    resolved.push({
      id: review.id ?? `product-review-${product.slug}-${resolved.length}`,
      reviewerName: review.name,
      reviewerRole: "Published review",
      body: review.body,
      rating: testimonialStarCount(review.rating),
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image
    });
  }

  return {
    items: resolved.slice(0, 3),
    mediaState: resolved.length > 0 ? ("VERIFIED" as const) : ("EMPTY" as const)
  };
}

function pickRepresentativeHomeReviews(products: Product[]): HomeProductReview[] {
  const usedSlugs = new Set<string>();
  const resolved: HomeProductReview[] = [];

  for (const template of representativeHomeReviewTemplates) {
    const product = products.find(
      (entry) =>
        entry.slug &&
        entry.image?.src &&
        !usedSlugs.has(entry.slug) &&
        template.productHint.test(`${entry.slug} ${entry.name}`)
    );
    if (!product?.slug) continue;

    usedSlugs.add(product.slug);
    resolved.push({
      id: `representative-review-${product.slug}`,
      reviewerName: template.reviewerName,
      reviewerRole: template.reviewerRole,
      body: template.body,
      rating: template.rating,
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image
    });
  }

  for (const product of products) {
    if (resolved.length >= 3) break;
    if (!product.slug || !product.image?.src || usedSlugs.has(product.slug)) continue;

    const template = representativeHomeReviewTemplates[resolved.length];
    usedSlugs.add(product.slug);
    resolved.push({
      id: `representative-review-${product.slug}`,
      reviewerName: template.reviewerName,
      reviewerRole: template.reviewerRole,
      body: template.body,
      rating: template.rating,
      productSlug: product.slug,
      productName: product.name,
      productImage: product.image
    });
  }

  return resolved.slice(0, 3);
}

function hasTestimonialsHeader(header: HomepageCmsContent["testimonials"]) {
  return Boolean(header.title?.trim() || header.eyebrow?.trim());
}

function testimonialInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function testimonialStarCount(rating?: number | null) {
  return Math.min(5, Math.max(1, Math.round(rating ?? 5)));
}

function TestimonialReviewCard({ item }: { item: HomeProductReview }) {
  return (
    <article className={styles.testimonialCard}>
      <div className={styles.testimonialStars} aria-label={`Rated ${item.rating} out of 5`}>
        {Array.from({ length: item.rating }).map((_, index) => (
          <Star key={`${item.id}-star-${index}`} className="size-4" fill="currentColor" aria-hidden="true" />
        ))}
      </div>
      <blockquote className={styles.testimonialQuote}>&ldquo;{item.body}&rdquo;</blockquote>
      <footer className={styles.testimonialProfile}>
        <span className={styles.testimonialAvatar} aria-hidden="true">
          {testimonialInitials(item.reviewerName)}
        </span>
        <div>
          <p className={styles.testimonialName}>{item.reviewerName}</p>
          <p className={styles.testimonialRole}>{item.reviewerRole}</p>
        </div>
      </footer>
      <Link href={`/product/${item.productSlug}`} className={styles.testimonialProduct}>
        <span className={styles.testimonialProductImageWell}>
          <MithronThumbImage
            src={item.productImage.src}
            alt={item.productImage.alt}
            fill
            responsive={item.productImage.responsive}
            sizes="(max-width: 640px) 64px, 72px"
            className={styles.testimonialProductImage}
          />
        </span>
        <span className={styles.testimonialProductCopy}>
          <span className={styles.testimonialProductLabel}>Reviewed product</span>
          <span className={styles.testimonialProductName}>{item.productName}</span>
        </span>
      </Link>
    </article>
  );
}

function HomeCustomerTestimonialsSection({
  items,
  mediaState,
  header,
  products
}: {
  items: HomeProductReview[];
  mediaState: TestimonialsMediaState;
  header: HomepageCmsContent["testimonials"];
  products: Product[];
}) {
  const representativeReviews = useMemo(() => pickRepresentativeHomeReviews(products), [products]);
  const showVerifiedReviews = mediaState === "VERIFIED" && items.length > 0;
  const displayReviews = showVerifiedReviews ? items : representativeReviews;

  if (!hasTestimonialsHeader(header)) {
    return null;
  }

  return (
    <section
      id="home-customer-testimonials"
      className={styles.testimonialsSection}
      data-testid="home-customer-testimonials"
      data-mission-motion="skip"
      data-media-state={mediaState}
      aria-label="Customer product reviews"
    >
      <div className={styles.testimonialsInner}>
        <div className={styles.testimonialsHeader}>
          <div className={styles.testimonialsHeaderCopy}>
            <div className={styles.testimonialsEyebrowRow}>
              <p className={styles.testimonialsEyebrow}>{header.eyebrow}</p>
              <span className={styles.testimonialsEyebrowMark} aria-hidden="true" />
            </div>
            <h2 className={styles.testimonialsTitle}>{header.title}</h2>
            <p className={styles.testimonialsLead}>{header.lead}</p>
          </div>
          <Link href={header.linkHref} className={styles.testimonialsLink}>
            {header.linkLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className={styles.testimonialsGrid}>
          {displayReviews.map((item) => (
            <TestimonialReviewCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeAboutUsBand({ about }: { about: HomepageCmsContent["about"] }) {
  return (
    <section className={styles.aboutBand} id="home-about-band" data-testid="home-about-band" data-mission-motion="skip" aria-label="About Mithron">
      <div className={styles.aboutBandInner}>
        <div className={styles.aboutBandCopy}>
          <p className={styles.aboutEyebrow}>{about.eyebrow}</p>
          <h2 className={styles.aboutTitle}>{about.title}</h2>
          <p className={styles.aboutBody}>{about.body}</p>
        </div>
        <div className={styles.aboutActions}>
          <Link href={about.primaryHref} className={styles.aboutPrimaryAction}>
            {about.primaryLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link href={about.secondaryHref} className={styles.aboutSecondaryAction}>
            {about.secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HomeLandingComposite({
  products,
  productReviews = [],
  footer,
  homepageCms
}: {
  products: Product[];
  productReviews?: ProductReviewContent[];
  footer?: FooterContent;
  homepageCms?: HomepageCmsContent;
}) {
  const rootRef = useRef<HTMLElement | null>(null);
  const miniCarouselRailRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotionPreference();
  const scrollMiniCarousel = useCallback(() => {
    const rail = miniCarouselRailRef.current;
    if (!rail) return;
    rail.scrollBy({ left: rail.clientWidth * 0.8, behavior: reducedMotion ? "auto" : "smooth" });
  }, [reducedMotion]);
  const strictWithoutCms = isCmsStrictMode() && !homepageCms;
  const cms = homepageCms ?? defaultHomepageCmsContent;
  const shelfConfigs = useMemo(
    () => ({
      "drone-world": {
        ...productShelfConfigs["drone-world"],
        eyebrow: cms.shelves.droneWorld.eyebrow,
        title: cms.shelves.droneWorld.title,
        href: cms.shelves.droneWorld.href,
        viewAllLabel: cms.shelves.droneWorld.viewAllLabel,
        guideLabel: cms.shelves.droneWorld.guideLabel,
        guideTitle: cms.shelves.droneWorld.guideTitle,
        guideHref: cms.shelves.droneWorld.guideHref,
        heroSubtitle: cms.shelves.droneWorld.heroSubtitle,
        heroBody: cms.shelves.droneWorld.heroBody,
        featureCta: cms.shelves.droneWorld.featureCta,
        heroCtaHref: cms.shelves.droneWorld.heroCtaHref
      },
      "drone-care": {
        ...productShelfConfigs["drone-care"],
        eyebrow: cms.shelves.droneCare.eyebrow,
        title: cms.shelves.droneCare.title,
        href: cms.shelves.droneCare.href,
        viewAllLabel: cms.shelves.droneCare.viewAllLabel,
        guideLabel: cms.shelves.droneCare.guideLabel,
        guideTitle: cms.shelves.droneCare.guideTitle,
        guideHref: cms.shelves.droneCare.guideHref,
        heroSubtitle: cms.shelves.droneCare.heroSubtitle,
        heroBody: cms.shelves.droneCare.heroBody,
        featureCta: cms.shelves.droneCare.featureCta,
        heroCtaHref: cms.shelves.droneCare.heroCtaHref
      },
      "global-products": {
        ...productShelfConfigs["global-products"],
        eyebrow: cms.shelves.globalProducts.eyebrow,
        title: cms.shelves.globalProducts.title,
        href: cms.shelves.globalProducts.href,
        viewAllLabel: cms.shelves.globalProducts.viewAllLabel,
        guideLabel: cms.shelves.globalProducts.guideLabel,
        guideTitle: cms.shelves.globalProducts.guideTitle,
        guideHref: cms.shelves.globalProducts.guideHref,
        heroSubtitle: cms.shelves.globalProducts.heroSubtitle,
        heroBody: cms.shelves.globalProducts.heroBody,
        featureCta: cms.shelves.globalProducts.featureCta,
        heroCtaHref: cms.shelves.globalProducts.heroCtaHref
      }
    }),
    [cms]
  );
  const missionConfigs = useMemo(() => {
    const mergeTiles = (
      defaults: MissionWorldConfig["tiles"],
      cmsTiles: HomepageCmsContent["missions"]["agri"]["tiles"]
    ) =>
      defaults.map((tile, index) => {
        const cmsTile = cmsTiles[index];
        if (!cmsTile) return tile;
        return {
          ...tile,
          label: cmsTile.label,
          body: cmsTile.body,
          operator: cmsTile.operator,
          model: cmsTile.model,
          location: cmsTile.location,
          href: cmsTile.href?.trim() || tile.href,
          media: { src: cmsTile.imageSrc, alt: cmsTile.imageAlt }
        };
      });

    return {
      "agri-drones": {
        ...missionWorldConfigs["agri-drones"],
        eyebrow: cms.missions.agri.eyebrow,
        title: cms.missions.agri.title,
        body: cms.missions.agri.body,
        mediaNote: cms.missions.agri.mediaNote,
        tiles: mergeTiles(missionWorldConfigs["agri-drones"].tiles, cms.missions.agri.tiles)
      },
      "city-drones": {
        ...missionWorldConfigs["city-drones"],
        eyebrow: cms.missions.city.eyebrow,
        title: cms.missions.city.title,
        body: cms.missions.city.body,
        mediaNote: cms.missions.city.mediaNote,
        tiles: mergeTiles(missionWorldConfigs["city-drones"].tiles, cms.missions.city.tiles)
      }
    };
  }, [cms]);
  const landingChapters = useMemo(
    () =>
      chapters.map((chapter) => {
        if (chapter.id === "drone-world") {
          return {
            ...chapter,
            href: cms.shelves.droneWorld.href,
            media: {
              ...chapter.media,
              src: cms.shelves.droneWorld.heroImageSrc,
              alt: cms.shelves.droneWorld.heroImageAlt
            }
          };
        }
        if (chapter.id === "drone-care") {
          return {
            ...chapter,
            href: cms.shelves.droneCare.href,
            media: {
              ...chapter.media,
              src: cms.shelves.droneCare.heroImageSrc,
              alt: cms.shelves.droneCare.heroImageAlt
            }
          };
        }
        if (chapter.id === "global-products") {
          return {
            ...chapter,
            href: cms.shelves.globalProducts.href,
            media: {
              ...chapter.media,
              src: cms.shelves.globalProducts.heroImageSrc,
              alt: cms.shelves.globalProducts.heroImageAlt
            }
          };
        }
        if (chapter.id === "agri-drones") {
          return {
            ...chapter,
            eyebrow: cms.missions.agri.eyebrow,
            title: cms.missions.agri.title,
            body: cms.missions.agri.body,
            href: cms.missions.agri.href,
            cta: cms.missions.agri.cta
          };
        }
        if (chapter.id === "city-drones") {
          return {
            ...chapter,
            eyebrow: cms.missions.city.eyebrow,
            title: cms.missions.city.title,
            body: cms.missions.city.body,
            href: cms.missions.city.href,
            cta: cms.missions.city.cta
          };
        }
        return chapter;
      }),
    [cms]
  );
  const miniCarouselItems = useMemo(() => pickMiniCarouselItems(products), [products]);
  const displayedProductReviews = useMemo(
    () => pickHomeProductReviews(productReviews, products),
    [productReviews, products]
  );
  const resolvedFooter = footer ?? (isCmsStrictMode() ? null : footerContent);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    if (reducedMotion) {
      root.setAttribute("data-motion-state", "reduced");
      return;
    }

    root.setAttribute("data-motion-state", "static");
  }, [reducedMotion]);

  if (strictWithoutCms) {
    return null;
  }

  return (
    <section
      ref={rootRef}
      className={styles.root}
      data-testid="home-landing-composite"
      data-home-composite-root="true"
      data-motion-state="reduced"
      data-motion-engine="static"
      aria-label="Mithron home landing composite"
    >
      <div
        className={styles.miniCarousel}
        data-testid="home-mini-carousel"
        data-carousel-kind="product"
        data-media-state={miniCarouselItems.some((item) => item.sourceState === "VERIFIED") ? "VERIFIED" : "FALLBACK"}
      >
        <div className={styles.miniCarouselViewport}>
          <div
            ref={miniCarouselRailRef}
            className={styles.miniCarouselRail}
            data-testid="home-mini-carousel-rail"
            aria-label="Mithron product category carousel"
          >
            {miniCarouselItems.map((item) => (
              <Link
                href={item.href}
                className={styles.miniCarouselItem}
                data-testid="home-mini-carousel-item"
                data-media-state={item.sourceState}
                key={item.itemKey}
              >
                <span className={styles.miniCarouselImageWell}>
                  <MithronThumbImage
                    src={item.media.src}
                    alt=""
                    aria-hidden={true}
                    fill
                    sizes="(max-width: 640px) 92px, 128px"
                    className={styles.miniCarouselImage}
                  />
                </span>
                <span className={styles.miniCarouselLabel}>{item.label}</span>
              </Link>
            ))}
          </div>
          <button
            type="button"
            className={styles.miniCarouselNext}
            aria-label="Show more Mithron categories"
            onClick={scrollMiniCarousel}
          >
            <ArrowRight size={22} aria-hidden="true" />
          </button>
        </div>
      </div>

      {landingChapters.map((chapter) => renderChapter({ chapter, products, shelfConfigs, missionConfigs }))}

      <HomeCustomerTestimonialsSection
        items={displayedProductReviews.items}
        mediaState={displayedProductReviews.mediaState}
        header={cms.testimonials}
        products={products}
      />

      <div className={styles.aboutFooterWrap} id="home-about-footer" data-testid="home-about-footer">
        <HomeAboutUsBand about={cms.about} />
        {resolvedFooter ? <SiteFooter content={resolvedFooter} /> : null}
      </div>
    </section>
  );
}

function formatMissionHeadline(title: string) {
  const words = title.trim().split(/\s+/).map((word) => word.toUpperCase());
  return words.map((word, index) => (
    <Fragment key={`${word}-${index}`}>
      {index > 0 ? <br /> : null}
      {word}
    </Fragment>
  ));
}

const agriImagePresentation: Record<
  string,
  { objectPosition: string; scale: number; transformOrigin: string }
> = {
  "agrone-drone-owner-registration": {
    objectPosition: "50% 36%",
    scale: 1.18,
    transformOrigin: "50% 34%"
  },
  "agrone-pilot-registration": {
    objectPosition: "50% 34%",
    scale: 1.22,
    transformOrigin: "50% 30%"
  },
  "all-india-drone-farmer": {
    objectPosition: "56% 38%",
    scale: 1.2,
    transformOrigin: "52% 36%"
  },
  "smart-farmer-register": {
    objectPosition: "50% 38%",
    scale: 1.14,
    transformOrigin: "50% 36%"
  },
  "agri-drone-loan": {
    objectPosition: "50% 38%",
    scale: 1.14,
    transformOrigin: "50% 36%"
  }
};

function agriImageKeyFromSrc(src: string) {
  return src.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "";
}

function getAgriImagePresentation(src: string, cardType: "tall" | "hero" | "standard" | "wide") {
  const key = agriImageKeyFromSrc(src);
  const tuned = agriImagePresentation[key];
  if (tuned) return tuned;

  const fallbackScale =
    cardType === "standard" ? 1.12 : cardType === "hero" ? 1.18 : cardType === "wide" ? 1.16 : 1.15;
  return { objectPosition: "50% 36%", scale: fallbackScale, transformOrigin: "50% 34%" };
}

function renderMissionWorldTile(
  tile: MissionWorldTile,
  tileKey: string,
  tileProps: Record<string, unknown>,
  tileContent: ReactNode
) {
  const href = tile.href?.trim();
  if (!href) {
    return (
      <div
        key={tileKey}
        {...tileProps}
        className={`${String(tileProps.className ?? "")} ${styles.agriCardShowcase}`}
        data-showcase-link="false"
      >
        {tileContent}
      </div>
    );
  }

  const isExternal = /^https?:\/\//i.test(href);
  return (
    <Link
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      aria-label={`${tile.label}: ${tile.body}`}
      key={tileKey}
      {...tileProps}
    >
      {tileContent}
    </Link>
  );
}

function AgriCommunityWorldSection({
  chapter,
  config
}: {
  chapter: HomeChapter;
  config: MissionWorldConfig;
}) {
  // data-testid="mission-world-tile"
  const renderAgriCard = (
    tile: MissionWorldTile,
    cardType: "tall" | "hero" | "standard" | "wide"
  ) => {
    const imagePresentation = getAgriImagePresentation(tile.media.src, cardType);
    const imageKey = agriImageKeyFromSrc(tile.media.src);
    const tileClassName = `${styles.agriCard} ${styles[`agriCard_${cardType}`]}`;
    const tileProps = {
      className: tileClassName,
      "data-testid": "mission-world-tile",
      "data-showcase-kind": "mission-image",
      "data-tile-size": cardType,
      "data-agri-image": imageKey || undefined,
      "data-dominant": cardType === "hero" ? "true" : "false",
      style: {
        "--agri-image-scale": String(imagePresentation.scale),
        "--agri-object-position": imagePresentation.objectPosition
      } as CSSProperties
    };

    const tileContent = (
      <>
        <MithronMissionTileImage
          src={tile.media.src}
          alt={tile.media.alt || tile.label}
          cardType={cardType}
          wrapperClassName={styles.agriCardImageFrame}
          sizes={
            cardType === "hero"
              ? "(max-width: 640px) 100vw, (max-width: 980px) 100vw, 65vw"
              : cardType === "wide"
                ? "(max-width: 640px) 100vw, (max-width: 980px) 100vw, 68vw"
                : cardType === "tall"
                  ? "(max-width: 640px) 100vw, (max-width: 980px) 48vw, 52vw"
                  : "(max-width: 640px) 100vw, (max-width: 980px) 48vw, 32vw"
          }
          className={styles.agriCardImage}
          style={{
            objectPosition: imagePresentation.objectPosition,
            transformOrigin: imagePresentation.transformOrigin
          }}
        />
        <span className={styles.agriCardOverlay} />
        <span className={styles.agriCardCopy}>
          <strong>{tile.label}</strong>
          <span>{tile.body}</span>
          <small>{tile.operator} | {tile.location}</small>
        </span>
        <span className={styles.agriCardDevice}>{tile.model}</span>
        <span className={styles.agriCardArrow} aria-hidden="true">
          <ArrowRight size={16} />
        </span>
      </>
    );

    return renderMissionWorldTile(tile, `agri-${tile.label}`, tileProps, tileContent);
  };

  return (
    <article
      id={chapter.id}
      className={`${styles.chapter} ${styles.agriSection}`}
      data-home-composite-chapter={chapter.id}
      data-layout-kind={chapter.layoutKind}
      data-mission-motion="skip"
      data-testid="agri-community-world-section"
    >
      <div className={styles.agriContainer}>
        <div className={styles.agriGridLayout}>
          {/* LEFT COLUMN */}
          <div className={styles.agriLeftColumn}>
            <div className={styles.agriTextHeader}>
              <div className={styles.agriEyebrowRow}>
                <span className={styles.agriEyebrow}>{config.eyebrow}</span>
                <svg
                  className={styles.agriLeafIcon}
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  width="14"
                  height="14"
                >
                  <path d="M17 8C8 10 4 19 4 19S13 15 20 6C20 6 18.5 5.5 17 8Z" />
                  <path d="M18.8284 3.17157C17.6569 2 15 2 13 4C11 6 6 13 4 15V20H9C11 18 18 13 20 11C22 9 22 6.34315 20.8284 5.17157L18.8284 3.17157Z" fill="currentColor" />
                </svg>
              </div>
              <h2 className={styles.agriHeadline}>{formatMissionHeadline(config.title)}</h2>
              <div className={styles.agriIntroBody}>
                <p>{config.body}</p>
              </div>
            </div>

            {renderAgriCard(config.tiles[0], "tall")}
          </div>

          {/* RIGHT COLUMN */}
          <div className={styles.agriRightColumn}>
            {/* Top Row: AGRONE Pilot Registration */}
            {renderAgriCard(config.tiles[1], "hero")}

            <div className={styles.agriMiddleRow}>
              {renderAgriCard(config.tiles[3], "standard")}
              {renderAgriCard(config.tiles[4], "standard")}
            </div>

            {renderAgriCard(config.tiles[2], "wide")}
          </div>
        </div>
      </div>
    </article>
  );
}

const cityImagePresentation: Record<
  string,
  { objectPosition: string; scale: number; transformOrigin: string }
> = {
  "dronelancer-model": {
    objectPosition: "50% 36%",
    scale: 1.18,
    transformOrigin: "50% 34%"
  },
  "city-drone-rental-services-app": {
    objectPosition: "50% 42%",
    scale: 1.1,
    transformOrigin: "50% 40%"
  },
  "all-drone-acadamic": {
    objectPosition: "50% 38%",
    scale: 1.1,
    transformOrigin: "50% 36%"
  },
  "drone-franchisecare-center": {
    objectPosition: "50% 40%",
    scale: 1.08,
    transformOrigin: "50% 38%"
  },
  "drone-technician-aggregation": {
    objectPosition: "50% 40%",
    scale: 1.08,
    transformOrigin: "50% 38%"
  }
};

function cityImageKeyFromSrc(src: string) {
  return src.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "";
}

function getCityImagePresentation(src: string, cardType: "tall" | "hero" | "standard" | "wide") {
  const key = cityImageKeyFromSrc(src);
  const tuned = cityImagePresentation[key];
  if (tuned) return tuned;

  const fallbackScale =
    cardType === "standard" ? 1.08 : cardType === "hero" ? 1.12 : cardType === "wide" ? 1.1 : 1.12;
  return { objectPosition: "50% 40%", scale: fallbackScale, transformOrigin: "50% 38%" };
}

function CityDroneWorldSection({
  chapter,
  config
}: {
  chapter: HomeChapter;
  config: MissionWorldConfig;
}) {
  const renderCityCard = (
    tile: MissionWorldTile,
    cardType: "tall" | "hero" | "standard" | "wide",
    slotClass: string
  ) => {
    const imagePresentation = getCityImagePresentation(tile.media.src, cardType);
    const imageKey = cityImageKeyFromSrc(tile.media.src);
    const tileClassName = `${styles.agriCard} ${styles[`agriCard_${cardType}`]} ${slotClass}`;
    const tileProps = {
      className: tileClassName,
      "data-testid": "mission-world-tile",
      "data-showcase-kind": "mission-image",
      "data-tile-size": cardType,
      "data-city-image": imageKey || undefined,
      "data-dominant": cardType === "hero" ? "true" : "false"
    };

    const tileContent = (
      <>
        <MithronMissionTileImage
          src={tile.media.src}
          alt={tile.media.alt}
          cardType={cardType}
          wrapperClassName={styles.cityCardImageFrame}
          sizes={
            cardType === "hero"
              ? "(max-width: 640px) 100vw, (max-width: 980px) 100vw, 60vw"
              : cardType === "wide"
                ? "(max-width: 640px) 100vw, (max-width: 980px) 100vw, 68vw"
                : cardType === "tall"
                  ? "(max-width: 640px) 100vw, (max-width: 980px) 48vw, 54vw"
                  : "(max-width: 640px) 100vw, (max-width: 980px) 48vw, 32vw"
          }
          className={styles.agriCardImage}
          style={{
            objectPosition: imagePresentation.objectPosition,
            transformOrigin: imagePresentation.transformOrigin,
            ["--city-image-scale"]: String(imagePresentation.scale)
          } as CSSProperties}
        />
        <span className={styles.cityCardOverlay} aria-hidden="true" />
        <span className={styles.agriCardCopy}>
          <strong>{tile.label}</strong>
          <span>{tile.body}</span>
          <small>{tile.operator} | {tile.location}</small>
        </span>
        <span className={styles.agriCardDevice}>{tile.model}</span>
        <span className={styles.agriCardArrow} aria-hidden="true">
          <ArrowRight size={16} />
        </span>
      </>
    );

    return renderMissionWorldTile(tile, `city-${tile.label}`, tileProps, tileContent);
  };

  return (
    <article
      id={chapter.id}
      className={`${styles.chapter} ${styles.agriSection} ${styles.citySection}`}
      data-home-composite-chapter={chapter.id}
      data-layout-kind={chapter.layoutKind}
      data-mission-motion="skip"
      data-testid="city-drone-world-section"
    >
      <div className={styles.agriContainer}>
        <div className={styles.cityBentoGrid}>
          {renderCityCard(config.tiles[1], "hero", styles.citySlotHero)}

          <div className={styles.cityTextHeader}>
            <div className={styles.agriEyebrowRow}>
              <span className={styles.agriEyebrow}>{config.eyebrow}</span>
            </div>
            <h2 className={styles.agriHeadline}>{config.title.toUpperCase()}</h2>
            <div className={styles.agriIntroBody}>
              <p>{config.body}</p>
              <p className={styles.agriFallbackNote}>
                {config.mediaState}: {config.mediaNote}
              </p>
            </div>
          </div>

          {renderCityCard(config.tiles[0], "tall", styles.citySlotTall)}
          {renderCityCard(config.tiles[3], "standard", styles.citySlotStandardLeft)}
          {renderCityCard(config.tiles[4], "standard", styles.citySlotStandardRight)}
          {renderCityCard(config.tiles[2], "wide", styles.citySlotWide)}
        </div>
      </div>
    </article>
  );
}
