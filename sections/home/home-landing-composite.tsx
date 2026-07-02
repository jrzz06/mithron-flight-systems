import Link from "next/link";
import { EditorRenderedContent } from "@/components/editor/editor-rendered-content";
import { editorHtmlToPlainText } from "@/lib/editor/prepare-html";
import { type CSSProperties, type ReactNode } from "react";
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
  isGlobalProductsCategory
} from "@/lib/product-shelf-classification";
import { pickHomeMiniCarouselItems } from "@/lib/home/mini-carousel";
import { getHomepageShelfCatalogHref } from "@/lib/catalog-categories";
import { formatINR } from "@/lib/utils";
import type { ProductReviewContent } from "@/config/storefront-content";
import { HomeCompositeSection } from "@/sections/home/home-composite-section";
import { HomeMiniCarousel } from "@/sections/home/home-mini-carousel";
import { ProductShelfScrollRail } from "@/sections/home/product-shelf-scroll-rail";
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
  heroEyebrow: string;
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
    href: getHomepageShelfCatalogHref("drone-world"),
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
    href: getHomepageShelfCatalogHref("drone-care"),
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
    href: getHomepageShelfCatalogHref("global-products"),
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
    body: "Register, book, and finance drones across India's AGRONE network.",
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
    body: "Urban platforms for rentals, training, care, and technician support.",
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
    href: getHomepageShelfCatalogHref("drone-world"),
    viewAllLabel: "View All",
    productFilter: chapters[0].productFilter,
    featurePriority: ["drone", "uav", "kisan", "sprayer", "seed spreader"],
    featureExclude: ["controller", "flight controller", "propeller", "battery", "cable", "connector", "sensor", "motor", "frame", "hpc"],
    testId: "drone-world-shelf",
    guideLabel: "Buying Guides",
    guideTitle: "Which Drone Fits Your Mission?",
    guideHref: getHomepageShelfCatalogHref("drone-world"),
    heroEyebrow: "Featured Collection",
    heroSubtitle: "",
    heroBody: "Aircraft and mission-ready systems from the published catalog.",
    featureCta: "View catalog",
    heroCtaHref: getHomepageShelfCatalogHref("drone-world"),
    tone: "world"
  },
  "drone-care": {
    id: "drone-care",
    eyebrow: "Essential Care",
    title: "Drone Care",
    href: getHomepageShelfCatalogHref("drone-care"),
    viewAllLabel: "View All",
    productFilter: chapters[1].productFilter,
    featurePriority: ["battery", "propeller", "controller", "gimbal", "filter", "care", "spare"],
    featureExclude: [],
    testId: "drone-care-shelf",
    guideLabel: "Care Guides",
    guideTitle: "Build a Reliable Spares Kit",
    guideHref: getHomepageShelfCatalogHref("drone-care"),
    heroEyebrow: "Essential Care",
    heroSubtitle: "",
    heroBody: "Batteries, propellers, controllers, and spares for your fleet.",
    featureCta: "Shop care",
    heroCtaHref: getHomepageShelfCatalogHref("drone-care"),
    tone: "care"
  },
  "global-products": {
    id: "global-products",
    eyebrow: "Global Selection",
    title: "Global Product",
    href: getHomepageShelfCatalogHref("global-products"),
    viewAllLabel: "View All",
    productFilter: chapters[2].productFilter,
    featurePriority: ["drone", "survey", "surveillance", "mapping", "industrial", "system"],
    featureExclude: ["cable", "connector", "propeller", "battery", "motor", "frame"],
    testId: "global-products-shelf",
    guideLabel: "Catalog Guides",
    guideTitle: "Compare Mission Systems",
    guideHref: getHomepageShelfCatalogHref("global-products"),
    heroEyebrow: "Global Selection",
    heroSubtitle: "",
    heroBody: "Specialist platforms for teams sourcing across regions.",
    featureCta: "Browse global",
    heroCtaHref: getHomepageShelfCatalogHref("global-products"),
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
    body: "Register, book, and finance drones across India's AGRONE network.",
    testId: "agri-community-world",
    composition: "agri-field",
    mediaState: "VERIFIED",
    mediaNote: "",
    tiles: [
      {
        label: "Drone Owner Registration",
        body: "Register your drone on the AGRONE network.",
        href: AGRONE_REGISTRATION_LINKS.droneOwner,
        media: localMedia.agroneDroneOwnerRegistration,
        operator: "AGRONE Network",
        model: "DRONE OWNER NETWORK",
        location: "Pan-India",
        size: "tall"
      },
      {
        label: "Pilot Registration",
        body: "Join certified pilots and receive AGRONE missions.",
        href: AGRONE_REGISTRATION_LINKS.pilot,
        media: localMedia.agronePilotRegistration,
        operator: "AGRONE Network",
        model: "AGRONE PILOT NETWORK",
        location: "Pilot network",
        size: "hero"
      },
      {
        label: "Farmer Drone Booking",
        body: "Book spraying and crop monitoring across India.",
        media: localMedia.agroneFarmerDroneBooking,
        operator: "AGRONE Network",
        model: "NATIONWIDE BOOKING",
        location: "Booking desk",
        size: "tall"
      },
      {
        label: "Smart Farmer Registration",
        body: "Access AGRONE services and on-demand drone support.",
        href: AGRONE_REGISTRATION_LINKS.smartFarmer,
        media: localMedia.agroneSmartFarmerRegistration,
        operator: "AGRONE Network",
        model: "SMART FARMER PROGRAM",
        location: "Farmer network",
        size: "wide"
      },
      {
        label: "Drone Loan and EMI",
        body: "Check eligibility and compare financing plans.",
        media: localMedia.agroneAgriDroneLoanEmi,
        operator: "AGRONE Network",
        model: "FINANCING SUPPORT",
        location: "Loan check",
        size: "standard"
      }
    ]
  },
  "city-drones": {
    id: "city-drones",
    eyebrow: "Solutions for Future Cities",
    title: "City Drone World",
    body: "Urban platforms for rentals, training, care, and technician support.",
    testId: "city-drone-world",
    composition: "city-urban",
    mediaState: "VERIFIED",
    mediaNote: "",
    tiles: [
      {
        label: "Dronelancer Model",
        body: "Pilot marketplace for on-demand city jobs.",
        media: localMedia.cityTrafficAnalytics,
        operator: "Mithron City Network",
        model: "DRONELANCER MODEL",
        location: "Pilot grid",
        size: "tall"
      },
      {
        label: "Drone Rental App",
        body: "Book rentals and track project earnings.",
        media: localMedia.citySmartMonitoring,
        operator: "Mithron City Network",
        model: "RENTAL SERVICES APP",
        location: "Booking console",
        size: "hero"
      },
      {
        label: "Drone Academic",
        body: "Pilot training and certified urban flight programs.",
        media: localMedia.cityEmergencyResponse,
        operator: "Mithron Academy Network",
        model: "ALL DRONE ACADEMIC",
        location: "Training hub",
        size: "tall"
      },
      {
        label: "FranchiseCare Center",
        body: "Local repair, spares, and maintenance support.",
        media: localMedia.cityInfrastructureInspection,
        operator: "Mithron Service Network",
        model: "FRANCHISECARE CENTER",
        location: "Care workshop",
        size: "standard"
      },
      {
        label: "Technician Network",
        body: "Field diagnostics and maintenance coordination.",
        media: localMedia.cityCrowdMonitoring,
        operator: "Mithron Service Network",
        model: "TECHNICIAN AGGREGATION",
        location: "Field network",
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
  const label = product.badge?.trim() || "";
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

function formatShelfProductName(name: string): string {
  const tokens = name.match(/\[[^\]]+\]|\S+/g);
  if (!tokens) {
    return name;
  }

  return tokens
    .map((token) => {
      if (/^\[[^\]]+\]$/.test(token)) {
        return token;
      }

      if (/^\d+K$/i.test(token) || /^\d+KG$/i.test(token)) {
        return token.toUpperCase();
      }

      if (/^[A-Z0-9]{2,}$/.test(token) && token === token.toUpperCase()) {
        return token;
      }

      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ");
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
  const shelfProducts = pickShelfProducts(products, config);
  const cardProducts = shelfProducts.slice(0, 4);
  const guideUsesOptionA = config.tone === "world" || config.tone === "care";
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
            <ProductShelfScrollRail
              className={styles.productShelfGrid}
              data-testid="home-product-shelf-grid"
              data-shelf-layout={guideUsesOptionA ? "option-a" : "standard"}
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
                        {/* Product thumbnail is decorative because the adjacent link text names the product. */}
                        <MithronCardImage
                          src={product.image.src}
                          alt=""
                          aria-hidden={true}
                          fill
                          priority={productIndex === 0}
                          responsive={product.image.responsive}
                          sizes="(max-width: 767px) 48vw, (max-width: 1024px) 36vw, 270px"
                          className={styles.productImage}
                        />
                      </div>
                      <div className={styles.productBody}>
                        {meta.label || meta.detail ? (
                          <p className={styles.productKicker}>
                            {meta.label ? <span>{meta.label}</span> : null}
                            {meta.label && meta.detail ? " · " : null}
                            {meta.detail ? <span>{meta.detail}</span> : null}
                          </p>
                        ) : null}
                        <h3 className={styles.productName}>{formatShelfProductName(product.name)}</h3>
                        <div className={styles.productFooter}>
                          <span>{formatINR(product.price)}</span>
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
                data-shelf-tone={config.tone}
                data-testid="home-product-guide-card"
              >
                <div className={styles.guideCopy}>
                  <div className={styles.guideCopyTop}>
                    <span className={styles.guideLabel}>{config.guideLabel}</span>
                    <strong>{config.guideTitle}</strong>
                  </div>
                  <span className={styles.guideArrow} aria-hidden="true">
                    <ArrowRight size={14} />
                  </span>
                </div>
                {guideMedia ? (
                  <div className={styles.guideImageWell} aria-hidden>
                    <MithronCardImage
                      src={guideMedia.src}
                      alt=""
                      aria-hidden={true}
                      fill
                      responsive={guideMedia.responsive}
                      sizes="(max-width: 640px) 72vw, 280px"
                      className={styles.guideImage}
                    />
                  </div>
                ) : null}
              </Link>
            </ProductShelfScrollRail>
          ) : null}

          <a
            href={config.heroCtaHref}
            className={styles.productShelfHero}
            data-testid="home-product-shelf-hero"
            data-navbar-ink={shelfNavbarInk(config.tone)}
            {...(/^https?:\/\//i.test(config.heroCtaHref)
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
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
              {(config.heroEyebrow || config.eyebrow) ? (
                <span className={styles.shelfHeroEyebrow}>{config.heroEyebrow || config.eyebrow}</span>
              ) : null}
              <span className={styles.shelfHeroHeading}>{config.title}</span>
              {config.heroBody ? (
                <EditorRenderedContent html={config.heroBody} className={styles.shelfHeroBody} />
              ) : null}
              {config.featureCta ? (
                <span className={styles.shelfHeroCta}>{config.featureCta}</span>
              ) : null}
            </span>
          </a>
        </div>
      </div>
    </article>
  );
}

function shelfNavbarInk(tone: ProductShelfConfig["tone"]): "light" | "dark" {
  if (tone === "world" || tone === "global") return "light";
  return "dark";
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
      <blockquote className={styles.testimonialQuote}>
        <EditorRenderedContent html={item.body} />
      </blockquote>
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
  const representativeReviews = pickRepresentativeHomeReviews(products);
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
          <EditorRenderedContent html={about.body} className={styles.aboutBody} />
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
  const strictWithoutCms = isCmsStrictMode() && !homepageCms;
  const cms = homepageCms ?? defaultHomepageCmsContent;
  const shelfConfigs = {
    "drone-world": {
      ...productShelfConfigs["drone-world"],
      eyebrow: cms.shelves.droneWorld.eyebrow,
      title: cms.shelves.droneWorld.title,
      href: getHomepageShelfCatalogHref("drone-world"),
      viewAllLabel: cms.shelves.droneWorld.viewAllLabel,
      guideLabel: cms.shelves.droneWorld.guideLabel,
      guideTitle: cms.shelves.droneWorld.guideTitle,
      guideHref: getHomepageShelfCatalogHref("drone-world"),
      heroEyebrow: cms.shelves.droneWorld.heroEyebrow,
      heroSubtitle: cms.shelves.droneWorld.heroSubtitle,
      heroBody: cms.shelves.droneWorld.heroBody,
      featureCta: cms.shelves.droneWorld.featureCta,
      heroCtaHref: getHomepageShelfCatalogHref("drone-world")
    },
    "drone-care": {
      ...productShelfConfigs["drone-care"],
      eyebrow: cms.shelves.droneCare.eyebrow,
      title: cms.shelves.droneCare.title,
      href: getHomepageShelfCatalogHref("drone-care"),
      viewAllLabel: cms.shelves.droneCare.viewAllLabel,
      guideLabel: cms.shelves.droneCare.guideLabel,
      guideTitle: cms.shelves.droneCare.guideTitle,
      guideHref: getHomepageShelfCatalogHref("drone-care"),
      heroEyebrow: cms.shelves.droneCare.heroEyebrow,
      heroSubtitle: cms.shelves.droneCare.heroSubtitle,
      heroBody: cms.shelves.droneCare.heroBody,
      featureCta: cms.shelves.droneCare.featureCta,
      heroCtaHref: getHomepageShelfCatalogHref("drone-care")
    },
    "global-products": {
      ...productShelfConfigs["global-products"],
      eyebrow: cms.shelves.globalProducts.eyebrow,
      title: cms.shelves.globalProducts.title,
      href: getHomepageShelfCatalogHref("global-products"),
      viewAllLabel: cms.shelves.globalProducts.viewAllLabel,
      guideLabel: cms.shelves.globalProducts.guideLabel,
      guideTitle: cms.shelves.globalProducts.guideTitle,
      guideHref: getHomepageShelfCatalogHref("global-products"),
      heroEyebrow: cms.shelves.globalProducts.heroEyebrow,
      heroSubtitle: cms.shelves.globalProducts.heroSubtitle,
      heroBody: cms.shelves.globalProducts.heroBody,
      featureCta: cms.shelves.globalProducts.featureCta,
      heroCtaHref: getHomepageShelfCatalogHref("global-products")
    }
  };
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
  const missionConfigs = {
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
  const landingChapters = chapters.map((chapter) => {
    if (chapter.id === "drone-world") {
      return {
        ...chapter,
        href: getHomepageShelfCatalogHref("drone-world"),
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
        href: getHomepageShelfCatalogHref("drone-care"),
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
        href: getHomepageShelfCatalogHref("global-products"),
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
  });
  const miniCarouselItems = pickHomeMiniCarouselItems(products);
  const displayedProductReviews = pickHomeProductReviews(productReviews, products);
  const resolvedFooter = footer ?? (isCmsStrictMode() ? null : footerContent);

  if (strictWithoutCms) {
    return null;
  }

  return (
    <HomeCompositeSection>
      <HomeMiniCarousel items={miniCarouselItems} />

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
    </HomeCompositeSection>
  );
}

function formatMissionHeadline(title: string) {
  return title.trim().replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

type MissionLightPoint = { x: string; y: string };

type MissionLightZones = {
  zone1: MissionLightPoint;
  zone2: MissionLightPoint;
  zone3: MissionLightPoint;
  zone4: MissionLightPoint;
};

type MissionZoneColors = {
  zone1: string;
  zone2: string;
  zone3: string;
  zone4: string;
};

type MissionImagePresentation = {
  objectPosition: string;
  scale: number;
  transformOrigin: string;
  zones: MissionLightZones;
  zoneColors: MissionZoneColors;
};

const defaultAgriZones: MissionLightZones = {
  zone1: { x: "52%", y: "40%" },
  zone2: { x: "22%", y: "62%" },
  zone3: { x: "74%", y: "42%" },
  zone4: { x: "90%", y: "8%" }
};

const defaultAgriZoneColors: MissionZoneColors = {
  zone1: "42, 195, 135",
  zone2: "118, 195, 155",
  zone3: "210, 225, 95",
  zone4: "255, 215, 145"
};

const defaultCityZones: MissionLightZones = {
  zone1: { x: "50%", y: "36%" },
  zone2: { x: "24%", y: "54%" },
  zone3: { x: "72%", y: "22%" },
  zone4: { x: "90%", y: "8%" }
};

const defaultCityZoneColors: MissionZoneColors = {
  zone1: "55, 145, 245",
  zone2: "110, 195, 255",
  zone3: "215, 242, 255",
  zone4: "130, 225, 248"
};

function missionLightZoneStyle(zones: MissionLightZones, zoneColors: MissionZoneColors): CSSProperties {
  return {
    "--zone-1-x": zones.zone1.x,
    "--zone-1-y": zones.zone1.y,
    "--zone-2-x": zones.zone2.x,
    "--zone-2-y": zones.zone2.y,
    "--zone-3-x": zones.zone3.x,
    "--zone-3-y": zones.zone3.y,
    "--zone-4-x": zones.zone4.x,
    "--zone-4-y": zones.zone4.y,
    "--zone-1-color": zoneColors.zone1,
    "--zone-2-color": zoneColors.zone2,
    "--zone-3-color": zoneColors.zone3,
    "--zone-4-color": zoneColors.zone4
  } as CSSProperties;
}

type MissionStoryTheme = {
  id: string;
  scrim: "cream" | "cool" | "warm";
  zoneColors: MissionZoneColors;
};

const MISSION_STORY_THEMES: Record<string, MissionStoryTheme> = {
  "agrone-pilot-registration": {
    id: "pilot",
    scrim: "cream",
    zoneColors: {
      zone1: "118, 220, 196",
      zone2: "72, 188, 220",
      zone3: "186, 242, 232",
      zone4: "148, 214, 204"
    }
  },
  "agrone-drone-owner-registration": {
    id: "owner",
    scrim: "cool",
    zoneColors: {
      zone1: "72, 148, 220",
      zone2: "118, 210, 188",
      zone3: "168, 206, 238",
      zone4: "132, 188, 210"
    }
  },
  "all-india-drone-farmer": {
    id: "booking",
    scrim: "cool",
    zoneColors: {
      zone1: "88, 156, 228",
      zone2: "168, 148, 228",
      zone3: "196, 188, 242",
      zone4: "142, 178, 232"
    }
  },
  "smart-farmer-register": {
    id: "farmer",
    scrim: "cream",
    zoneColors: {
      zone1: "108, 198, 148",
      zone2: "186, 220, 168",
      zone3: "228, 238, 210",
      zone4: "168, 210, 178"
    }
  },
  "agri-drone-loan": {
    id: "finance",
    scrim: "warm",
    zoneColors: {
      zone1: "228, 196, 128",
      zone2: "242, 224, 186",
      zone3: "248, 236, 210",
      zone4: "220, 188, 132"
    }
  },
  "dronelancer-model": {
    id: "network",
    scrim: "cool",
    zoneColors: {
      zone1: "108, 168, 228",
      zone2: "196, 206, 218",
      zone3: "168, 198, 238",
      zone4: "148, 178, 212"
    }
  },
  "city-drone-rental-services-app": {
    id: "rental",
    scrim: "cool",
    zoneColors: {
      zone1: "96, 210, 232",
      zone2: "228, 242, 248",
      zone3: "148, 218, 238",
      zone4: "186, 232, 244"
    }
  },
  "all-drone-acadamic": {
    id: "academy",
    scrim: "cool",
    zoneColors: {
      zone1: "148, 128, 228",
      zone2: "88, 156, 228",
      zone3: "186, 178, 242",
      zone4: "128, 148, 218"
    }
  },
  "drone-franchisecare-center": {
    id: "care",
    scrim: "cream",
    zoneColors: {
      zone1: "108, 198, 210",
      zone2: "228, 242, 246",
      zone3: "148, 210, 220",
      zone4: "186, 224, 232"
    }
  },
  "drone-technician-aggregation": {
    id: "technician",
    scrim: "cool",
    zoneColors: {
      zone1: "196, 206, 218",
      zone2: "88, 156, 220",
      zone3: "168, 188, 212",
      zone4: "148, 178, 228"
    }
  }
};

const FALLBACK_AGRI_STORY: MissionStoryTheme = {
  id: "agri",
  scrim: "cream",
  zoneColors: defaultAgriZoneColors
};

const FALLBACK_CITY_STORY: MissionStoryTheme = {
  id: "city",
  scrim: "cool",
  zoneColors: defaultCityZoneColors
};

function missionImageKeyFromSrc(src: string) {
  return src.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "";
}

function getMissionStoryTheme(src: string, variant: "agri" | "city") {
  const key = missionImageKeyFromSrc(src);
  return MISSION_STORY_THEMES[key] ?? (variant === "city" ? FALLBACK_CITY_STORY : FALLBACK_AGRI_STORY);
}

function missionCardStyle({
  imagePresentation,
  storyTheme,
  variant
}: {
  imagePresentation: MissionImagePresentation;
  storyTheme: MissionStoryTheme;
  variant: "agri" | "city";
}): CSSProperties {
  const scaleVar =
    variant === "city"
      ? ({ ["--city-image-scale"]: String(imagePresentation.scale) } as CSSProperties)
      : ({ ["--agri-image-scale"]: String(imagePresentation.scale) } as CSSProperties);

  return {
    "--agri-object-position": imagePresentation.objectPosition,
    ...scaleVar,
    ...missionLightZoneStyle(imagePresentation.zones, storyTheme.zoneColors)
  } as CSSProperties;
}

const agriImagePresentation: Record<string, MissionImagePresentation> = {
  "agrone-drone-owner-registration": {
    objectPosition: "50% 42%",
    scale: 1.02,
    transformOrigin: "center center",
    zones: {
      zone1: { x: "50%", y: "38%" },
      zone2: { x: "22%", y: "58%" },
      zone3: { x: "76%", y: "46%" },
      zone4: { x: "90%", y: "8%" }
    },
    zoneColors: {
      zone1: "38, 188, 128",
      zone2: "108, 188, 148",
      zone3: "205, 220, 88",
      zone4: "255, 210, 138"
    }
  },
  "agrone-pilot-registration": {
    objectPosition: "54% 40%",
    scale: 1.03,
    transformOrigin: "center center",
    zones: {
      zone1: { x: "58%", y: "42%" },
      zone2: { x: "32%", y: "55%" },
      zone3: { x: "72%", y: "22%" },
      zone4: { x: "92%", y: "6%" }
    },
    zoneColors: {
      zone1: "32, 178, 118",
      zone2: "98, 188, 158",
      zone3: "195, 228, 88",
      zone4: "255, 205, 128"
    }
  },
  "all-india-drone-farmer": {
    objectPosition: "52% 44%",
    scale: 1.02,
    transformOrigin: "center center",
    zones: {
      zone1: { x: "56%", y: "40%" },
      zone2: { x: "16%", y: "64%" },
      zone3: { x: "76%", y: "52%" },
      zone4: { x: "88%", y: "10%" }
    },
    zoneColors: {
      zone1: "48, 195, 108",
      zone2: "128, 198, 138",
      zone3: "235, 205, 88",
      zone4: "255, 215, 148"
    }
  },
  "smart-farmer-register": {
    objectPosition: "50% 42%",
    scale: 1.0,
    transformOrigin: "center center",
    zones: {
      zone1: { x: "50%", y: "42%" },
      zone2: { x: "24%", y: "62%" },
      zone3: { x: "72%", y: "32%" },
      zone4: { x: "92%", y: "10%" }
    },
    zoneColors: {
      zone1: "58, 185, 98",
      zone2: "138, 205, 128",
      zone3: "225, 210, 78",
      zone4: "255, 212, 132"
    }
  },
  "agri-drone-loan": {
    objectPosition: "48% 40%",
    scale: 1.0,
    transformOrigin: "center center",
    zones: {
      zone1: { x: "42%", y: "38%" },
      zone2: { x: "68%", y: "50%" },
      zone3: { x: "55%", y: "28%" },
      zone4: { x: "90%", y: "10%" }
    },
    zoneColors: {
      zone1: "38, 175, 128",
      zone2: "98, 175, 205",
      zone3: "148, 215, 148",
      zone4: "255, 208, 128"
    }
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
    cardType === "standard" ? 1.02 : cardType === "hero" ? 1.04 : cardType === "wide" ? 1.03 : 1.03;
  return {
    objectPosition: "50% 40%",
    scale: fallbackScale,
    transformOrigin: "center center",
    zones: defaultAgriZones,
    zoneColors: defaultAgriZoneColors
  };
}

function MissionWorldCardContent({
  tile,
  cardType,
  imagePresentation,
  sizes,
  variant,
  logoCover
}: {
  tile: MissionWorldTile;
  cardType: "tall" | "hero" | "standard" | "wide";
  imagePresentation: MissionImagePresentation;
  sizes: string;
  variant: "agri" | "city";
  logoCover?: boolean;
}) {
  const isCity = variant === "city";
  const imageFrameClass = isCity ? styles.cityCardImageFrame : styles.agriCardImageFrame;
  const textProtectionClass = isCity ? styles.cityCardTextProtection : styles.agriCardTextProtection;

  return (
    <>
      <div className={styles.missionCardImageStage}>
        <MithronMissionTileImage
          src={tile.media.src}
          alt={tile.media.alt || tile.label}
          cardType={cardType}
          wrapperClassName={imageFrameClass}
          sizes={sizes}
          className={styles.agriCardImage}
          style={{
            objectPosition: imagePresentation.objectPosition,
            transformOrigin: imagePresentation.transformOrigin
          }}
        />
        {logoCover ? <span className={styles.missionCardBrandShield} aria-hidden="true" /> : null}
      </div>
      <span
        className={`${styles.agriCardAmbient} ${cardType === "hero" ? styles.agriCardAmbientDominant : ""}`}
        aria-hidden="true"
      >
        <span className={`${styles.agriCardAmbientLayer} ${styles.agriCardAmbientBeam}`} />
        <span className={`${styles.agriCardAmbientLayer} ${styles.agriCardAmbientWash}`} />
        <span className={`${styles.agriCardAmbientLayer} ${styles.agriCardAmbientAccent}`} />
      </span>
      <div className={styles.missionCardFloat}>
        <div className={styles.missionCardCopyRow}>
          <span className={styles.agriCardCopy}>
            <span className={textProtectionClass} aria-hidden="true" />
            <strong>{tile.label}</strong>
            <EditorRenderedContent html={tile.body} className={styles.missionTileBody} />
          </span>
          <span className={styles.agriCardArrow} aria-hidden="true">
            <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </>
  );
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
      aria-label={`${tile.label}. ${editorHtmlToPlainText(tile.body)}`}
      key={tileKey}
      {...tileProps}
    >
      {tileContent}
    </Link>
  );
}

function missionWorldImageSizes(cardType: "tall" | "hero" | "standard" | "wide") {
  switch (cardType) {
    case "hero":
      return "(max-width: 640px) 100vw, (max-width: 980px) 100vw, 65vw";
    case "wide":
      return "(max-width: 640px) 100vw, (max-width: 980px) 100vw, 68vw";
    case "tall":
      return "(max-width: 640px) 100vw, (max-width: 980px) 48vw, 35vw";
    default:
      return "(max-width: 640px) 100vw, (max-width: 980px) 48vw, 21vw";
  }
}

function MissionWorldBentoSection({
  chapter,
  config,
  variant,
  sectionClassName,
  testId,
  headline,
  eyebrowAccessory,
  introFooter
}: {
  chapter: HomeChapter;
  config: MissionWorldConfig;
  variant: "agri" | "city";
  sectionClassName: string;
  testId: string;
  headline: string;
  eyebrowAccessory?: ReactNode;
  introFooter?: ReactNode;
}) {
  const renderMissionCard = (
    tile: MissionWorldTile,
    cardType: "tall" | "hero" | "standard" | "wide"
  ) => {
    const imagePresentation =
      variant === "city"
        ? getCityImagePresentation(tile.media.src, cardType)
        : getAgriImagePresentation(tile.media.src, cardType);
    const imageKey =
      variant === "city" ? cityImageKeyFromSrc(tile.media.src) : agriImageKeyFromSrc(tile.media.src);
    const storyTheme = getMissionStoryTheme(tile.media.src, variant);
    const tileClassName = `${styles.agriCard} ${styles[`agriCard_${cardType}`]}`;
    const tileProps = {
      className: tileClassName,
      "data-testid": "mission-world-tile",
      "data-showcase-kind": "mission-image",
      "data-tile-size": cardType,
      ...(variant === "agri" ? { "data-agri-image": imageKey || undefined } : {}),
      ...(variant === "city" ? { "data-city-image": imageKey || undefined } : {}),
      "data-mission-story": storyTheme.id,
      "data-scrim": storyTheme.scrim,
      "data-dominant": cardType === "hero" ? "true" : "false",
      ...(variant === "city" && imageKey === "city-drone-rental-services-app"
        ? { "data-logo-cover": "true" as const }
        : {}),
      style: missionCardStyle({ imagePresentation, storyTheme, variant })
    };

    const tileContent = (
      <MissionWorldCardContent
        tile={tile}
        cardType={cardType}
        imagePresentation={imagePresentation}
        variant={variant}
        logoCover={variant === "city" && imageKey === "city-drone-rental-services-app"}
        sizes={missionWorldImageSizes(cardType)}
      />
    );

    return renderMissionWorldTile(tile, `${variant}-${tile.label}`, tileProps, tileContent);
  };

  return (
    <article
      id={chapter.id}
      className={`${styles.chapter} ${styles.agriSection} ${sectionClassName}`.trim()}
      data-home-composite-chapter={chapter.id}
      data-layout-kind={chapter.layoutKind}
      data-mission-motion="skip"
      data-testid={testId}
    >
      <div className={styles.agriContainer}>
        <div className={styles.missionWorldShowcaseStage}>
          <span className={styles.missionWorldShowcaseAtmosphere} aria-hidden="true" />
          <div className={styles.missionWorldBento}>
            <div className={styles.missionWorldLeftRail}>
              <div className={styles.missionWorldTextHeader}>
                <div className={styles.agriEyebrowRow}>
                  <span className={styles.agriEyebrow}>{config.eyebrow}</span>
                  {eyebrowAccessory}
                </div>
                <h2 className={styles.agriHeadline}>{headline}</h2>
                <div className={styles.agriIntroBody}>
                  <EditorRenderedContent html={config.body} className={styles.agriIntroPlainText} />
                  {introFooter}
                </div>
              </div>
              <div className={styles.missionWorldSlotTall}>{renderMissionCard(config.tiles[0], "tall")}</div>
            </div>
            <div className={styles.missionWorldRightRail}>
              <div className={styles.missionWorldSlotHero}>{renderMissionCard(config.tiles[1], "hero")}</div>
              <div className={styles.missionWorldSupportGrid}>
                {renderMissionCard(config.tiles[3], "standard")}
                {renderMissionCard(config.tiles[4], "standard")}
                {renderMissionCard(config.tiles[2], "standard")}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function AgriCommunityWorldSection({
  chapter,
  config
}: {
  chapter: HomeChapter;
  config: MissionWorldConfig;
}) {
  return (
    <MissionWorldBentoSection
      chapter={chapter}
      config={config}
      variant="agri"
      sectionClassName=""
      testId="agri-community-world-section"
      headline={formatMissionHeadline(config.title)}
      eyebrowAccessory={
        <svg className={styles.agriLeafIcon} viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
          <path d="M17 8C8 10 4 19 4 19S13 15 20 6C20 6 18.5 5.5 17 8Z" />
          <path
            d="M18.8284 3.17157C17.6569 2 15 2 13 4C11 6 6 13 4 15V20H9C11 18 18 13 20 11C22 9 22 6.34315 20.8284 5.17157L18.8284 3.17157Z"
            fill="currentColor"
          />
        </svg>
      }
    />
  );
}

const cityImagePresentation: Record<string, MissionImagePresentation> = {
  "dronelancer-model": {
    objectPosition: "48% 40%",
    scale: 1.02,
    transformOrigin: "center center",
    zones: {
      zone1: { x: "52%", y: "34%" },
      zone2: { x: "24%", y: "56%" },
      zone3: { x: "70%", y: "20%" },
      zone4: { x: "90%", y: "8%" }
    },
    zoneColors: {
      zone1: "48, 138, 238",
      zone2: "98, 188, 255",
      zone3: "220, 245, 255",
      zone4: "118, 225, 248"
    }
  },
  "city-drone-rental-services-app": {
    objectPosition: "46% 40%",
    scale: 1.0,
    transformOrigin: "center center",
    zones: {
      zone1: { x: "48%", y: "40%" },
      zone2: { x: "22%", y: "56%" },
      zone3: { x: "72%", y: "24%" },
      zone4: { x: "92%", y: "10%" }
    },
    zoneColors: {
      zone1: "42, 148, 235",
      zone2: "108, 198, 255",
      zone3: "235, 250, 255",
      zone4: "125, 228, 248"
    }
  },
  "all-drone-acadamic": {
    objectPosition: "50% 40%",
    scale: 1.02,
    transformOrigin: "center center",
    zones: {
      zone1: { x: "50%", y: "36%" },
      zone2: { x: "28%", y: "58%" },
      zone3: { x: "74%", y: "22%" },
      zone4: { x: "90%", y: "8%" }
    },
    zoneColors: {
      zone1: "58, 128, 235",
      zone2: "118, 168, 255",
      zone3: "215, 240, 255",
      zone4: "128, 225, 248"
    }
  },
  "drone-franchisecare-center": {
    objectPosition: "50% 38%",
    scale: 1.0,
    transformOrigin: "center center",
    zones: {
      zone1: { x: "52%", y: "38%" },
      zone2: { x: "24%", y: "60%" },
      zone3: { x: "70%", y: "26%" },
      zone4: { x: "92%", y: "8%" }
    },
    zoneColors: {
      zone1: "68, 128, 215",
      zone2: "128, 168, 245",
      zone3: "230, 248, 255",
      zone4: "138, 228, 252"
    }
  },
  "drone-technician-aggregation": {
    objectPosition: "50% 42%",
    scale: 1.0,
    transformOrigin: "center center",
    zones: {
      zone1: { x: "50%", y: "38%" },
      zone2: { x: "22%", y: "58%" },
      zone3: { x: "72%", y: "24%" },
      zone4: { x: "90%", y: "8%" }
    },
    zoneColors: {
      zone1: "52, 148, 215",
      zone2: "108, 188, 255",
      zone3: "225, 248, 255",
      zone4: "125, 228, 248"
    }
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
    cardType === "standard" ? 1.02 : cardType === "hero" ? 1.04 : cardType === "wide" ? 1.03 : 1.03;
  return {
    objectPosition: "50% 42%",
    scale: fallbackScale,
    transformOrigin: "center center",
    zones: defaultCityZones,
    zoneColors: defaultCityZoneColors
  };
}

function CityDroneWorldSection({
  chapter,
  config
}: {
  chapter: HomeChapter;
  config: MissionWorldConfig;
}) {
  return (
    <MissionWorldBentoSection
      chapter={chapter}
      config={config}
      variant="city"
      sectionClassName={styles.citySection}
      testId="city-drone-world-section"
      headline={formatMissionHeadline(config.title)}
      introFooter={
        config.mediaNote ? (
          <p className={styles.agriFallbackNote}>
            {config.mediaState}: {config.mediaNote}
          </p>
        ) : null
      }
    />
  );
}
