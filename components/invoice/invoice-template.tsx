import type { InvoiceData } from "@/lib/invoice/types";
import { renderInvoiceHtmlDocument } from "@/lib/invoice/render-invoice-html";

/** Server-friendly invoice template wrapper used by tests and regeneration flows. */
export function renderInvoiceTemplate(data: InvoiceData, options?: { showToolbar?: boolean }) {
  return renderInvoiceHtmlDocument(data, options);
}
