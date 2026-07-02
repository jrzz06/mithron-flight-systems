"use client";

import { useControlPlaneLiveSync } from "@/components/control-plane/use-control-plane-live-sync";

const ENQUIRY_TABLES = new Set(["enquiries", "orders", "contact_requests", "notifications"]);

export function EnquiryQueueLiveSync({ enabled = true }: { enabled?: boolean }) {
  useControlPlaneLiveSync(
    "admin",
    (table) => ENQUIRY_TABLES.has(table),
    enabled
  );

  if (!enabled) return null;

  return <div data-enquiry-live-sync className="sr-only" aria-hidden="true" />;
}
