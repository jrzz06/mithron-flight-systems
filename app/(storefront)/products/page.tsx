import { CatalogPage } from "@/sections/catalog/catalog-page";
import { getCatalogShowroomProducts } from "@/services/catalog";

export default async function ProductsPage() {
  const products = await getCatalogShowroomProducts();

  return (
    <CatalogPage
      title="Mithron Product Catalog"
    subtitle="Curated drone aircraft and mission-ready systems for professional operations."
      products={products}
      presentation="showroom"
    />
  );
}
