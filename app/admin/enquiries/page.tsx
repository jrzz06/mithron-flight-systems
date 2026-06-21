import { assignEnquiryFormAction } from "./actions";
import { listAdminEnquiries } from "@/services/enquiries";

export default async function AdminEnquiriesPage() {
  const enquiries = await listAdminEnquiries();

  return (
    <div className="grid gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Customer enquiries</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-100">Enquiry queue</h1>
      </div>

      <div className="grid gap-3">
        {enquiries.length ? enquiries.map((enquiry) => (
          <article key={String(enquiry.id)} className="rounded-xl border border-slate-800 bg-[#10151d] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{String(enquiry.subject)}</h2>
                <p className="mt-1 text-sm text-slate-400">{String(enquiry.customer_email)}</p>
                <p className="mt-2 text-sm text-slate-300">{String(enquiry.body)}</p>
                <p className="mt-2 text-xs capitalize text-slate-500">Status: {String(enquiry.status)}</p>
              </div>
              {String(enquiry.status) === "new" ? (
                <form action={assignEnquiryFormAction} className="flex gap-2">
                  <input type="hidden" name="enquiry_id" value={String(enquiry.id)} />
                  <input type="hidden" name="assigned_to" value="" />
                  <button type="submit" className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white">
                    Mark contacted
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        )) : (
          <p className="rounded-xl border border-slate-800 bg-[#10151d] p-6 text-sm text-slate-500">No enquiries yet.</p>
        )}
      </div>
    </div>
  );
}
