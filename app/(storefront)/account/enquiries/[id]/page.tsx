import Link from "next/link";
import { createClient } from "@/lib/server";
import { redirect, notFound } from "next/navigation";
import { formatEnquiryReference, getOwnEnquiryById } from "@/services/enquiries";
import { enquiryCartLines, enquiryMessageText, type AdminEnquiryRow } from "@/lib/enquiries/shared";
import { humanStatus } from "@/lib/platform/copy";

export default async function AccountEnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) redirect("/login?next=/account/enquiries");

  const { id } = await params;
  const enquiry = await getOwnEnquiryById(userId, id);
  if (!enquiry) notFound();

  const enquiryNumber = typeof enquiry.enquiry_number === "number" ? enquiry.enquiry_number : Number(enquiry.enquiry_number);
  const reference = Number.isFinite(enquiryNumber) && enquiryNumber > 0
    ? formatEnquiryReference(enquiryNumber)
    : String(enquiry.subject ?? "Enquiry");
  const timeline = Array.isArray(enquiry.timeline) ? enquiry.timeline : [];
  const convertedOrderId = String(enquiry.converted_order_id ?? "");
  const cartLines = enquiryCartLines(enquiry as AdminEnquiryRow);
  const message = enquiryMessageText(enquiry as AdminEnquiryRow);

  return (
    <div className="rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-8">
      <Link href="/account/enquiries" className="text-sm text-emerald-400">Back to enquiries</Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="type-section">{reference}</h2>
        <span className="text-xs uppercase tracking-[0.12em] text-emerald-400">{humanStatus(String(enquiry.status))}</span>
      </div>
      <p className="mt-2 text-sm text-white/60">{String(enquiry.subject)}</p>

      {cartLines.length ? (
        <div className="mt-6 grid gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/50">Requested products</h3>
          {cartLines.map((line) => (
            <div
              key={`${line.product_slug}-${line.product_name}`}
              className="flex items-center justify-between rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 py-3 text-sm"
            >
              <span className="text-white">{line.product_name}</span>
              <span className="text-white/50">Qty {line.quantity}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/50">Your message</h3>
        <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 py-3 text-sm leading-relaxed text-white/80">
          {message || "—"}
        </p>
      </div>

      {convertedOrderId ? (
        <div className="mt-6">
          <Link href={`/account/orders/${encodeURIComponent(convertedOrderId)}`} className="text-sm font-medium text-emerald-400">
            View linked order
          </Link>
        </div>
      ) : null}

      {timeline.length ? (
        <div className="mt-8 grid gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white/50">Status timeline</h3>
          {timeline.map((entry, index) => (
            <div key={`${entry.at}-${index}`} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 py-3 text-sm text-white/70">
              <p>{entry.summary}</p>
              <p className="mt-1 text-xs text-white/40">{String(entry.at).slice(0, 19).replace("T", " ")}</p>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-6 text-xs text-white/40">Submitted {String(enquiry.created_at ?? "").slice(0, 10)}</p>
    </div>
  );
}
