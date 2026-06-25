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

export type EnquiryCartLine = {
  product_slug: string;
  product_name: string;
  quantity: number;
  sku?: string | null;
};

export type AdminEnquiryRow = JsonRecord & {
  id: string;
  enquiry_number?: number | null;
  customer_email: string;
  customer_full_name?: string;
  customer_company?: string;
  customer_phone?: string;
  subject: string;
  body: string;
  status: string;
  source: "contact" | "checkout";
  queue_kind: "enquiry" | "checkout_order";
  order_number?: string;
  order_id?: string | null;
  related_product_slug?: string | null;
  cart_lines?: EnquiryCartLine[];
  enquiry_message?: string;
  priority?: string;
  assigned_staff?: string;
  follow_up_date?: string;
  timeline?: EnquiryTimelineEntry[];
  notes?: EnquiryNoteEntry[];
  created_at?: string;
  updated_at?: string;
};

export function formatEnquiryReference(enquiryNumber: number | string | null | undefined) {
  const parsed = typeof enquiryNumber === "number" ? enquiryNumber : Number(enquiryNumber);
  if (!Number.isFinite(parsed) || parsed <= 0) return "Enquiry";
  return `Enquiry #${parsed}`;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function readEnquiryPayload(payload: unknown): JsonRecord {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as JsonRecord
    : {};
}

export function enquiryPayloadString(payload: JsonRecord, key: string) {
  return text(payload[key]);
}

export function enquiryCustomerName(enquiry: AdminEnquiryRow) {
  return text(enquiry.customer_full_name)
    || enquiryPayloadString(readEnquiryPayload(enquiry.payload), "customer_full_name")
    || text(enquiry.customer_email, "Customer");
}

export function enquiryCustomerPhone(enquiry: AdminEnquiryRow) {
  return text(enquiry.customer_phone)
    || enquiryPayloadString(readEnquiryPayload(enquiry.payload), "customer_phone");
}

export function enquiryCustomerCompany(enquiry: AdminEnquiryRow) {
  return text(enquiry.customer_company)
    || enquiryPayloadString(readEnquiryPayload(enquiry.payload), "customer_company");
}

export function enquiryCartLines(enquiry: AdminEnquiryRow): EnquiryCartLine[] {
  if (Array.isArray(enquiry.cart_lines) && enquiry.cart_lines.length) {
    return enquiry.cart_lines;
  }
  const payload = readEnquiryPayload(enquiry.payload);
  const raw = payload.cart_lines;
  if (!Array.isArray(raw)) {
    const summary = text(payload.item_summary);
    if (!summary) return [];
    return summary.split(",").map((part) => {
      const match = part.trim().match(/^(.*)\s+x\s+(\d+)$/i);
      if (!match) return null;
      return {
        product_slug: "",
        product_name: match[1].trim(),
        quantity: Number(match[2]) || 1
      };
    }).filter((line): line is EnquiryCartLine => Boolean(line));
  }
  return raw
    .filter((line) => line && typeof line === "object" && !Array.isArray(line))
    .map((line) => {
      const record = line as JsonRecord;
      return {
        product_slug: text(record.product_slug),
        product_name: text(record.product_name, text(record.product_slug, "Item")),
        quantity: Number(record.quantity ?? 1) || 1,
        sku: text(record.sku) || null
      };
    })
    .filter((line) => line.product_name || line.product_slug);
}

export function enquiryMessageText(enquiry: AdminEnquiryRow) {
  const fromField = text(enquiry.enquiry_message);
  if (fromField) return fromField;
  const payload = readEnquiryPayload(enquiry.payload);
  const fromPayload = text(payload.enquiry_message);
  if (fromPayload) return fromPayload;
  const body = text(enquiry.body);
  const cartMarker = "\n\nCart:";
  const markerIndex = body.indexOf(cartMarker);
  if (markerIndex >= 0) return body.slice(0, markerIndex).trim();
  return body;
}

export function enquiryProductLabel(enquiry: AdminEnquiryRow) {
  const lines = enquiryCartLines(enquiry);
  if (lines.length === 1) {
    return `${lines[0].product_name} × ${lines[0].quantity}`;
  }
  if (lines.length > 1) {
    return `${lines[0].product_name} + ${lines.length - 1} more`;
  }
  return text(enquiry.related_product_slug) || text(enquiry.subject, "General enquiry");
}

export function formatEnquiryDateTime(value: unknown) {
  const raw = text(value);
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 16);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
