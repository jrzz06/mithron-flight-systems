import { storefrontMediaPaths } from "@/config/storefront-media-paths";

export type HomepageShelfCms = {
  eyebrow: string;
  title: string;
  href: string;
  viewAllLabel: string;
  guideLabel: string;
  guideTitle: string;
  guideHref: string;
  heroEyebrow: string;
  heroSubtitle: string;
  heroBody: string;
  featureCta: string;
  heroCtaHref: string;
  heroImageSrc: string;
  heroImageAlt: string;
};

export type HomepageMissionTileCms = {
  label: string;
  body: string;
  operator: string;
  model: string;
  location: string;
  imageSrc: string;
  imageAlt: string;
  href: string;
};

export type HomepageMissionCms = {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  mediaNote: string;
  tiles: HomepageMissionTileCms[];
};

export type HomepageCmsContent = {
  shelves: {
    droneWorld: HomepageShelfCms;
    droneCare: HomepageShelfCms;
    globalProducts: HomepageShelfCms;
  };
  missions: {
    agri: HomepageMissionCms;
    city: HomepageMissionCms;
  };
  testimonials: {
    eyebrow: string;
    title: string;
    lead: string;
    linkLabel: string;
    linkHref: string;
  };
  about: {
    eyebrow: string;
    title: string;
    body: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
};

export const defaultHomepageCmsContent: HomepageCmsContent = {
  shelves: {
    droneWorld: {
      eyebrow: "Featured Collection",
      title: "Drone World",
      href: "/products",
      viewAllLabel: "View All",
      guideLabel: "Buying Guides",
      guideTitle: "Which Drone Fits Your Mission?",
      guideHref: "/products",
      heroEyebrow: "Featured Collection",
      heroSubtitle: "",
      heroBody: "Aircraft and mission-ready systems from the published catalog.",
      featureCta: "View catalog",
      heroCtaHref: "/products",
      heroImageSrc: storefrontMediaPaths.showcase.droneWorld,
      heroImageAlt: "Mithron drone fleet operating across a rugged mountain valley at golden hour"
    },
    droneCare: {
      eyebrow: "Essential Care",
      title: "Drone Care",
      href: "/accessories",
      viewAllLabel: "View All",
      guideLabel: "Care Guides",
      guideTitle: "Build a Reliable Spares Kit",
      guideHref: "/accessories",
      heroEyebrow: "Essential Care",
      heroSubtitle: "",
      heroBody: "Batteries, propellers, controllers, and spares for your fleet.",
      featureCta: "Shop care",
      heroCtaHref: "/accessories",
      heroImageSrc: storefrontMediaPaths.showcase.droneCare,
      heroImageAlt: "Mithron Drone Care complete kit with aircraft, controller, batteries, propellers, and service case"
    },
    globalProducts: {
      eyebrow: "Global Selection",
      title: "Global Product",
      href: "/products",
      viewAllLabel: "View All",
      guideLabel: "Catalog Guides",
      guideTitle: "Compare Mission Systems",
      guideHref: "/products",
      heroEyebrow: "Global Selection",
      heroSubtitle: "",
      heroBody: "Specialist platforms for teams sourcing across regions.",
      featureCta: "Browse global",
      heroCtaHref: "/products",
      heroImageSrc: storefrontMediaPaths.showcase.globalProducts,
      heroImageAlt: "Global Drone Connect industrial drone carrying a shipping container over a digital logistics hub at night"
    }
  },
  missions: {
    agri: {
      eyebrow: "Solutions for Growth",
      title: "Agri Community World",
      body: "Register, book, and finance drones across India's AGRONE network.",
      href: "/agriculture",
      cta: "Explore Agri Drones",
      mediaNote: "",
      tiles: [
        {
          label: "Drone Owner Registration",
          body: "Register your drone on the AGRONE network.",
          operator: "AGRONE Network",
          model: "DRONE OWNER NETWORK",
          location: "Pan-India",
          imageSrc: storefrontMediaPaths.missionAgrone.droneOwnerRegistration,
          imageAlt: "AGRONE drone owner registration",
          href: "https://drone.mithronsmart.com/droneowner_reg"
        },
        {
          label: "Pilot Registration",
          body: "Join certified pilots and receive AGRONE missions.",
          operator: "AGRONE Network",
          model: "AGRONE PILOT NETWORK",
          location: "Pilot network",
          imageSrc: storefrontMediaPaths.missionAgrone.pilotRegistration,
          imageAlt: "AGRONE pilot registration",
          href: "https://drone.mithronsmart.com/register"
        },
        {
          label: "Farmer Drone Booking",
          body: "Book spraying and crop monitoring across India.",
          operator: "AGRONE Network",
          model: "NATIONWIDE BOOKING",
          location: "Booking desk",
          imageSrc: storefrontMediaPaths.missionAgrone.allIndiaDroneFarmer,
          imageAlt: "All India farmer drone booking",
          href: ""
        },
        {
          label: "Smart Farmer Registration",
          body: "Access AGRONE services and on-demand drone support.",
          operator: "AGRONE Network",
          model: "SMART FARMER PROGRAM",
          location: "Farmer network",
          imageSrc: storefrontMediaPaths.missionAgrone.smartFarmerRegister,
          imageAlt: "Smart farmer registration",
          href: "https://drone.mithronsmart.com/farmer"
        },
        {
          label: "Drone Loan and EMI",
          body: "Check eligibility and compare financing plans.",
          operator: "AGRONE Network",
          model: "FINANCING SUPPORT",
          location: "Loan check",
          imageSrc: storefrontMediaPaths.missionAgrone.agriDroneLoan,
          imageAlt: "Agri drone loan and EMI check",
          href: ""
        }
      ]
    },
    city: {
      eyebrow: "Solutions for Future Cities",
      title: "City Drone World",
      body: "Urban platforms for rentals, training, care, and technician support.",
      href: "/surveillance",
      cta: "Explore City Drones",
      mediaNote: "",
      tiles: [
        {
          label: "Dronelancer Model",
          body: "Pilot marketplace for on-demand city jobs.",
          operator: "Mithron City Network",
          model: "DRONELANCER MODEL",
          location: "Pilot grid",
          imageSrc: storefrontMediaPaths.missionCity.dronelancerModel,
          imageAlt: "Dronelancer Model",
          href: ""
        },
        {
          label: "Drone Rental App",
          body: "Book rentals and track project earnings.",
          operator: "Mithron City Network",
          model: "RENTAL SERVICES APP",
          location: "Booking console",
          imageSrc: storefrontMediaPaths.missionCity.rentalServicesApp,
          imageAlt: "City Drone Rental Services App",
          href: ""
        },
        {
          label: "Drone Academic",
          body: "Pilot training and certified urban flight programs.",
          operator: "Mithron Academy Network",
          model: "ALL DRONE ACADEMIC",
          location: "Training hub",
          imageSrc: storefrontMediaPaths.missionCity.allDroneAcademic,
          imageAlt: "All Drone Academic",
          href: ""
        },
        {
          label: "FranchiseCare Center",
          body: "Local repair, spares, and maintenance support.",
          operator: "Mithron Service Network",
          model: "FRANCHISECARE CENTER",
          location: "Care workshop",
          imageSrc: storefrontMediaPaths.missionCity.franchiseCareCenter,
          imageAlt: "Drone FranchiseCare Center",
          href: ""
        },
        {
          label: "Technician Network",
          body: "Field diagnostics and maintenance coordination.",
          operator: "Mithron Service Network",
          model: "TECHNICIAN AGGREGATION",
          location: "Field network",
          imageSrc: storefrontMediaPaths.missionCity.technicianAggregation,
          imageAlt: "Drone Technician Aggregation",
          href: ""
        }
      ]
    }
  },
  testimonials: {
    eyebrow: "Customer voices",
    title: "Trusted by pilots and field teams",
    lead: "Real feedback from operators running agriculture, mapping, and surveillance missions with Mithron hardware.",
    linkLabel: "Browse products",
    linkHref: "/products"
  },
  about: {
    eyebrow: "About us",
    title: "Drone systems for operational teams.",
    body: "Mithron builds and supplies agriculture, mapping, surveillance, industrial, and media drone systems with catalog, Drone Care, and field deployment support managed through one operating stack.",
    primaryLabel: "About Mithron",
    primaryHref: "/about",
    secondaryLabel: "Contact team",
    secondaryHref: "/contact"
  }
};

function emptyMissionTile(): HomepageMissionTileCms {
  return {
    label: "",
    body: "",
    operator: "",
    model: "",
    location: "",
    imageSrc: "",
    imageAlt: "",
    href: ""
  };
}

function emptyShelf(): HomepageShelfCms {
  return {
    eyebrow: "",
    title: "",
    href: "",
    viewAllLabel: "",
    guideLabel: "",
    guideTitle: "",
    guideHref: "",
    heroEyebrow: "",
    heroSubtitle: "",
    heroBody: "",
    featureCta: "",
    heroCtaHref: "",
    heroImageSrc: "",
    heroImageAlt: ""
  };
}

/** Storefront-safe empty payload used when strict CMS mode disallows silent defaults. */
export const emptyHomepageCmsContent: HomepageCmsContent = {
  shelves: {
    droneWorld: emptyShelf(),
    droneCare: emptyShelf(),
    globalProducts: emptyShelf()
  },
  missions: {
    agri: {
      eyebrow: "",
      title: "",
      body: "",
      href: "",
      cta: "",
      mediaNote: "",
      tiles: defaultHomepageCmsContent.missions.agri.tiles.map(() => emptyMissionTile())
    },
    city: {
      eyebrow: "",
      title: "",
      body: "",
      href: "",
      cta: "",
      mediaNote: "",
      tiles: defaultHomepageCmsContent.missions.city.tiles.map(() => emptyMissionTile())
    }
  },
  testimonials: {
    eyebrow: "",
    title: "",
    lead: "",
    linkLabel: "",
    linkHref: ""
  },
  about: {
    eyebrow: "",
    title: "",
    body: "",
    primaryLabel: "",
    primaryHref: "",
    secondaryLabel: "",
    secondaryHref: ""
  }
};

export type HomepageCmsSectionId =
  | "hero"
  | "shelf-drone-world"
  | "shelf-drone-care"
  | "shelf-global-products"
  | "mission-agri"
  | "mission-city"
  | "testimonials"
  | "about"
  | "product-reviews"
  | "footer";

export type HomepageCmsWorkflow = "draft-publish" | "live";

export const homepageCmsSections: Array<{
  id: HomepageCmsSectionId;
  label: string;
  description: string;
  previewAnchor: string;
  workflow: HomepageCmsWorkflow;
  workflowLabel: string;
}> = [
  { id: "hero", label: "Hero carousel", description: "Top homepage slides — headline, image, and primary button.", previewAnchor: "hero", workflow: "draft-publish", workflowLabel: "Draft → Publish" },
  { id: "shelf-drone-world", label: "Drone World shelf", description: "Featured collection product rail and hero feature.", previewAnchor: "drone-world", workflow: "live", workflowLabel: "Live changes" },
  { id: "shelf-drone-care", label: "Drone Care shelf", description: "Essential care accessories and spares section.", previewAnchor: "drone-care", workflow: "live", workflowLabel: "Live changes" },
  { id: "shelf-global-products", label: "Global Products shelf", description: "Broader catalog comparison shelf.", previewAnchor: "global-products", workflow: "live", workflowLabel: "Live changes" },
  { id: "mission-agri", label: "Agri Community World", description: "Agriculture mission bento grid and copy.", previewAnchor: "agri-drones", workflow: "live", workflowLabel: "Live changes" },
  { id: "mission-city", label: "City Drone World", description: "Urban operations mission bento grid.", previewAnchor: "city-drones", workflow: "live", workflowLabel: "Live changes" },
  { id: "testimonials", label: "Reviews header", description: "Section title, intro copy, and browse link above review cards.", previewAnchor: "home-customer-testimonials", workflow: "live", workflowLabel: "Live changes" },
  { id: "product-reviews", label: "Product review cards", description: "Customer quotes linked to catalog products.", previewAnchor: "home-customer-testimonials", workflow: "draft-publish", workflowLabel: "Draft → Publish" },
  { id: "about", label: "About band", description: "About Mithron call-to-action above the footer.", previewAnchor: "home-about-band", workflow: "live", workflowLabel: "Live changes" },
  { id: "footer", label: "Footer", description: "Footer lead copy, contact details, and legal line.", previewAnchor: "home-about-footer", workflow: "live", workflowLabel: "Live changes" }
];
