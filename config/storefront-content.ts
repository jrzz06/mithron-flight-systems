export type FooterColumn = {
  title: string;
  links: Array<[label: string, href: string]>;
};

export type FooterContent = {
  leadTitle: string;
  leadBody: string;
  emailPlaceholder: string;
  ctaLabel: string;
  columns: FooterColumn[];
  legalText: string;
};

export const footerContent = {
  leadTitle: "Enter the flight stack",
  leadBody: "Get Mithron agri-drone updates, pilot-network notes, Drone Care intelligence, and field deployment direction.",
  emailPlaceholder: "Enter your email address",
  ctaLabel: "Subscribe",
  columns: [
    {
      title: "Products",
      links: [
        ["Agri Drones", "/agriculture"],
        ["Survey Drones", "/mapping"],
        ["Surveillance Drones", "/surveillance"],
        ["Drone Spares", "/accessories"]
      ]
    },
    {
      title: "Operations",
      links: [
        ["Aggregator App", "/accessories"],
        ["Academics", "/accessories"],
        ["Troubleshoot", "/accessories"],
        ["Franchise & Export", "/industrial"]
      ]
    },
    {
      title: "Company",
      links: [
        ["Drone Care Centers", "/product/mithron-care-plus"],
        ["Pilot Connect", "/login"],
        ["Partner Network", "/industrial"],
        ["Privacy", "#"]
      ]
    }
  ],
  legalText: "Mithron autonomous drone ecosystem. Aircraft, spares, Drone Care, academics, pilot connection, franchise, export, and field deployment support for modern aerial operations."
} satisfies FooterContent;

export type ProductReviewContent = {
  id?: string;
  name: string;
  body: string;
  productSlug?: string | null;
  rating?: number | null;
};

export type ProductSupportContent = {
  faqs: Array<[question: string, answer: string]>;
  reviews: ProductReviewContent[];
};

export const productSupportContent = {
  faqs: [
    ["How does Mithron qualify a deployment?", "Mithron aligns the selected aircraft, payload, operating region, operator readiness, and Drone Care requirements before the field plan moves forward."],
    ["Can one stack support multiple mission profiles?", "Yes. The ecosystem connects aircraft, controllers, batteries, payloads, mission planning, and service modules across agriculture, mapping, and surveillance workflows."],
    ["How is operator support handled?", "Training-first onboarding, service guidance, and field support are treated as part of the operating system rather than an afterthought."]
  ],
  reviews: []
} satisfies ProductSupportContent;

// ---------------------------------------------------------------------------
// Homepage product shelf rails
// ---------------------------------------------------------------------------

export type HomeShelf = {
  id: string;
  eyebrow: string;
  title: string;
  viewAllHref: string;
  categoryFilter: string;
  maxCards: number;
};

export const homeShelves: HomeShelf[] = [
  {
    id: "agri",
    eyebrow: "FEATURED COLLECTION",
    title: "Drone World",
    viewAllHref: "/agriculture",
    categoryFilter: "Agri Drones",
    maxCards: 5
  },
  {
    id: "accessories",
    eyebrow: "ESSENTIAL CARE",
    title: "Drone Care",
    viewAllHref: "/accessories",
    categoryFilter: "Accessories",
    maxCards: 5
  },
  {
    id: "surveillance",
    eyebrow: "GLOBAL SELECTION",
    title: "Global Product",
    viewAllHref: "/surveillance",
    categoryFilter: "Surveillance Drones",
    maxCards: 5
  }
];
