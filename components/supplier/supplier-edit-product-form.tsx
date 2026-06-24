"use client";

import { useActionState, useRef, useState } from "react";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { SupplierFormStatusOverlay } from "@/components/supplier/supplier-form-status-overlay";
import { SupplierInlineResultDialog } from "@/components/supplier/supplier-inline-result-dialog";
import { SupplierProductImageField } from "@/components/supplier/supplier-product-image-field";
import type { SupplierProductFormState } from "@/components/supplier/supplier-new-product-form";

const initialState: SupplierProductFormState = { status: "idle", message: "" };

export type SupplierProductEditDefaults = {
  slug: string;
  name: string;
  category: string;
  price: number;
  tagline: string;
  imageSrc?: string;
  imageAlt?: string;
  updatedAt?: string | null;
};

export function SupplierEditProductForm({
  action,
  defaults
}: {
  action: (prevState: SupplierProductFormState, formData: FormData) => Promise<SupplierProductFormState>;
  defaults: SupplierProductEditDefaults;
}) {
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [dismissedDialogKey, setDismissedDialogKey] = useState("");
  const resultDialogKey = state.status === "idle" || !state.message ? "" : `${state.status}:${state.message}`;
  const resultDialogOpen = Boolean(resultDialogKey) && dismissedDialogKey !== resultDialogKey;

  return (
    <>
      <form
        action={formAction}
        encType="multipart/form-data"
        data-supplier-product-edit-form
        className="relative grid gap-3 rounded-xl border border-white/[0.08] bg-[#0f141b] p-5"
      >
        <SupplierFormStatusOverlay pending={pending} label="Saving changes" />
        <input type="hidden" name="slug" value={defaults.slug} />
        {defaults.updatedAt ? <input type="hidden" name="expected_updated_at" value={defaults.updatedAt} /> : null}
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Product name</span>
          <input
            name="name"
            required
            defaultValue={defaults.name}
            autoComplete="off"
            className="rounded-lg border border-white/[0.08] bg-[#0c1118] px-3 py-2 text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Category</span>
          <input
            name="category"
            defaultValue={defaults.category}
            className="rounded-lg border border-white/[0.08] bg-[#0c1118] px-3 py-2 text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Price (₹)</span>
          <input
            name="price"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={defaults.price}
            className="rounded-lg border border-white/[0.08] bg-[#0c1118] px-3 py-2 text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Short description</span>
          <span className="text-xs text-slate-500">Shown on catalog cards — defaults to product name if empty</span>
          <textarea
            name="tagline"
            rows={3}
            defaultValue={defaults.tagline}
            className="rounded-lg border border-white/[0.08] bg-[#0c1118] px-3 py-2 text-slate-100"
          />
        </label>

        <SupplierProductImageField
          defaults={{
            imageSrc: defaults.imageSrc,
            imageAlt: defaults.imageAlt || defaults.name
          }}
        />
        {state.status === "error" ? (
          <p
            ref={feedbackRef}
            role="alert"
            data-supplier-product-edit-feedback="error"
            className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-100"
          >
            {state.message}
          </p>
        ) : null}
        {state.status === "success" ? (
          <p
            role="status"
            data-supplier-product-edit-feedback="success"
            className="rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-3 py-2.5 text-sm text-emerald-100"
          >
            {state.message}
          </p>
        ) : null}
        <OperationalSubmitButton
          pendingLabel="Saving changes"
          className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save changes
        </OperationalSubmitButton>
      </form>

      <SupplierInlineResultDialog
        open={resultDialogOpen}
        status={state.status === "success" ? "success" : "error"}
        title={state.status === "success" ? "Product updated" : "Could not save product"}
        message={state.message}
        onPrimary={() => setDismissedDialogKey(resultDialogKey)}
      />
    </>
  );
}
