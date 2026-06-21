"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

export function SupplierFeedbackDialog() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastKey = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"success" | "error">("success");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const productStatus = searchParams.get("product_status");
    if (productStatus !== "success" && productStatus !== "error") return;

    const productMessage = searchParams.get("product_message") ?? (productStatus === "success" ? "Action completed." : "Something went wrong.");
    const dedupeKey = `${productStatus}:${productMessage}`;
    if (lastKey.current === dedupeKey) return;

    lastKey.current = dedupeKey;
    setStatus(productStatus);
    setMessage(productMessage);
    setOpen(true);
  }, [searchParams]);

  function dismiss() {
    setOpen(false);
    const cleanedParams = new URLSearchParams(searchParams.toString());
    cleanedParams.delete("product_status");
    cleanedParams.delete("product_message");
    const cleanedQuery = cleanedParams.toString();
    router.replace(cleanedQuery ? `${pathname}?${cleanedQuery}` : pathname, { scroll: false });
  }

  if (!open) return null;

  const isSuccess = status === "success";
  const title = isSuccess
    ? message.toLowerCase().includes("submitted")
      ? "Submitted for approval"
      : "Product saved"
    : "Could not save product";

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4"
      role="presentation"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-feedback-title"
        aria-describedby="supplier-feedback-message"
        data-supplier-feedback-dialog
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
            <h2 id="supplier-feedback-title" className="text-lg font-semibold text-slate-100">
              {title}
            </h2>
            <p id="supplier-feedback-message" className="mt-2 text-sm text-slate-300">
              {message}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white ${
            isSuccess ? "bg-emerald-500 hover:bg-emerald-400" : "bg-rose-500 hover:bg-rose-400"
          }`}
        >
          OK
        </button>
      </div>
    </div>
  );
}
