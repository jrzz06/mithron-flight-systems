"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Toaster, toast } from "sonner";

const statusKeys = [
  "product_status",
  "inventory_status",
  "order_status",
  "media_status",
  "cms_status",
  "operation_status",
  "warehouse_status",
  "shipment_status",
  "request_status",
  "task_status",
  "notification_status",
  "user_status"
] as const;

function messageKeyFor(statusKey: string) {
  return statusKey.replace(/_status$/, "_message");
}

function toastTitle(statusKey: string) {
  return statusKey
    .replace(/_status$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function OperatorToastBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const lastToastKey = useRef<string | null>(null);

  useEffect(() => {
    for (const statusKey of statusKeys) {
      const status = searchParams.get(statusKey);
      if (!status) continue;

      const message = searchParams.get(messageKeyFor(statusKey)) ?? "Action completed.";
      const dedupeKey = `${statusKey}:${status}:${message}`;
      if (lastToastKey.current === dedupeKey) return;

      lastToastKey.current = dedupeKey;
      const title = toastTitle(statusKey);
      const cleanedParams = new URLSearchParams(searchParams.toString());
      cleanedParams.delete(statusKey);
      cleanedParams.delete(messageKeyFor(statusKey));
      if (statusKey === "cms_status") {
        cleanedParams.delete("cms_table");
      }
      const cleanedQuery = cleanedParams.toString();
      const cleanedUrl = cleanedQuery ? `${pathname}?${cleanedQuery}` : pathname;

      if (status === "success") {
        toast.success(title, { description: message });
        router.replace(cleanedUrl, { scroll: false });
        return;
      }

      if (status === "warning") {
        toast.warning(title, { description: message });
        router.replace(cleanedUrl, { scroll: false });
        return;
      }

      toast.error(title, { description: message });
      router.replace(cleanedUrl, { scroll: false });
      return;
    }
  }, [pathname, router, searchParams]);

  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        className: "border-white/10 bg-[#080b0d] text-white",
        duration: 4200
      }}
    />
  );
}
