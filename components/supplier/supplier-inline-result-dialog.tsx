"use client";

import { CheckCircle2, XCircle } from "lucide-react";

export function SupplierInlineResultDialog({
  open,
  status,
  title,
  message,
  primaryLabel = "OK",
  secondaryLabel,
  onPrimary,
  onSecondary
}: {
  open: boolean;
  status: "success" | "error";
  title: string;
  message: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
}) {
  if (!open) return null;

  const isSuccess = status === "success";

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/60 p-4"
      role="presentation"
      onClick={onPrimary}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-inline-result-title"
        aria-describedby="supplier-inline-result-message"
        data-supplier-inline-result-dialog
        className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0f141b] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          {isSuccess ? (
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-400" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <h2 id="supplier-inline-result-title" className="text-lg font-semibold text-slate-100">
              {title}
            </h2>
            <p id="supplier-inline-result-message" className="mt-2 text-sm text-slate-300">
              {message}
            </p>
          </div>
        </div>
        <div className={`mt-6 grid gap-2 ${secondaryLabel ? "grid-cols-2" : "grid-cols-1"}`}>
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-lg border border-white/[0.12] px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.04]"
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPrimary}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${
              isSuccess ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"
            }`}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
