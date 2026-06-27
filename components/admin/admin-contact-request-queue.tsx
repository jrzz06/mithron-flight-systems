"use client";

import { Fragment, useState } from "react";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { StatusPill } from "@/components/platform";
import { relativeTimeLabel } from "@/lib/platform/copy";
import { formatContactRequestReference, type AdminContactRequestRow } from "@/lib/contact-requests/shared";

type ContactRequestActions = {
  markContacted: (formData: FormData) => Promise<void>;
  archive: (formData: FormData) => Promise<void>;
  reject: (formData: FormData) => Promise<void>;
  restore: (formData: FormData) => Promise<void>;
  linkToOrder: (formData: FormData) => Promise<void>;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function nextRequiredAction(request: AdminContactRequestRow) {
  const status = text(request.status, "new");
  if (status === "converted") return "Linked to order";
  if (status === "rejected") return "Rejected";
  if (status === "archived") return "Archived";
  if (status === "new") return "Contact customer";
  if (status === "contacted") return "Create or link order";
  return "Review";
}

function canMarkContacted(request: AdminContactRequestRow) {
  return text(request.status, "new") === "new";
}

function canLinkOrder(request: AdminContactRequestRow) {
  const status = text(request.status, "new");
  return ["contacted", "qualified", "new"].includes(status) && !text(request.converted_order_id);
}

function canArchive(request: AdminContactRequestRow) {
  return !["archived", "converted"].includes(text(request.status, "new"));
}

function canReject(request: AdminContactRequestRow) {
  return !["rejected", "converted"].includes(text(request.status, "new"));
}

function canRestore(request: AdminContactRequestRow) {
  return Boolean(request.archived_at) || text(request.status) === "rejected";
}

export function AdminContactRequestQueue({
  requests,
  actions
}: {
  requests: AdminContactRequestRow[];
  actions: ContactRequestActions;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!requests.length) {
    return (
      <p className="rounded-[8px] border border-dashed border-[var(--platform-border)] px-4 py-8 text-center text-sm text-[var(--platform-text-muted)]">
        No contact requests match this filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[8px] border border-[var(--platform-border)]">
      <table className="min-w-full text-sm" data-contact-request-queue>
        <thead className="sticky top-0 z-10 border-b border-[var(--platform-border)] bg-[var(--platform-surface-muted)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">Subject</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Next step</th>
            <th className="px-3 py-2 font-medium">Updated</th>
            <th className="px-3 py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => {
            const expanded = expandedId === request.id;
            const reference = formatContactRequestReference(request.request_number);
            return (
              <Fragment key={request.id}>
                <tr className="border-b border-[var(--platform-border)] hover:bg-[var(--platform-surface-muted)]/60">
                  <td className="px-3 py-3">
                    <p className="font-medium text-[var(--platform-text-primary)]">{text(request.customer_full_name, request.customer_email)}</p>
                    <p className="text-xs text-[var(--platform-text-muted)]">{request.customer_email}</p>
                  </td>
                  <td className="px-3 py-3 text-[var(--platform-text-secondary)]">{text(request.customer_phone, "—")}</td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-[var(--platform-text-primary)]">{reference}</p>
                    <p className="text-xs text-[var(--platform-text-muted)]">{request.subject}</p>
                  </td>
                  <td className="px-3 py-3"><StatusPill status={request.status} /></td>
                  <td className="px-3 py-3 text-[var(--platform-text-secondary)]">{nextRequiredAction(request)}</td>
                  <td className="px-3 py-3 text-[var(--platform-text-muted)]">{relativeTimeLabel(request.updated_at ?? request.created_at ?? "")}</td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="text-sm font-medium text-[var(--platform-accent)]"
                      onClick={() => setExpandedId(expanded ? null : request.id)}
                    >
                      {expanded ? "Hide" : "Manage"}
                    </button>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-[var(--platform-border)] bg-[var(--platform-surface-muted)]/40">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="grid gap-4">
                        <p className="whitespace-pre-wrap text-sm text-[var(--platform-text-secondary)]">{request.body}</p>
                        <div className="flex flex-wrap gap-2">
                          {canMarkContacted(request) ? (
                            <form action={actions.markContacted} className="flex items-end gap-2">
                              <input type="hidden" name="contact_request_id" value={request.id} />
                              <input
                                name="note"
                                placeholder="Contact note"
                                className="h-9 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm"
                              />
                              <OperationalSubmitButton pendingLabel="Saving..." className="platform-btn-primary h-9 px-3 text-sm">
                                Mark contacted
                              </OperationalSubmitButton>
                            </form>
                          ) : null}
                          {canLinkOrder(request) ? (
                            <form action={actions.linkToOrder} className="flex items-end gap-2">
                              <input type="hidden" name="contact_request_id" value={request.id} />
                              <input
                                name="order_id"
                                required
                                placeholder="Order id to link"
                                className="h-9 min-w-[220px] rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 text-sm"
                              />
                              <OperationalSubmitButton pendingLabel="Linking..." className="platform-btn-primary h-9 px-3 text-sm">
                                Link to order
                              </OperationalSubmitButton>
                            </form>
                          ) : null}
                          {canArchive(request) ? (
                            <form action={actions.archive}>
                              <input type="hidden" name="contact_request_id" value={request.id} />
                              <OperationalSubmitButton pendingLabel="Archiving..." className="h-9 rounded-[8px] border px-3 text-sm">
                                Archive
                              </OperationalSubmitButton>
                            </form>
                          ) : null}
                          {canReject(request) ? (
                            <form action={actions.reject}>
                              <input type="hidden" name="contact_request_id" value={request.id} />
                              <OperationalSubmitButton pendingLabel="Rejecting..." className="h-9 rounded-[8px] border border-rose-500/40 px-3 text-sm text-rose-700">
                                Reject
                              </OperationalSubmitButton>
                            </form>
                          ) : null}
                          {canRestore(request) ? (
                            <form action={actions.restore}>
                              <input type="hidden" name="contact_request_id" value={request.id} />
                              <OperationalSubmitButton pendingLabel="Restoring..." className="h-9 rounded-[8px] border px-3 text-sm">
                                Restore
                              </OperationalSubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
