import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CatalogPage } from "@/sections/catalog/catalog-page";
import {
  getCatalogCategoryDefinition,
  parseProductsCategoryParam
} from "@/lib/catalog-categories";
import { getCatalogShowroomProducts, getProductsForCategorySlug } from "@/services/catalog";
import { getCategoryCmsMetadata } from "@/services/cms";

type ProductsPageProps = {
  searchParams: Promise<{ category?: string }>;
};

export const metadata: Metadata = {
  title: "Product Catalog",
  description: "Browse the full Mithron catalog of agriculture drones, mapping platforms, surveillance systems, creative aircraft, accessories, and global products.",
  alternates: {
    canonical: "/products"
  },
  openGraph: {
    title: "Mithron Product Catalog",
    description: "Curated drone aircraft and mission-ready systems for professional agriculture, mapping, surveillance, and industrial operations."
  }
};

function CatalogPageFallback() {
  return <div className="min-h-[60vh] animate-pulse bg-[#eef0f3]" aria-hidden="true" />;
}

async function ProductsPageContent({ categoryParam }: { categoryParam?: string }) {
  const categorySlug = parseProductsCategoryParam(categoryParam);

  if (categorySlug === "global-products") {
    redirect(getCatalogCategoryDefinition("global-products").href);
  }

  if (categorySlug) {
    const definition = getCatalogCategoryDefinition(categorySlug);
    const [catalog, products] = await Promise.all([
      getCategoryCmsMetadata(definition.cmsRouteKey),
      getProductsForCategorySlug(categorySlug)
    ]);

    return (
      <CatalogPage
        title={catalog.title || definition.label}
        subtitle={catalog.subtitle}
        products={products}
        heroImage={catalog.heroImage}
        showcaseImage={catalog.showcaseImage}
        presentation="showroom"
      />
    );
  }

  const products = await getCatalogShowroomProducts();

  return (
    <CatalogPage
      title="Products"
      subtitle="Browse drones, accessories, and field-ready systems from the Mithron catalog."
      products={products}
      presentation="showroom"
    />
  );
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const { category } = await searchParams;

  return (
    <Suspense fallback={<CatalogPageFallback />}>
      <ProductsPageContent categoryParam={category} />
    </Suspense>
  );
}