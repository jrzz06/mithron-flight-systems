export type ContactRequestTimelineEntry = {
  at: string;
  action: string;
  actor_id: string | null;
  summary: string;
  status?: string;
};

export type ContactRequestNoteEntry = {
  id: string;
  at: string;
  actor_id: string;
  body: string;
};

export type AdminContactRequestRow = {
  id: string;
  request_number: number | null;
  customer_email: string;
  customer_full_name?: string;
  customer_company?: string;
  customer_phone?: string;
  subject: string;
  body: string;
  status: string;
  assigned_to?: string | null;
  converted_order_id?: string | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
  deleted_at?: string | null;
  timeline: ContactRequestTimelineEntry[];
  notes: ContactRequestNoteEntry[];
};

export function formatContactRequestReference(requestNumber: number | string | null | undefined) {
  const parsed = typeof requestNumber === "number" ? requestNumber : Number(requestNumber);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Request";
  return `Request #${parsed}`;
}
