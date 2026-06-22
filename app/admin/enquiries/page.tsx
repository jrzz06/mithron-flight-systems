import Link from "next/link";
import { assignEnquiryFormAction } from "./actions";
import { listAdminEnquiries } from "@/services/enquiries";

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function enquiryPhone(enquiry: Record<string, unknown>) {
  const payload = enquiry.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  return text((payload as Record<string, unknown>).customer_phone);
}

export default async function AdminEnquiriesPage() {
  const enquiries = await listAdminEnquiries();

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Customer enquiries</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Enquiry queue</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Contact form submissions and checkout product enquiries appear here. Checkout enquiries also create an order in the Orders workspace.
        </p>
      </div>

      <div className="grid gap-3">
        {enquiries.length ? enquiries.map((enquiry) => {
          const source = text(enquiry.source, "contact");
          const orderNumber = text(enquiry.order_number);
          const phone = enquiryPhone(enquiry);
          const canAssign = text(enquiry.status) === "new" && text(enquiry.queue_kind, "enquiry") === "enquiry";

          return (
            <article key={`${source}-${String(enquiry.id)}`} className="rounded-xl border border-slate-800 bg-[#10151d] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-100">{String(enquiry.subject)}</h2>
                    <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      {source === "checkout" ? "Checkout enquiry" : "Contact form"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{String(enquiry.customer_email)}</p>
                  {phone ? <p className="mt-1 text-sm text-slate-400">{phone}</p> : null}
                  {orderNumber ? (
                    <p className="mt-1 text-xs text-slate-500">Order reference: {orderNumber}</p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{String(enquiry.body)}</p>
                  <p className="mt-2 text-xs capitalize text-slate-500">Status: {String(enquiry.status)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {orderNumber ? (
                    <Link
                      href={`/admin/orders?order=${encodeURIComponent(orderNumber)}&queue=review`}
                      className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-slate-500"
                    >
                      View order
                    </Link>
                  ) : null}
                  {canAssign ? (
                    <form action={assignEnquiryFormAction} className="flex gap-2">
                      <input type="hidden" name="enquiry_id" value={String(enquiry.id)} />
                      <input type="hidden" name="assigned_to" value="" />
                      <button type="submit" className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white">
                        Mark contacted
                      </button>
                    </form>
                  ) : null}
                </div>
              </div>
            </article>
          );
        }) : (
          <p className="rounded-xl border border-slate-800 bg-[#10151d] p-6 text-sm text-slate-500">No enquiries yet.</p>
        )}
      </div>
    </div>
  );
}
