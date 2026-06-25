import Link from "next/link";
import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";
import { formatEnquiryReference, listOwnEnquiries } from "@/services/enquiries";
import { humanStatus } from "@/lib/platform/copy";

export default async function AccountEnquiriesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) redirect("/login?next=/account/enquiries");

  const enquiries = await listOwnEnquiries(userId);

  return (
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-section">Your enquiries</h2>
        <Link href="/contact" className="text-sm text-emerald-400">New enquiry</Link>
      </div>
      <div className="mt-6 grid gap-3">
        {enquiries.length ? enquiries.map((enquiry) => (
          <Link key={String(enquiry.id)} href={`/account/enquiries/${encodeURIComponent(String(enquiry.id))}`}>
          <article className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] p-4 transition hover:border-emerald-400/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-white">
                  {typeof enquiry.enquiry_number === "number" && enquiry.enquiry_number > 0
                    ? formatEnquiryReference(enquiry.enquiry_number)
                    : String(enquiry.subject)}
                </p>
                {typeof enquiry.enquiry_number === "number" && enquiry.enquiry_number > 0 ? (
                  <p className="mt-1 text-sm text-white/60">{String(enquiry.subject)}</p>
                ) : null}
              </div>
              <span className="text-xs uppercase tracking-[0.12em] text-emerald-400">{humanStatus(String(enquiry.status))}</span>
            </div>
            <p className="mt-2 text-sm text-white/70">{String(enquiry.body).slice(0, 180)}</p>
            {Array.isArray(enquiry.timeline) && enquiry.timeline.length ? (
              <div className="mt-3 grid gap-1 text-xs text-white/50">
                {enquiry.timeline.slice(0, 3).map((entry, index) => (
                  <p key={`${entry.at}-${index}`}>{entry.summary}</p>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-xs text-white/40">{String(enquiry.created_at ?? "").slice(0, 10)}</p>
          </article>
          </Link>
        )) : (
          <p className="text-sm text-white/60">No enquiries yet. <Link href="/contact" className="text-emerald-400">Contact us</Link></p>
        )}
      </div>
    </div>
  );
}
