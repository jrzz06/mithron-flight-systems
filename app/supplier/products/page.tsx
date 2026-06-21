import Link from "next/link";
import { getCurrentAuthContext } from "@/services/auth";
import { listSupplierProducts } from "@/services/supplier-actions";
import { SupplierSubmitProductButton } from "@/components/supplier/supplier-submit-product-button";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { deleteSupplierProductFormAction, submitSupplierProductFormAction } from "./actions";

function canSubmit(status: string) {
  return status === "draft" || status === "rejected";
}

function statusBadgeClass(status: string) {
  if (status === "draft") return "bg-slate-500/15 text-slate-200 ring-slate-500/30";
  if (status === "pending_review") return "bg-amber-500/15 text-amber-100 ring-amber-500/30";
  if (status === "published") return "bg-emerald-500/15 text-emerald-100 ring-emerald-500/30";
  if (status === "rejected") return "bg-rose-500/15 text-rose-100 ring-rose-500/30";
  return "bg-slate-500/15 text-slate-200 ring-slate-500/30";
}

function statusHint(status: string) {
  if (status === "draft") return "Not sent to admin yet — click Submit for approval.";
  if (status === "pending_review") return "Waiting for admin approval.";
  if (status === "rejected") return "Rejected by admin — edit and resubmit.";
  if (status === "published") return "Live on storefront.";
  return "";
}

export default async function SupplierProductsPage() {
  const context = await getCurrentAuthContext();
  const products = context.userId ? await listSupplierProducts(context.userId) : [];
  const draftCount = products.filter((product) => {
    const status = String(product.workflow_status ?? "draft");
    return status === "draft" || status === "rejected";
  }).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">My products</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Saving a draft does <strong className="font-semibold text-slate-200">not</strong> notify admin.
            After saving, click <strong className="font-semibold text-emerald-200">Submit for approval</strong> to send it to the admin queue.
          </p>
        </div>
        <Link href="/supplier/products/new" className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white">
          Add product
        </Link>
      </div>

      {draftCount > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          You have {draftCount} product{draftCount === 1 ? "" : "s"} not yet submitted to admin.
          Submit them so they appear under <strong className="font-semibold">Admin → Supplier approvals</strong>.
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-white/[0.08]">
        <table className="min-w-full text-sm">
          <thead className="bg-[#0f141b] text-left text-slate-400">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length ? products.map((product) => {
              const slug = String(product.slug);
              const status = String(product.workflow_status ?? "draft");
              const hint = statusHint(status);
              return (
                <tr key={slug} className="border-t border-white/[0.06]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-100">{String(product.name)}</div>
                    {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusBadgeClass(status)}`}>
                      {status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{String(product.updated_at ?? "")}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link href={`/supplier/products/${slug}/edit`} className="text-violet-300 hover:underline">
                        Edit
                      </Link>
                      {canSubmit(status) ? (
                        <form action={submitSupplierProductFormAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <SupplierSubmitProductButton variant="button" />
                        </form>
                      ) : null}
                      {canSubmit(status) ? (
                        <form action={deleteSupplierProductFormAction}>
                          <input type="hidden" name="slug" value={slug} />
                          <OperationalSubmitButton
                            pendingLabel="Deleting"
                            confirmMessage={`Delete draft "${String(product.name)}"? This cannot be undone.`}
                            className="ambient-cta inline-flex items-center justify-center self-start text-rose-300 hover:text-rose-200"
                          >
                            Delete draft
                          </OperationalSubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No supplier products yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
