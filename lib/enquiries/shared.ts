type JsonRecord = Record<string, unknown>;

export type EnquiryTimelineEntry = {
  at: string;
  action: string;
  actor_id: string | null;
  summary: string;
  status?: string;
};

export type EnquiryNoteEntry = {
  id: string;
  at: string;
  actor_id: string;
  body: string;
};

export type AdminEnquiryRow = JsonRecord & {
  id: string;
  enquiry_number?: number | null;
  customer_email: string;
  subject: string;
  body: string;
  status: string;
  source: "contact" | "checkout";
  queue_kind: "enquiry" | "checkout_order";
  order_number?: string;
  timeline?: EnquiryTimelineEntry[];
  notes?: EnquiryNoteEntry[];
};

export function formatEnquiryReference(enquiryNumber: number | string | null | undefined) {
  const parsed = typeof enquiryNumber === "number" ? enquiryNumber : Number(enquiryNumber);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Enquiry";
  return `Enquiry #${parsed}`;
}
