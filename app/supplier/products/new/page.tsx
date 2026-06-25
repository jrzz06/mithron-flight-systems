import { SupplierNewProductForm } from "@/components/supplier/supplier-new-product-form";
import { createSupplierProductFormStateAction } from "../actions";

export default function SupplierNewProductPage() {
  return (
    <div className="max-w-xl grid gap-5">
      <p className="text-sm leading-relaxed text-[var(--platform-text-secondary)]">
        Add a new product listing. Save as a draft to continue later, or save and send for review when you are ready
        for our team to approve it.
      </p>
      <SupplierNewProductForm action={createSupplierProductFormStateAction} />
    </div>
  );
}
