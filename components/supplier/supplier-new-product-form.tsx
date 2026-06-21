"use client";

import { useActionState, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { SupplierFormDebugPanel } from "@/components/supplier/supplier-form-debug-panel";
import { SupplierFormStatusOverlay } from "@/components/supplier/supplier-form-status-overlay";
import { SupplierInlineResultDialog } from "@/components/supplier/supplier-inline-result-dialog";
import { SupplierProductImageField } from "@/components/supplier/supplier-product-image-field";
import { isSupplierProductFormDebugEnabled } from "@/lib/supplier/product-form-debug";

export type SupplierProductFormState = {
  status: "idle" | "success" | "error";
  message: string;
  debug?: Array<{ label: string; value: string }>;
};

const initialState: SupplierProductFormState = { status: "idle", message: "" };

function fieldLabelFromInvalidTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return "Form field";
  }
  const labelledBy = target.labels?.[0]?.textContent?.trim();
  return labelledBy || target.name || target.type || "Form field";
}

export function SupplierNewProductForm({
  action
}: {
  action: (prevState: SupplierProductFormState, formData: FormData) => Promise<SupplierProductFormState>;
}) {
  const searchParams = useSearchParams();
  const debugEnabled = isSupplierProductFormDebugEnabled(searchParams);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const [state, formAction, pending] = useActionState(action, initialState);
  const [pendingLabel, setPendingLabel] = useState("Saving draft");
  const [dismissedErrorMessage, setDismissedErrorMessage] = useState("");
  const [clientValidationError, setClientValidationError] = useState("");
  const [lastSubmittedFields, setLastSubmittedFields] = useState<Record<string, string>>({});
  const errorDialogOpen = state.status === "error" && Boolean(state.message) && dismissedErrorMessage !== state.message;

  function handleInvalid(event: React.FormEvent<HTMLFormElement>) {
    const target = event.target;
    const label = fieldLabelFromInvalidTarget(target);
    const message =
      target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
        ? target.validationMessage
        : "Please complete all required fields.";
    const nextError = `${label}: ${message}`;
    setClientValidationError(nextError);
    if (debugEnabled) {
      console.info("[supplier-product-form] client validation blocked submit", { label, message });
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    setClientValidationError("");
    const formData = new FormData(event.currentTarget);
    const entries = Object.fromEntries(formData.entries());
    setLastSubmittedFields(Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, String(value)])));
    if (debugEnabled) {
      console.info("[supplier-product-form] client submit", entries);
    }
  }

  const debugEntries = [
    ...(debugEnabled
      ? [
          { label: "Debug mode", value: "enabled (?product_debug=1 or SUPPLIER_PRODUCT_FORM_DEBUG=1)" },
          { label: "Last client FormData", value: JSON.stringify(lastSubmittedFields, null, 2) || "(none yet)" },
          { label: "Action pending", value: String(pending) },
          { label: "Action state", value: JSON.stringify({ status: state.status, message: state.message }, null, 2) }
        ]
      : []),
    ...(state.debug ?? [])
  ];

  return (
    <>
      {debugEnabled ? <SupplierFormDebugPanel entries={debugEntries} /> : null}

      <form
        action={formAction}
        onInvalid={handleInvalid}
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        data-supplier-product-create-form
        className="relative grid gap-3 rounded-xl border border-white/[0.08] bg-[#0f141b] p-5"
      >
        <SupplierFormStatusOverlay pending={pending} label={pendingLabel} />

        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Product name</span>
          <input
            name="name"
            required
            autoComplete="off"
            placeholder="Agri spray drone kit"
            className="rounded-lg border border-white/[0.08] bg-[#0c1118] px-3 py-2 text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Slug</span>
          <input
            name="slug"
            autoComplete="off"
            placeholder="Leave empty to auto-generate from name"
            className="rounded-lg border border-white/[0.08] bg-[#0c1118] px-3 py-2 text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Category</span>
          <input
            name="category"
            defaultValue="Agri Drones"
            className="rounded-lg border border-white/[0.08] bg-[#0c1118] px-3 py-2 text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Price (INR)</span>
          <input
            name="price"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="49999"
            className="rounded-lg border border-white/[0.08] bg-[#0c1118] px-3 py-2 text-slate-100"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-slate-300">Short description</span>
          <span className="text-xs text-slate-500">Shown on catalog cards — defaults to product name if empty</span>
          <textarea
            name="tagline"
            rows={3}
            placeholder="Brief summary for shoppers and admin review"
            className="rounded-lg border border-white/[0.08] bg-[#0c1118] px-3 py-2 text-slate-100"
          />
        </label>

        <SupplierProductImageField />

        {clientValidationError ? (
          <p
            role="alert"
            data-supplier-product-create-feedback="validation"
            className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2.5 text-sm text-amber-100"
          >
            {clientValidationError}
          </p>
        ) : null}

        {state.status === "error" ? (
          <p
            ref={feedbackRef}
            role="alert"
            data-supplier-product-create-feedback="error"
            className="rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2.5 text-sm text-rose-100"
          >
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <OperationalSubmitButton
            pendingLabel="Saving draft"
            name="submit_for_approval"
            value="0"
            onClick={() => setPendingLabel("Saving draft")}
            className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Save draft
          </OperationalSubmitButton>
          <OperationalSubmitButton
            pendingLabel="Submitting"
            confirmMessage="Save this product and send it to admin for approval?"
            name="submit_for_approval"
            value="1"
            onClick={() => setPendingLabel("Saving and submitting for approval")}
            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-60"
          >
            Save & submit for approval
          </OperationalSubmitButton>
        </div>
      </form>

      <SupplierInlineResultDialog
        open={errorDialogOpen}
        status="error"
        title="Product not saved"
        message={state.message || clientValidationError || "Could not save product draft. Check the form and try again."}
        onPrimary={() => setDismissedErrorMessage(state.message)}
      />
    </>
  );
}
