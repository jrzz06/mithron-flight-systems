"use client";

import { ProductConfigurator, type ProductConfiguratorModel } from "@/sections/product/product-configurator";
import { ProductPurchaseProvider } from "@/sections/product/product-purchase-context";
import { ProductStickyPurchase } from "@/sections/product/showcase/product-sticky-purchase";

type ProductPurchaseExperienceProps = {
  product: ProductConfiguratorModel;
  summary: {
    name: string;
    price: number;
    compareAt?: number;
  };
};

export function ProductPurchaseExperience({ product, summary }: ProductPurchaseExperienceProps) {
  return (
    <ProductPurchaseProvider>
      <ProductStickyPurchase summary={summary}>
        <ProductConfigurator product={product} />
      </ProductStickyPurchase>
    </ProductPurchaseProvider>
  );
}
