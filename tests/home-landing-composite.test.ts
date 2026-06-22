import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const forbiddenStatusLabel = ["PAR", "TIAL"].join("");
const oldDraftCollectionName = ["draft", "Testimonials"].join("");

describe("home landing composite contract", () => {
  it("renders the current hero followed by exactly one composite post-hero section", () => {
    const page = source("app/(storefront)/page.tsx");

    expect(page).toContain("HeroCarousel");
    expect(page).toContain("HomeLandingComposite");
    expect(page).toContain("<HomeLandingComposite");
    expect(page).toContain("getHomepageProducts");
    expect(page).toContain("products={products}");
    expect(page).toContain("HomeLandingSkeleton");
    expect(page).toContain("productReviews={cms.productSupport.reviews}");
    expect(page).toContain("footer={cms.footer}");
    expect(page).toContain("homepageCms={homepageCms}");
    expect(page).not.toContain("HomeProductShelves");
    expect(page).not.toContain("homeShelves");
  });

  it("defines the requested chapter order and proof states without fake verified testimonials", () => {
    const component = source("sections/home/home-landing-composite.tsx");

    expect(component).toContain('data-testid="home-landing-composite"');
    expect(component).toContain('data-home-composite-root="true"');
    expect(component).toContain('data-motion-state="reduced"');
    expect(component).toContain('data-motion-engine="native-gsap-scrolltrigger"');
    expect(component).toContain('type ProofState = "VERIFIED" | "FALLBACK"');
    expect(component).not.toContain(forbiddenStatusLabel);
    expect(component).not.toContain(oldDraftCollectionName);
    expect(component).not.toContain('data-testimonial-state="fallback"');
    expect(component).not.toContain("verifiedTestimonialsFromCms");
    expect(component).not.toContain("VERIFIED CMS");
    expect(component).toContain("/media/mithron/dynamic-scroll/night-surveillance.webp");
    expect(component).toContain("Representative mission gallery");
    expect(component).toContain("No municipal deployment claims");
    expect(component).not.toMatch(/stars?:\s*[1-5]/i);
    expect(component).not.toMatch(/Rajan|Meera|James|customer says/i);

    const chapterBlock = component.slice(
      component.indexOf("const chapters: HomeChapter[]"),
      component.indexOf("const productShelfConfigs")
    );
    const order = [
      "drone-world",
      "drone-care",
      "global-products",
      "agri-drones",
      "city-drones"
    ];
    let cursor = -1;
    for (const id of order) {
      const next = chapterBlock.indexOf(`id: "${id}"`);
      expect(next, `${id} should appear after the previous chapter`).toBeGreaterThan(cursor);
      cursor = next;
    }

    for (const removedId of ["lineup-solutions", "draft-testimonials", "creative-three", "about-us"]) {
      expect(chapterBlock).not.toContain(`id: "${removedId}"`);
      expect(component).not.toContain(`case "${removedId}"`);
    }
  });

  it("uses reduced-motion guards, GSAP ScrollTrigger, and restrained product hover selectors", () => {
    const component = source("sections/home/home-landing-composite.tsx");
    const css = source("sections/home/home-landing-composite.module.css");

    expect(component).not.toContain('import gsap from "gsap"');
    expect(component).not.toContain('import { ScrollTrigger } from "gsap/ScrollTrigger"');
    expect(component).toContain('import("gsap")');
    expect(component).toContain('import("gsap/ScrollTrigger")');
    expect(component).toContain("gsap.registerPlugin(ScrollTrigger)");
    expect(component).toContain("useReducedMotionPreference");
    expect(component).toContain("if (reducedMotion)");
    expect(component).toContain("ScrollTrigger.create");
    expect(component).toContain("scrub: true");
    expect(component).toContain("[data-mission-text-reveal]");
    expect(component).toContain("[data-mission-image-reveal]");
    expect(component).toContain("[data-mission-caption-reveal]");
    expect(component).toContain("missionTextNodes");
    expect(component).toContain("missionTileNodes");
    expect(component).toContain("missionImageNodes");
    expect(component).toContain("clipPath");
    expect(component).toContain('toggleActions: "play none none reverse"');

    expect(css).toContain(".productCard:hover .productImage");
    expect(css).toContain("scale(1.024)");
    expect(css).not.toMatch(/glow|text-shadow|backdrop-filter:\s*blur\(20px\)|rotateX|rotateY/i);
  });

  it("uses product shelves followed by distinct mission-world editorial sections", () => {
    const component = source("sections/home/home-landing-composite.tsx");
    const css = source("sections/home/home-landing-composite.module.css");
    const chapterBlock = component.slice(
      component.indexOf("const chapters: HomeChapter[]"),
      component.indexOf("const productShelfConfigs")
    );

    expect(component).toContain("type ProductShelfConfig");
    expect(component).toContain("type MissionWorldConfig");
    expect(component).toContain("function AgriCommunityWorldSection");
    expect(component).toContain("function ProductShelfSection");
    expect(component).toContain('layoutKind: "ecosystem"');
    expect(component).toContain('layoutKind: "care"');
    expect(component).toContain('layoutKind: "catalog"');
    expect(chapterBlock).toContain('layoutKind: "agri-mission"');
    expect(chapterBlock).toContain('layoutKind: "city-mission"');
    expect(component).toContain("productShelfConfigs");
    expect(component).toContain("missionWorldConfigs");
    expect(component).toContain('data-testid="home-product-shelf-section"');
    expect(component).toContain('data-testid="home-product-shelf-hero"');
    expect(component).toMatch(/shelfHeroBackdrop[\s\S]{0,240}MithronShelfHeroImage/);
    expect(component).toContain('data-testid="home-product-shelf-grid"');
    expect(component).toContain('data-testid="home-product-guide-card"');
    expect(component).toContain('data-testid="home-product-card"');
    expect(component).not.toContain('data-testid="home-shelf-prev"');
    expect(component).not.toContain('data-testid="home-shelf-next"');
    expect(component).toContain('data-testid="agri-community-world-section"');
    expect(component).toContain('data-testid="mission-world-tile"');
    expect(component).toContain('testId: "agri-community-world"');
    expect(component).toContain('testId: "city-drone-world"');
    expect(component).toContain('composition: "agri-field"');
    expect(component).toContain('composition: "city-urban"');
    expect(component).toContain('"data-tile-size": cardType');
    expect(component).toContain('"data-showcase-kind": "mission-image"');
    expect(component).toContain("function AgriCommunityWorldSection");
    expect(component).toContain("function CityDroneWorldSection");
    expect(component).toContain('data-testid="agri-community-world-section"');
    expect(component).toContain('data-testid="city-drone-world-section"');
    expect(component).not.toContain('data-media-kind={tile.mediaKind}');
    expect(component).toContain("renderMissionWorldTile");
    expect(component).toContain("AGRONE_REGISTRATION_LINKS");
    expect(component).not.toContain("<Link href={config.href} className={styles.missionWorldLink}>");
    expect(component).toContain("product.image.src");
    expect(component).toContain("function pickFeatureProduct");
    expect(component).toContain('href={config.heroCtaHref}');
    expect(component).toContain("function productShelfSearchText");
    expect(component).toContain("featurePriority");
    expect(component).toContain("featureExclude");
    expect(component).toContain('href={`/product/${product.slug}`}');
    expect(component).toContain("shelfProducts.slice(0, 4)");
    expect(component).toContain('data-testid="home-mini-carousel"');
    expect(component).toContain('data-carousel-kind="product"');
    expect(component).toContain('data-testid="home-mini-carousel-item"');
    expect(component).not.toContain("Mithron mission stack");
    expect(component).not.toContain("Aircraft, spares, and field support in one path.");
    expect(component).toContain("pickMiniCarouselItems");
    expect(component).toContain("rail.scrollBy");
    expect(component).toContain("miniCarouselProductPriority");
    expect(component).toContain("itemKey:");
    expect(component).toContain("key={item.itemKey}");
    expect(component).not.toContain("key={item.label}");
    expect(component).toContain('href: `/product/${product.slug}`');
    expect(component).not.toContain("miniCarouselConfigs");

    expect(css).toContain(".productShelfSection");
    expect(css).toContain(".promoImageBand");
    expect(css).toContain(".promoImageFrame");
    expect(css).toContain(".promoImageEyebrow");
    expect(css).toContain(".promoImageCard");
    expect(css).toContain("filter: none");
    expect(css).toContain("width: min(100%, 1740px)");
    expect(css).toContain("border-radius: 8px");
    expect(css).not.toContain(".promoImageCopy");
    expect(css).toContain(".productShelfHeader");
    expect(css).toContain(".productShelfHero");
    expect(css).toContain(".productShelfGrid");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 298px)) minmax(220px, 1fr)");
    expect(css).toContain("gap: clamp(12px, 1.2vw, 18px)");
    expect(css).toContain(".guideCard");
    expect(css).toContain("-webkit-line-clamp: 2");
    const productHeroCss = css.slice(css.indexOf(".productShelfHero"), css.indexOf(".shelfHeroBackdrop"));
    expect(productHeroCss).not.toContain("rgba(15, 23, 42, 0.78)");
    expect(productHeroCss).not.toContain("rgba(15, 23, 42, 0.56)");
    expect(css).toContain(".productActionDot");
    const missionStart = css.indexOf(".missionWorldSection {", css.indexOf(".shelfFallback p"));
    const missionCss = css.slice(missionStart, css.indexOf("@media (max-width: 980px)"));
    expect(css).toContain(".missionWorldSection");
    expect(css).toContain(".missionWorldGrid");
    expect(css).toContain(".missionWorldTile");
    expect(css).toContain('[data-composition="agri-field"]');
    expect(css).toContain('[data-composition="city-urban"]');
    expect(missionCss).toContain("width: min(100%, 1740px)");
    expect(missionCss).not.toContain("width: min(100%, 1440px)");
    expect(missionCss).toContain("min-height: clamp(760px, 88svh, 980px)");
    expect(missionCss).toContain("padding: clamp(88px, 9vh, 128px) 0 clamp(96px, 10vh, 140px)");
    expect(missionCss).toContain("padding: 0 clamp(24px, 4vw, 72px)");
    expect(missionCss).toContain("align-items: end");
    expect(css).toContain(".productShelfSection+.missionWorldSection");
    expect(css).toContain("padding-top: clamp(48px, 5vh, 72px)");
    expect(css).not.toContain(".productShelfSection+.missionWorldSection {\n  padding-top: clamp(4px, 0.9vw, 12px)");
    expect(css).toContain("grid-template-areas:");
    expect(css).toContain('"mission-left mission-hero mission-hero mission-right"');
    expect(css).toContain('"mission-left mission-small-a mission-small-b mission-right"');
    expect(css).toContain("gap: clamp(20px, 1.7vw, 28px)");
    expect(css).toContain("clamp(300px, 33vh, 360px)");
    expect(css).toContain("clamp(220px, 24vh, 270px)");
    expect(css).toContain(".missionWorldSection[data-composition=\"agri-field\"] .missionWorldTile:nth-child(1)");
    expect(css).toContain(".missionWorldSection[data-composition=\"city-urban\"] .missionWorldTile:nth-child(1)");
    expect(css).toContain("grid-area: mission-left");
    expect(css).toContain(".missionWorldSection[data-composition=\"agri-field\"] .missionWorldTile:nth-child(2)");
    expect(css).toContain(".missionWorldSection[data-composition=\"city-urban\"] .missionWorldTile:nth-child(2)");
    expect(css).toContain("grid-area: mission-hero");
    expect(css).toContain(".missionWorldSection[data-composition=\"agri-field\"] .missionWorldTile:nth-child(3)");
    expect(css).toContain(".missionWorldSection[data-composition=\"city-urban\"] .missionWorldTile:nth-child(3)");
    expect(css).toContain("grid-area: mission-right");
    expect(css).toContain(".missionWorldSection[data-composition=\"agri-field\"] .missionWorldTile:nth-child(4)");
    expect(css).toContain(".missionWorldSection[data-composition=\"city-urban\"] .missionWorldTile:nth-child(4)");
    expect(css).toContain("grid-area: mission-small-a");
    expect(css).toContain(".missionWorldSection[data-composition=\"agri-field\"] .missionWorldTile:nth-child(5)");
    expect(css).toContain(".missionWorldSection[data-composition=\"city-urban\"] .missionWorldTile:nth-child(5)");
    expect(css).toContain("grid-area: mission-small-b");
    expect(css).toContain(".missionWorldTileHero");
    expect(css).not.toContain(".missionTilePlay");
    expect(css).not.toContain(".missionWorldLink");
    expect(css).toContain("scale(1.024)");
    expect(missionCss).toContain("border: 0");
    expect(missionCss).toContain("box-shadow: none");
    expect(missionCss).not.toMatch(/catalog|productCard|productShelf|guideCard/);
  });

  it("renders Agri and City mission worlds as linked editorial bento sections without GSAP reveal hooks", () => {
    const component = source("sections/home/home-landing-composite.tsx");
    const agriSection = component.slice(
      component.indexOf("function AgriCommunityWorldSection"),
      component.indexOf("function CityDroneWorldSection")
    );
    const citySection = component.slice(
      component.indexOf("function CityDroneWorldSection"),
      component.lastIndexOf("}")
    );
    const missionTypes = component.slice(
      component.indexOf("type MissionWorldTile"),
      component.indexOf("type MiniCarouselItem")
    );
    const agriMissionConfig = component.slice(
      component.indexOf('"agri-drones":'),
      component.indexOf('"city-drones":')
    );
    const cityMissionConfig = component.slice(
      component.indexOf('"city-drones":'),
      component.indexOf("function productShelfSearchText")
    );

    expect(missionTypes).toMatch(/\bhref\?:/);
    expect(missionTypes).not.toMatch(/\bcta:/);
    expect(missionTypes).not.toMatch(/\bmediaKind:/);
    expect(agriMissionConfig).toContain("AGRONE_REGISTRATION_LINKS.droneOwner");
    expect(agriMissionConfig).toContain("AGRONE_REGISTRATION_LINKS.pilot");
    expect(agriMissionConfig).toContain("AGRONE_REGISTRATION_LINKS.smartFarmer");
    expect(cityMissionConfig).not.toMatch(/\bhref:/);
    expect(agriMissionConfig).not.toMatch(/\bcta:/);
    expect(cityMissionConfig).not.toMatch(/\bcta:/);
    expect(agriMissionConfig).not.toMatch(/\bmediaKind:/);
    expect(cityMissionConfig).not.toMatch(/\bmediaKind:/);
    expect(agriSection).toContain('"data-showcase-kind": "mission-image"');
    expect(citySection).toContain('"data-showcase-kind": "mission-image"');
    expect(agriSection).toContain("renderMissionWorldTile");
    expect(citySection).toContain("renderMissionWorldTile");
    expect(component).toContain('data-showcase-link="false"');
    expect(component).toContain("https://drone.mithronsmart.com/register");
    expect(component).toContain("https://drone.mithronsmart.com/droneowner_reg");
    expect(component).toContain("https://drone.mithronsmart.com/farmer");
    expect(agriSection).not.toContain('href={tile.href || chapter.href || "/agriculture"}');
    expect(citySection).not.toContain('href={tile.href || chapter.href || "/surveillance"}');
    expect(component).not.toContain("<Play");
  });

  it("intentionally renders Drone World, Drone Care, and Global Products as catalog-backed shelves", () => {
    const component = source("sections/home/home-landing-composite.tsx");

    for (const shelfId of ["drone-world", "drone-care", "global-products"]) {
      expect(component).toContain(`id: "${shelfId}"`);
    }
    expect(component).toContain('testId: "drone-world-shelf"');
    expect(component).toContain('testId: "drone-care-shelf"');
    expect(component).toContain('testId: "global-products-shelf"');
    expect(component).not.toContain('testId: "lineup-solutions-shelf"');
    expect(component).toContain('guideLabel: "Buying Guides"');
    expect(component).toContain('guideTitle: "Which Drone Fits Your Mission?"');
    expect(component).toContain('featurePriority: ["drone", "uav", "kisan", "sprayer", "seed spreader"]');
    expect(component).toContain('featureExclude: ["controller", "flight controller", "propeller", "battery", "cable", "connector", "sensor", "motor", "frame", "hpc"]');
    expect(component).toContain('guideLabel: "Care Guides"');
    expect(component).toContain('guideTitle: "Build a Reliable Spares Kit"');
    expect(component).toContain('guideLabel: "Catalog Guides"');
    expect(component).toContain('guideTitle: "Compare Mission Systems"');
    expect(component).toContain('featureCta: "Visit Mithron Smart"');
    expect(component).toContain('heroSubtitle: "DRONE IS MITHRON"');
    expect(component).toContain('heroSubtitle: "One Stop Drone Solution"');
    expect(component).toContain('heroSubtitle: "Global Drone Connect"');
    expect(component).toContain('heroCtaHref: "https://www.mithronsmart.com"');
    expect(component).toContain('tone: "world"');
    expect(component).toContain('tone: "care"');
    expect(component).toContain('tone: "global"');
    expect(component).toContain("isGlobalProductsCategory");
    expect(component).toContain("isDroneWorldCategory");
    expect(component).toContain("isDroneCareShelfProduct");
    expect(component).toContain("resolveHomepageShelf");
    expect(component).toContain('config.tone === "global" ? []');
    expect(component).toContain("Drone World");
    expect(component).toContain("Drone Care");
    expect(component).toContain("Global Product");
    expect(component).not.toContain("Product lineup");
    expect(component).toContain("shelfHeroHeading");
    expect(component).not.toContain("shelfHeroBody");
    const agriMissionConfig = component.slice(
      component.indexOf('"agri-drones":'),
      component.indexOf('"city-drones":')
    );
    const cityMissionConfig = component.slice(
      component.indexOf('"city-drones":'),
      component.indexOf("function compactProductMeta")
    );
    expect(agriMissionConfig.match(/label: "/g) ?? []).toHaveLength(5);
    expect(cityMissionConfig.match(/label: "/g) ?? []).toHaveLength(5);
    expect(component).toContain("AGRONE Pilot Registration");
    expect(component).toContain("AGRONE Drone Owner Registration");
    expect(component).toContain("Smart Farmer Registration");
    expect(component).toContain("Agri Drone Loan & EMI Check");
    expect(component).toContain("All India Farmer Drone Booking");
    expect(component).toContain("formatMissionHeadline(config.title)");
    expect(component).toContain("agrone-drone-owner-registration.png");
    expect(component).toContain("agrone-pilot-registration.png");
    expect(component).toContain("all-india-drone-farmer.png");
    expect(component).toContain("smart-farmer-register.png");
    expect(component).toContain("agri-drone-loan.png");
    expect(component).not.toContain("Precision Spraying");
    expect(component).not.toContain("Field Mapping Pass");
    expect(component).not.toContain("Crop Health Review");
    expect(component).not.toContain("Plantation Monitoring");
    expect(component).not.toContain("Irrigation Analysis");
    expect(component).toContain("City Drone Rental Services App");
    expect(component).toContain("Dronelancer Model");
    expect(component).toContain("Drone FranchiseCare Center");
    expect(component).toContain("All Drone Acadamic");
    expect(component).toContain("Drone Technician Aggregation");
    expect(component).toContain("city-drone-rental-services-app.png");
    expect(component).toContain("dronelancer-model.png");
    expect(component).toContain("drone-franchisecare-center.png");
    expect(component).toContain("all-drone-acadamic.png");
    expect(component).toContain("drone-technician-aggregation.png");
    expect(component).not.toContain("Smart City Monitoring");
    expect(component).not.toContain("Traffic Analytics");
    expect(component).not.toContain("Infrastructure Inspection");
    expect(component).not.toContain("Emergency Response");
    expect(component).not.toContain("Crowd Monitoring");
    expect(component).not.toContain("Yield Monitoring");
    expect(component).not.toContain("RTK Survey Operations");
    expect(component).not.toContain("Smart Agriculture Insights");
    expect(component).not.toContain("Utility Inspection");
    expect(component).not.toContain("Urban Mapping");
    expect(component).not.toContain("Construction Survey");
    expect(component).not.toContain("Smart-City Monitoring");
    expect(component).not.toContain("Delivery Operations");
    expect(component).not.toContain("Large-Scale Farm Ops");
    expect(component).not.toContain("Representative agriculture mission gallery");
  });

  it("keeps hero autoplay resilient across visibility and reduced-motion preferences", () => {
    const hero = source("sections/home/hero-carousel.tsx");

    expect(hero).toContain("function resolveHeroCarouselSlides");
    expect(hero).toContain("document.visibilityState === \"visible\"");
    expect(hero).toContain("scheduleNextAdvance");
    expect(hero).not.toContain("if (liveReducedMotion) return");
  });

  it("defaults the reduced-motion hook to motion-enabled SSR before reading browser prefs", () => {
    const hook = source("hooks/use-reduced-motion.ts");

    expect(hook).toContain("useSyncExternalStore");
    expect(hook).toContain("const getServerSnapshot = () => false");
    expect(hook).toContain('window.matchMedia("(prefers-reduced-motion: reduce)").matches');
  });

  it("keeps mission galleries truthful while removing all later story chapters", () => {
    const component = source("sections/home/home-landing-composite.tsx");
    const chapterBlock = component.slice(
      component.indexOf("const chapters: HomeChapter[]"),
      component.indexOf("const productShelfConfigs")
    );

    expect(component).not.toContain("HomeDroneModelScene");
    expect(component).not.toContain("dynamic(");
    expect(component).not.toContain('modelUrl="/models/mithron-drone-showcase.glb"');
    expect(component).not.toContain('data-testid="home-three-cinematic-section"');
    expect(component).toContain('data-testid="home-customer-testimonials"');
    expect(component).toContain('data-testid="home-about-band"');
    expect(component).toContain('data-testid="home-about-footer"');
    expect(component).toContain("SiteFooter");
    expect(component).toContain("HomeCustomerTestimonialsSection");
    expect(component).toContain("HomeAboutUsBand");
    expect(component).toContain("pickHomeProductReviews");
    expect(component).toContain("ProductReviewContent");
    expect(component).toContain("header={cms.testimonials}");
    expect(component).toContain("homepageCms");
    expect(component).toContain('href={`/product/${item.productSlug}`}');
    expect(component).not.toContain("lineup-solutions");
    expect(component).not.toContain("draft-testimonials");
    expect(component).not.toContain("creative-three");
    expect(component).not.toContain("about-us");
    expect(chapterBlock).toContain('id: "agri-drones"');
    expect(chapterBlock).toContain('id: "city-drones"');
    expect(component).toContain('"EMPTY" as const');
    expect(component).not.toContain("Verified buyer");
    expect(component).not.toContain("buildHomeProductReviewFallbacks");
    expect(component).not.toMatch(/municipal contract|performance metric|star rating/i);
    expect(existsSync(join(process.cwd(), "public/models/mithron-drone-showcase.glb"))).toBe(false);
  });
});
