import dynamic from "next/dynamic";
import { HeroCarousel } from "@/sections/home/hero-carousel";
import { HomeLandingSkeleton } from "@/components/home/home-landing-skeleton";
import { CmsStorefrontSurface } from "@/components/home/cms-storefront-surface";
import { getPublicCmsSnapshot } from "@/services/cms";
import { getHomepageCmsContent } from "@/services/homepage-cms";
import { getHomepageProducts } from "@/services/catalog";

const HomeLandingComposite = dynamic(
  () => import("@/sections/home/home-landing-composite").then((module) => module.HomeLandingComposite),
  { loading: () => <HomeLandingSkeleton /> }
);

// ISR: 60-second fallback TTL. CMS publish actions call revalidatePath("/")
// + revalidateTag("cms","max") to bust both the page cache and Data Cache
// immediately, so live changes appear on the next request after publish.
export const revalidate = 60;

export default async function HomePage() {
  const [cms, products, homepageCms] = await Promise.all([
    getPublicCmsSnapshot(),
    getHomepageProducts(),
    getHomepageCmsContent()
  ]);

  return (
    <>
      <HeroCarousel slides={cms.home.heroBanners} cmsSectionKey="hero" />
      <CmsStorefrontSurface
        promotionalCampaigns={cms.promotionalCampaigns}
        trustCards={cms.trustCards}
      />
      <HomeLandingComposite
        products={products}
        productReviews={cms.productSupport.reviews}
        footer={cms.footer}
        homepageCms={homepageCms}
      />
    </>
  );
}
