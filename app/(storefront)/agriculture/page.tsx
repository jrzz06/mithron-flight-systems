import { getProductsForCatalog } from "@/services/catalog";
import { getCategoryCmsMetadata } from "@/services/cms";
import { CatalogPage } from "@/sections/catalog/catalog-page";

export default async function AgriculturePage() {
  const [catalog, products] = await Promise.all([getCategoryCmsMetadata("agriculture"), getProductsForCatalog("agriculture")]);

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
