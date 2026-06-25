import Link from "next/link";
import {
  addEnquiryNoteFormAction,
  closeEnquiryFormAction,
  convertEnquiryToOrderFormAction,
  markEnquiryContactedFormAction,
  qualifyEnquiryFormAction,
  updateEnquiryMetaFormAction
} from "@/app/admin/enquiries/actions";
import { AdminEnquiryQueue } from "@/components/admin/admin-enquiry-queue";
import { EnquiryQueueLiveSync } from "@/components/admin/enquiry-queue-live-sync";
import { listAdminEnquiries } from "@/services/enquiries";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const statusTabs = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "converted", label: "Converted" },
  { key: "lost", label: "Closed" }
] as const;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export default async function AdminEnquiriesPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [enquiries, policy] = await Promise.all([
    listAdminEnquiries(),
    getAdminSettingsPolicy()
  ]);
  const params = searchParams ? await searchParams : {};
  const statusFilter = searchValue(params, "status") || "all";
  const query = searchValue(params, "q").toLowerCase();
  const enquiryStatus = searchValue(params, "enquiry_status");
  const enquiryMessage = searchValue(params, "enquiry_message");

  const filtered = enquiries.filter((enquiry) => {
    const status = text(enquiry.status, "new");
    const matchesStatus = statusFilter === "all" || status === statusFilter || (statusFilter === "lost" && status === "lost");
    const haystack = `${text(enquiry.customer_email)} ${text(enquiry.subject)} ${text(enquiry.body)}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="grid gap-4" data-admin-enquiries-page>
      <EnquiryQueueLiveSync enabled={policy.realtimeUpdatesEnabled} />

      {enquiryMessage ? (
        <div
          data-enquiry-feedback
          className={`rounded-[8px] border px-4 py-3 text-sm ${
            enquiryStatus === "error"
              ? "border-rose-500/30 bg-rose-950/20 text-rose-100"
              : "border-emerald-500/30 bg-emerald-950/20 text-emerald-100"
          }`}
        >
          {enquiryMessage}
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2" aria-label="Enquiry status filters">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.key;
          const href = `/admin/enquiries?status=${tab.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`rounded-[8px] border px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-[var(--platform-accent)]/40 bg-[var(--platform-accent-soft)] text-[var(--platform-text-primary)]"
                  : "border-[var(--platform-border)] text-[var(--platform-text-secondary)] hover:bg-[var(--platform-surface-muted)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="status" value={statusFilter} />
        <label className="grid flex-1 gap-1 text-sm">
          <span className="text-[var(--platform-text-muted)]">Search</span>
          <input
            name="q"
            defaultValue={query}
            placeholder="Email, subject, or message"
            className="h-9 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-3 text-sm text-[var(--platform-text-primary)]"
          />
        </label>
        <button type="submit" className="platform-btn-primary h-9 rounded-[8px] px-4 text-sm font-medium">Search</button>
      </form>

      <AdminEnquiryQueue
        enquiries={filtered}
        actions={{
          markContacted: markEnquiryContactedFormAction,
          qualify: qualifyEnquiryFormAction,
          addNote: addEnquiryNoteFormAction,
          convert: convertEnquiryToOrderFormAction,
          close: closeEnquiryFormAction,
          updateMeta: updateEnquiryMetaFormAction
        }}
      />
    </div>
  );
}
