import { SupplierEditProductForm } from "@/components/supplier/supplier-edit-product-form";
import { SupplierSubmitProductButton } from "@/components/supplier/supplier-submit-product-button";
import { readProductImageSrc } from "@/lib/supplier/product-image";
import { getCurrentAuthContext } from "@/services/auth";
import { getSupplierOwnedProduct } from "@/services/supplier-actions";
import { submitSupplierProductFormAction, updateSupplierProductFormStateAction } from "../../actions";
import { notFound } from "next/navigation";

export default async function SupplierEditProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const context = await getCurrentAuthContext();
  if (!context.userId) notFound();

  const product = await getSupplierOwnedProduct(context.userId, slug);
  if (!product) notFound();

  const workflowStatus = String(product.workflow_status ?? "draft");
  const rejectionReason = typeof product.rejection_reason === "string" ? product.rejection_reason : null;
  const canEdit = ["draft", "rejected"].includes(workflowStatus);
  const canSubmit = ["draft", "rejected"].includes(workflowStatus);

  return (
    <div className="max-w-xl grid gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">{String(product.name)}</h1>
        <p className="mt-1 text-sm capitalize text-slate-400">Status: {workflowStatus}</p>
      </div>

      {workflowStatus === "rejected" && rejectionReason ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-100">
          <p className="font-semibold">Rejection reason</p>
          <p className="mt-1 text-rose-100/90">{rejectionReason}</p>
        </div>
      ) : null}

      {workflowStatus === "pending_review" ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-sm text-amber-100">
          This product is awaiting admin review and cannot be edited until approval completes or it is rejected.
        </p>
      ) : null}

      {canEdit ? (
        <>
          <SupplierEditProductForm
            action={updateSupplierProductFormStateAction}
            defaults={{
              slug,
              name: String(product.name ?? ""),
              category: String(product.category ?? "Agri Drones"),
              price: Number(product.price ?? 0),
              tagline: String(product.tagline ?? ""),
              imageSrc: readProductImageSrc(product.image) || readProductImageSrc(product.hero),
              imageAlt: String(product.name ?? ""),
              updatedAt: typeof product.updated_at === "string" ? product.updated_at : null
            }}
          />
          {canSubmit ? (
            <form action={submitSupplierProductFormAction} className="rounded-xl border border-white/[0.08] bg-[#0f141b] p-5">
              <input type="hidden" name="slug" value={slug} />
              <p className="text-sm text-slate-400">Submit this product for admin review. It will not appear on the storefront until approved.</p>
              <SupplierSubmitProductButton variant="button" />
            </form>
          ) : null}
        </>
      ) : (
        <p className="rounded-xl border border-white/[0.08] bg-[#0f141b] p-5 text-sm text-slate-400">
          This product is currently {workflowStatus} and cannot be edited here.
        </p>
      )}
    </div>
  );
}
