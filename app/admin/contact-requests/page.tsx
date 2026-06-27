import Link from "next/link";
import {
  archiveContactRequestFormAction,
  linkContactRequestToOrderFormAction,
  markContactRequestContactedFormAction,
  rejectContactRequestFormAction,
  restoreContactRequestFormAction
} from "@/app/admin/contact-requests/actions";
import { AdminContactRequestQueue } from "@/components/admin/admin-contact-request-queue";
import { EnquiryQueueLiveSync } from "@/components/admin/enquiry-queue-live-sync";
import { listAdminContactRequests } from "@/services/contact-requests";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const statusTabs = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "qualified", label: "Qualified" },
  { key: "converted", label: "Converted" },
  { key: "rejected", label: "Rejected" },
  { key: "archived", label: "Archived" }
] as const;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export default async function AdminContactRequestsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const [requests, policy] = await Promise.all([
    listAdminContactRequests(),
    getAdminSettingsPolicy()
  ]);
  const params = searchParams ? await searchParams : {};
  const statusFilter = searchValue(params, "status") || "all";
  const query = searchValue(params, "q").toLowerCase();
  const requestStatus = searchValue(params, "request_status");
  const requestMessage = searchValue(params, "request_message");

  const filtered = requests.filter((request) => {
    const status = text(request.status, "new");
    const matchesStatus = statusFilter === "all" || status === statusFilter;
    const haystack = `${text(request.customer_email)} ${text(request.subject)} ${text(request.body)}`.toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    return matchesStatus && matchesQuery;
  });

  return (
    <div className="grid gap-4" data-admin-contact-requests-page>
      <EnquiryQueueLiveSync enabled={policy.realtimeUpdatesEnabled} />

      {requestMessage ? (
        <div
          data-contact-request-feedback
          className={`rounded-[8px] border px-4 py-3 text-sm ${
            requestStatus === "error"
              ? "platform-feedback-error"
              : "platform-feedback-success"
          }`}
        >
          {requestMessage}
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2" aria-label="Contact request status filters">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.key;
          const href = `/admin/contact-requests?status=${tab.key}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
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

      <AdminContactRequestQueue
        requests={filtered}
        actions={{
          markContacted: markContactRequestContactedFormAction,
          archive: archiveContactRequestFormAction,
          reject: rejectContactRequestFormAction,
          restore: restoreContactRequestFormAction,
          linkToOrder: linkContactRequestToOrderFormAction
        }}
      />
    </div>
  );
}
