import { getProductsForCatalog } from "@/services/catalog";
import { getCategoryCmsMetadata } from "@/services/cms";
import { CatalogPage } from "@/sections/catalog/catalog-page";

export default async function IndustrialPage() {
  const [catalog, products] = await Promise.all([getCategoryCmsMetadata("industrial"), getProductsForCatalog("industrial")]);

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
