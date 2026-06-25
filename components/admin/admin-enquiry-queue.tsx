"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { StatusPill } from "@/components/platform";
import { relativeTimeLabel } from "@/lib/platform/copy";
import { formatEnquiryReference, type AdminEnquiryRow } from "@/lib/enquiries/shared";

type EnquiryActions = {
  markContacted: (formData: FormData) => Promise<void>;
  qualify: (formData: FormData) => Promise<void>;
  addNote: (formData: FormData) => Promise<void>;
  convert: (formData: FormData) => Promise<void>;
  close: (formData: FormData) => Promise<void>;
  updateMeta: (formData: FormData) => Promise<void>;
};

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function enquiryPhone(enquiry: AdminEnquiryRow) {
  const payload = enquiry.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  return text((payload as Record<string, unknown>).customer_phone);
}

function enquiryMeta(enquiry: AdminEnquiryRow, key: string) {
  const payload = enquiry.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  return text((payload as Record<string, unknown>)[key]);
}

function enquiryProduct(enquiry: AdminEnquiryRow) {
  const fromPayload = enquiryMeta(enquiry, "product_slug") || enquiryMeta(enquiry, "product_name");
  if (fromPayload) return fromPayload;
  return text(enquiry.subject, "General enquiry");
}

function nextRequiredAction(enquiry: AdminEnquiryRow) {
  const status = text(enquiry.status, "new");
  if (status === "converted") return "Order created";
  if (status === "lost") return "Closed";
  if (status === "new") return "Contact customer";
  if (status === "contacted") return "Qualify or close";
  if (status === "qualified") return "Convert to order";
  return "Review";
}

function canMarkContacted(enquiry: AdminEnquiryRow) {
  return text(enquiry.status, "new") === "new";
}

function canQualify(enquiry: AdminEnquiryRow) {
  return ["new", "contacted"].includes(text(enquiry.status, "new"));
}

function canAddNote(enquiry: AdminEnquiryRow) {
  return text(enquiry.queue_kind, "enquiry") === "enquiry" && Boolean(text(enquiry.id));
}

function canConvert(enquiry: AdminEnquiryRow) {
  const status = text(enquiry.status, "new");
  return ["qualified", "contacted", "won"].includes(status) && !["converted", "lost"].includes(status);
}

function canClose(enquiry: AdminEnquiryRow) {
  const status = text(enquiry.status, "new");
  return !["converted", "lost"].includes(status);
}

export function AdminEnquiryQueue({
  enquiries,
  actions
}: {
  enquiries: AdminEnquiryRow[];
  actions: EnquiryActions;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!enquiries.length) {
    return (
      <p className="rounded-[8px] border border-dashed border-[var(--platform-border)] px-4 py-8 text-center text-sm text-[var(--platform-text-muted)]">
        No enquiries match this filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[8px] border border-[var(--platform-border)]">
      <table className="min-w-full text-sm" data-enquiry-queue>
        <thead className="sticky top-0 z-10 border-b border-[var(--platform-border)] bg-[var(--platform-surface-muted)] text-left text-[11px] uppercase tracking-[0.06em] text-[var(--platform-text-muted)]">
          <tr>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Phone</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Product</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Next action</th>
            <th className="px-3 py-2 font-medium">Waiting</th>
            <th className="px-3 py-2 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {enquiries.map((enquiry) => {
            const id = String(enquiry.id);
            const expanded = expandedId === id;
            const source = text(enquiry.source, "contact");
            const orderNumber = text(enquiry.order_number);
            const queueKind = text(enquiry.queue_kind, "enquiry");
            const reference = enquiry.enquiry_number ? formatEnquiryReference(enquiry.enquiry_number) : text(enquiry.subject, "Enquiry");
            const notes = Array.isArray(enquiry.notes) ? enquiry.notes : [];
            const timeline = Array.isArray(enquiry.timeline) ? enquiry.timeline : [];

            return (
              <Fragment key={id}>
                <tr data-enquiry-row data-enquiry-status={text(enquiry.status, "new")} className="border-b border-[var(--platform-border)]">
                  <td className="px-3 py-2.5 font-medium text-[var(--platform-text-primary)]">{text(enquiry.customer_email, "—")}</td>
                  <td className="px-3 py-2.5 text-[var(--platform-text-secondary)]">{enquiryPhone(enquiry) || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className="rounded-md border border-[var(--platform-border)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--platform-text-muted)]">
                      {source === "checkout" ? "Checkout" : "Contact"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--platform-text-secondary)]">{enquiryProduct(enquiry)}</td>
                  <td className="px-3 py-2.5"><StatusPill status={text(enquiry.status, "new")} /></td>
                  <td className="px-3 py-2.5 text-xs font-medium text-[var(--platform-text-primary)]">{nextRequiredAction(enquiry)}</td>
                  <td className="px-3 py-2.5 text-xs text-[var(--platform-text-muted)]">{relativeTimeLabel(text(enquiry.created_at))}</td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : id)}
                      className="text-xs font-medium text-[var(--platform-accent)]"
                    >
                      {expanded ? "Close" : canConvert(enquiry) ? "Review" : "Open"}
                    </button>
                  </td>
                </tr>
                {expanded ? (
                  <tr className="border-b border-[var(--platform-border)] bg-[var(--platform-surface-muted)]">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--platform-border)] pb-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--platform-text-primary)]">{reference}</p>
                          <p className="text-xs text-[var(--platform-text-muted)]">{text(enquiry.customer_email)} · {enquiryProduct(enquiry)}</p>
                        </div>
                        <p className="text-xs font-medium text-[var(--platform-accent)]">Next: {nextRequiredAction(enquiry)}</p>
                      </div>
                      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="grid gap-3">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--platform-text-secondary)]">{text(enquiry.body)}</p>
                          {orderNumber ? (
                            <Link href={`/admin/orders?order=${encodeURIComponent(orderNumber)}&queue=review`} className="text-sm text-[var(--platform-accent)]">
                              Linked order {orderNumber}
                            </Link>
                          ) : null}
                          {notes.length ? (
                            <div className="grid gap-2">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">Internal notes</p>
                              {notes.slice(0, 4).map((note) => (
                                <div key={note.id} className="rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-sm text-[var(--platform-text-secondary)]">
                                  {note.body}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {timeline.length ? (
                            <div className="grid gap-1">
                              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--platform-text-muted)]">Timeline</p>
                              {timeline.slice(0, 6).map((entry, index) => (
                                <div key={`${entry.at}-${index}`} className="flex justify-between gap-2 text-xs text-[var(--platform-text-muted)]">
                                  <span>{entry.summary}</span>
                                  <span>{relativeTimeLabel(entry.at)}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="grid gap-3">
                          {queueKind === "enquiry" ? (
                            <form action={actions.updateMeta} className="grid gap-2 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] p-3">
                              <input type="hidden" name="enquiry_id" value={id} />
                              <label className="grid gap-1 text-xs text-[var(--platform-text-muted)]">
                                Priority
                                <select name="priority" defaultValue={enquiryMeta(enquiry, "priority") || "normal"} className="h-9 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-2 text-sm">
                                  <option value="low">Low</option>
                                  <option value="normal">Normal</option>
                                  <option value="high">High</option>
                                </select>
                              </label>
                              <label className="grid gap-1 text-xs text-[var(--platform-text-muted)]">
                                Assigned staff
                                <input name="assigned_to" defaultValue={enquiryMeta(enquiry, "assigned_to")} placeholder="Name or email" className="h-9 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-2 text-sm" />
                              </label>
                              <label className="grid gap-1 text-xs text-[var(--platform-text-muted)]">
                                Follow-up date
                                <input name="follow_up_date" type="date" defaultValue={enquiryMeta(enquiry, "follow_up_date")} className="h-9 rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-2 text-sm" />
                              </label>
                              <OperationalSubmitButton pendingLabel="Saving" className="platform-btn-primary h-9 rounded-[8px] px-3 text-xs font-medium">Save details</OperationalSubmitButton>
                            </form>
                          ) : null}

                          {canMarkContacted(enquiry) ? (
                            <form action={actions.markContacted} className="grid gap-2">
                              <input type="hidden" name="enquiry_id" value={id} />
                              <input type="hidden" name="order_id" value={queueKind === "checkout_order" ? id : ""} />
                              <input type="hidden" name="queue_kind" value={queueKind} />
                              <textarea name="note" rows={2} placeholder="Contact notes (optional)" className="rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-sm" />
                              <OperationalSubmitButton pendingLabel="Saving" className="platform-btn-primary h-9 rounded-[8px] px-3 text-xs font-medium">Mark contacted</OperationalSubmitButton>
                            </form>
                          ) : null}

                          {canQualify(enquiry) && canAddNote(enquiry) ? (
                            <form action={actions.qualify}>
                              <input type="hidden" name="enquiry_id" value={id} />
                              <OperationalSubmitButton pendingLabel="Updating" className="h-9 w-full rounded-[8px] border border-[var(--platform-border)] px-3 text-xs font-medium">Mark qualified</OperationalSubmitButton>
                            </form>
                          ) : null}

                          {canAddNote(enquiry) ? (
                            <form action={actions.addNote} className="grid gap-2">
                              <input type="hidden" name="enquiry_id" value={id} />
                              <textarea name="note" rows={2} required placeholder="Add internal note" className="rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-sm" />
                              <OperationalSubmitButton pendingLabel="Saving" className="h-9 rounded-[8px] border border-[var(--platform-border)] px-3 text-xs font-medium">Save note</OperationalSubmitButton>
                            </form>
                          ) : null}

                          {canConvert(enquiry) ? (
                            <form action={actions.convert}>
                              <input type="hidden" name="enquiry_id" value={id} />
                              <input type="hidden" name="order_id" value={queueKind === "checkout_order" ? id : ""} />
                              <input type="hidden" name="queue_kind" value={queueKind} />
                              <OperationalSubmitButton pendingLabel="Converting" className="platform-btn-primary h-9 w-full rounded-[8px] px-3 text-xs font-medium">Convert to order</OperationalSubmitButton>
                            </form>
                          ) : null}

                          {canClose(enquiry) && canAddNote(enquiry) ? (
                            <form action={actions.close} className="grid gap-2">
                              <input type="hidden" name="enquiry_id" value={id} />
                              <textarea name="note" rows={2} placeholder="Close reason (optional)" className="rounded-[8px] border border-[var(--platform-border)] bg-[var(--platform-surface)] px-3 py-2 text-sm" />
                              <OperationalSubmitButton pendingLabel="Closing" className="h-9 rounded-[8px] border border-rose-500/40 px-3 text-xs font-medium text-rose-200">Close enquiry</OperationalSubmitButton>
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
