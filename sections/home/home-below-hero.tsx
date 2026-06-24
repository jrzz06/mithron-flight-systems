import { CmsStorefrontSurface } from "@/components/home/cms-storefront-surface";
import { HomeLandingComposite } from "@/sections/home/home-landing-composite";
import { getPublicCmsSnapshot } from "@/services/cms";
import { getHomepageProducts } from "@/services/catalog";
import { getHomepageCmsContent } from "@/services/homepage-cms";

export async function HomeBelowHero() {
  const [cms, products, homepageCms] = await Promise.all([
    getPublicCmsSnapshot(),
    getHomepageProducts(),
    getHomepageCmsContent()
  ]);

  return (
    <>
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
