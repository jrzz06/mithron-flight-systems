import { notFound, redirect } from "next/navigation";
import { InvoiceHtmlViewer } from "@/components/invoice/invoice-html-viewer";
import { getStoredInvoiceHtml } from "@/lib/invoice/generate-invoice";
import { createClient } from "@/lib/server";
import { getCustomerOrder } from "@/services/customer-orders";

export default async function AccountOrderInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) redirect(`/login?next=/account/orders/${id}/invoice`);

  const detail = await getCustomerOrder(userId, id);
  if (!detail) notFound();

  if (String(detail.payment?.status ?? detail.order.payment_status ?? "") !== "succeeded") {
    notFound();
  }

  const invoiceHtml = await getStoredInvoiceHtml(id);
  if (!invoiceHtml) notFound();

  return <InvoiceHtmlViewer html={invoiceHtml} />;
}
