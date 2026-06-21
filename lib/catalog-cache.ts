import { revalidatePath, revalidateTag } from "next/cache";
import { catalogCategoryDefinitions } from "@/lib/catalog-categories";

export function revalidateCatalogSurfaces(productSlug?: string) {
  revalidateTag("catalog", "max");
  revalidateTag("catalog-products", "max");
  revalidatePath("/");
  revalidatePath("/store");
  revalidatePath("/products");
  revalidatePath("/industrial");
  for (const definition of catalogCategoryDefinitions) {
    revalidatePath(definition.href);
    revalidatePath(definition.legacyHref);
  }
  if (productSlug) {
    revalidatePath(`/product/${productSlug}`);
  }
}
