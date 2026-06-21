"use client";

import { Loader2 } from "lucide-react";

export function SupplierFormStatusOverlay({ pending, label = "Saving draft" }: { pending: boolean; label?: string }) {
  if (!pending) return null;

  return (
    <div
      className="absolute inset-0 z-10 grid place-items-center rounded-xl bg-[#0f141b]/80 backdrop-blur-[2px]"
      role="status"
      aria-live="polite"
      data-supplier-form-pending
    >
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#0c1118] px-4 py-3 text-sm text-slate-100">
        <Loader2 className="h-4 w-4 animate-spin text-violet-300" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
}
