import { getProductsForCatalog } from "@/services/catalog";
import { getCategoryCmsMetadata } from "@/services/cms";
import { CatalogPage } from "@/sections/catalog/catalog-page";

export default async function SurveillancePage() {
  const [catalog, products] = await Promise.all([getCategoryCmsMetadata("surveillance"), getProductsForCatalog("surveillance")]);

  return (
    <CatalogPage
      title={catalog.title}
      subtitle={catalog.subtitle}
      products={products}
      heroImage={catalog.heroImage}
      showcaseImage={catalog.showcaseImage}
    />
  );
}
