import { catalogShowcaseAssets, heroAssets } from "@/config/assets";

export const catalogShowcaseFrame = {
  width: 1915,
  height: 821
} as const;

type CatalogRouteConfig = {
  title: string;
  subtitle: string;
  heroImage: string;
  showcaseImage?: {
    src: string;
    alt: string;
    width: number;
    height: number;
    navbarInk: "light" | "dark";
    fit?: "cinematic" | "native";
  };
};

export const catalogRoutes = {
  agriculture: {
    title: "Agri drones",
    subtitle: "Precision spraying, seeding, crop monitoring, and farm automation systems for modern agriculture teams.",
    heroImage: heroAssets.ag10Command,
    showcaseImage: {
      src: catalogShowcaseAssets.agricultureCategory,
      alt: "Agri drone cinematic category showcase",
      width: 1834,
      height: 858,
      navbarInk: "dark"
    }
  },
  videoDrones: {
    title: "Video drones",
    subtitle: "Compact aerial imaging, field documentation, and creator-flight systems for training and visual operations.",
    heroImage: heroAssets.mappingFlight,
    showcaseImage: {
      src: catalogShowcaseAssets.videoDronesCategory,
      alt: "Video drone cinematic category showcase",
      width: 1672,
      height: 941,
      navbarInk: "light"
    }
  },
  creativeDrones: {
    title: "Creative drones",
    subtitle: "Drone soccer, academics, training labs, and creative aerospace programs for hands-on flight learning.",
    heroImage: heroAssets.securityGrid,
    showcaseImage: {
      src: catalogShowcaseAssets.creativeDronesCategory,
      alt: "Creative drone cinematic category showcase",
      width: 1915,
      height: 821,
      navbarInk: "dark"
    }
  },
  accessories: {
    title: "All drones and spares",
    subtitle: "Autonomy cores, field controllers, payload systems, batteries, propellers, and deployment hardware for complete drone operations.",
    heroImage: heroAssets.mappingFlight,
    showcaseImage: {
      src: "/media/mithron/catalog/mithron-drone-category.png",
      alt: "Mithron accessories category showcase",
      width: 1881,
      height: 836,
      navbarInk: "light"
    }
  },
  industrial: {
    title: "Global Products",
    subtitle: "Specialist systems and global import/export products from the Mithron catalog.",
    heroImage: heroAssets.securityGrid,
    showcaseImage: {
      src: catalogShowcaseAssets.globalProductsCategory,
      alt: "Global Product — One vision. Everywhere. Professional cinema and camera systems showcase.",
      width: catalogShowcaseFrame.width,
      height: catalogShowcaseFrame.height,
      navbarInk: "light",
      fit: "cinematic"
    }
  },
  mapping: {
    title: "Survey drones",
    subtitle: "Survey-grade flight workflows, terrain intelligence, and RTK-ready aerial data systems.",
    heroImage: heroAssets.mappingFlight,
    showcaseImage: {
      src: catalogShowcaseAssets.surveyDronesCategory,
      alt: "Survey drone cinematic category showcase",
      width: 1915,
      height: 821,
      navbarInk: "dark"
    }
  },
  surveillance: {
    title: "Surveillance drone systems",
    subtitle: "Thermal awareness, perimeter monitoring, and aerial response systems for critical operations.",
    heroImage: heroAssets.securityGrid,
    showcaseImage: {
      src: catalogShowcaseAssets.surveillanceDronesCategory,
      alt: "Surveillance drone cinematic category showcase",
      width: 1915,
      height: 821,
      navbarInk: "light"
    }
  }
} satisfies Record<string, CatalogRouteConfig>;
