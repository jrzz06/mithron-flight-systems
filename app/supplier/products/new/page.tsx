import { SupplierNewProductForm } from "@/components/supplier/supplier-new-product-form";
import { createSupplierProductFormStateAction } from "../actions";
import { getCurrentAuthContext } from "@/services/auth";
import { getAssignedWarehouseCodeForUser } from "@/services/warehouse-scope";

export default async function SupplierNewProductPage() {
  const context = await getCurrentAuthContext();
  const assignedWarehouseCode = await getAssignedWarehouseCodeForUser(context.userId);

  return (
    <div className="max-w-xl grid gap-5">
      <p className="text-sm leading-relaxed text-[var(--platform-text-secondary)]">
        Add a new product listing. Save as a draft to continue later, or save and send for review when you are ready
        for our team to approve it.
      </p>
      <SupplierNewProductForm action={createSupplierProductFormStateAction} assignedWarehouseCode={assignedWarehouseCode} />
    </div>
  );
}
