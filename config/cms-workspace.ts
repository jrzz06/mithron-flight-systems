export const CMS_WORKSPACE_ROOT = "/admin/cms";

export const CMS_WORKSPACE_ANCHORS = {
  root: "cms-control-panel",
  hero: "cms-section-hero-banners",
  categoryBanners: "cms-page-category-banners"
} as const;

export const CMS_WORKSPACE_LINKS = {
  root: `${CMS_WORKSPACE_ROOT}#${CMS_WORKSPACE_ANCHORS.root}`,
  hero: `${CMS_WORKSPACE_ROOT}#${CMS_WORKSPACE_ANCHORS.hero}`,
  categoryBanners: `${CMS_WORKSPACE_ROOT}#${CMS_WORKSPACE_ANCHORS.categoryBanners}`
} as const;

export const CMS_WORKSPACE_PAGES = [
  {
    id: "homepage",
    label: "Homepage",
    anchor: "cms-page-homepage",
    routePath: "/",
    previewHref: "/",
    description: "Homepage hero, sections, product reviews, and supporting content.",
    order: 10
  },
  {
    id: "category-banners",
    label: "Category Banners",
    anchor: CMS_WORKSPACE_ANCHORS.categoryBanners,
    routePath: "/products",
    previewHref: "/products",
    description: "Category route hero and showcase banner controls.",
    order: 20
  },
  {
    id: "products-page",
    label: "Products Page",
    anchor: "cms-page-products",
    routePath: "/products",
    previewHref: "/products",
    description: "Product listing content blocks and featured product sections.",
    order: 30
  },
  {
    id: "product-detail-pages",
    label: "Product Detail Pages",
    anchor: "cms-page-product-detail",
    routePath: "/product/[slug]",
    previewHref: "/products",
    description: "Product detail supporting content controlled by shared product sections.",
    order: 40
  },
  {
    id: "navigation-page",
    label: "Navigation",
    anchor: "cms-page-navigation",
    routePath: "/",
    previewHref: "/",
    description: "Primary storefront navigation labels and destinations.",
    order: 50
  },
  {
    id: "footer-page",
    label: "Footer",
    anchor: "cms-page-footer",
    routePath: "/",
    previewHref: "/",
    description: "Footer groups and footer links.",
    order: 60
  },
  {
    id: "about",
    label: "About",
    anchor: "cms-page-about",
    routePath: "/about",
    previewHref: "/about",
    description: "Story, mission, and about-page linked homepage sections.",
    order: 80
  },
  {
    id: "contact",
    label: "Contact",
    anchor: "cms-page-contact",
    routePath: "/contact",
    previewHref: "/contact",
    description: "Contact CTA sections, campaign prompts, and footer entry points.",
    order: 90
  },
  {
    id: "product-reviews",
    label: "Product Reviews",
    anchor: "cms-page-product-reviews",
    routePath: "/",
    previewHref: "/",
    description: "Homepage product review quote and attribution controls.",
    order: 100
  }
] as const;

export type CmsWorkspacePageId = (typeof CMS_WORKSPACE_PAGES)[number]["id"];

export function getCmsWorkspacePageDefinition(id: string) {
  return CMS_WORKSPACE_PAGES.find((page) => page.id === id) ?? null;
}
