import { SupplierNewProductForm } from "@/components/supplier/supplier-new-product-form";
import { createSupplierProductFormStateAction } from "../actions";

export default function SupplierNewProductPage() {
  return (
    <div className="max-w-xl grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Add product</h1>
        <p className="mt-1 text-sm text-slate-400">
          Save as draft, or use <strong className="font-medium text-slate-300">Save &amp; submit for approval</strong> to send the product directly to admin review.
        </p>
      </div>
      <SupplierNewProductForm action={createSupplierProductFormStateAction} />
    </div>
  );
}
