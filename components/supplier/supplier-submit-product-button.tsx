"use client";

import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";

type SupplierSubmitProductButtonProps = {
  label?: string;
  className?: string;
  variant?: "link" | "button";
};

export function SupplierSubmitProductButton({
  label = "Submit for approval",
  className,
  variant = "link"
}: SupplierSubmitProductButtonProps) {
  const resolvedClassName =
    className ??
    (variant === "button"
      ? "mt-4 rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      : "text-emerald-300 hover:underline");

  return (
    <OperationalSubmitButton
      confirmMessage="Submit this product to admin for approval?"
      pendingLabel="Submitting"
      className={resolvedClassName}
    >
      {label}
    </OperationalSubmitButton>
  );
}
