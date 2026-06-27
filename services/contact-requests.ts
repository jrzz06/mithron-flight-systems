import { assertSupabaseAdminConfig } from "@/lib/env";
import {
  type AdminContactRequestRow,
  type ContactRequestNoteEntry,
  type ContactRequestTimelineEntry,
  formatContactRequestReference
} from "@/lib/contact-requests/shared";
import {
  createActivityLogRecord,
  createAdminRecord,
  createNotificationRecord,
  fetchAdminRecordsByColumn,
  updateAdminRecord
} from "@/services/admin-actions";
import { requirePermission } from "@/services/auth";
import { getAdminSettingsPolicy } from "@/services/admin-settings-policy";

export type { AdminContactRequestRow, ContactRequestNoteEntry, ContactRequestTimelineEntry } from "@/lib/contact-requests/shared";
export { formatContactRequestReference } from "@/lib/contact-requests/shared";

export type ContactRequestInput = {
  customerUserId?: string | null;
  customerEmail: string;
  customerPhone: string;
  customerFullName: string;
  customerCompany?: string | null;
  subject: string;
  body: string;
  region?: string | null;
};

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPayload(value: unknown) {
  return isPlainRecord(value) ? value : {};
}

function readTimeline(payload: JsonRecord): ContactRequestTimelineEntry[] {
  const timeline = payload.timeline;
  return Array.isArray(timeline)
    ? timeline.filter(isPlainRecord).map((entry) => ({
      at: text(entry.at),
      action: text(entry.action),
      actor_id: typeof entry.actor_id === "string" ? entry.actor_id : null,
      summary: text(entry.summary),
      status: text(entry.status) || undefined
    }))
    : [];
}

function readNotes(payload: JsonRecord): ContactRequestNoteEntry[] {
  const notes = payload.notes;
  return Array.isArray(notes)
    ? notes.filter(isPlainRecord).map((entry) => ({
      id: text(entry.id, crypto.randomUUID()),
      at: text(entry.at),
      actor_id: text(entry.actor_id),
      body: text(entry.body)
    }))
    : [];
}

function contactMutationOptions(actorId: string | null) {
  return actorId
    ? { guard: () => requirePermission("enquiries.write") }
    : { allowSystemActor: true };
}

async function listAdminRecipientIds(roleKey: string, env: EnvSource) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/user_roles?select=user_id&role_key=eq.${encodeURIComponent(roleKey)}&limit=40`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  const rows = (await response.json()) as Array<{ user_id?: string }>;
  return rows.map((row) => text(row.user_id)).filter(Boolean);
}

async function notifyAdminsAboutContactRequest(
  input: { contactRequestId: string; title: string; body: string; actorId: string | null },
  env: EnvSource = process.env
) {
  const policy = await getAdminSettingsPolicy(env);
  if (!policy.orderAlertsEnabled) return;

  const adminIds = await listAdminRecipientIds("admin", env);
  for (const recipientId of adminIds) {
    await createNotificationRecord(
      {
        recipient_id: recipientId,
        channel: "in_app",
        title: input.title,
        body: input.body,
        status: "unread",
        priority: "high",
        entity_table: "contact_requests",
        entity_id: input.contactRequestId
      },
      input.actorId,
      env
    ).catch(() => undefined);
  }
}

async function loadContactRequest(contactRequestId: string, env: EnvSource) {
  const rows = await fetchAdminRecordsByColumn("contact_requests", "id", contactRequestId, env);
  const row = rows[0];
  if (!row) throw new Error("Contact request not found.");
  return row;
}

async function persistContactRequestUpdate(
  contactRequestId: string,
  input: {
    actorId: string;
    nextStatus?: string;
    assignedTo?: string | null;
    note?: string;
    timelineAction: string;
    timelineSummary: string;
    patch?: JsonRecord;
  },
  env: EnvSource = process.env
) {
  const record = await loadContactRequest(contactRequestId, env);
  const payload = readPayload(record.payload);
  const timeline = readTimeline(payload);
  const notes = readNotes(payload);
  const now = new Date().toISOString();

  timeline.unshift({
    at: now,
    action: input.timelineAction,
    actor_id: input.actorId,
    summary: input.timelineSummary,
    status: input.nextStatus
  });

  if (input.note?.trim()) {
    notes.unshift({
      id: crypto.randomUUID(),
      at: now,
      actor_id: input.actorId,
      body: input.note.trim()
    });
  }

  const updated = await updateAdminRecord(
    "contact_requests",
    "id",
    contactRequestId,
    {
      ...(input.nextStatus ? { status: input.nextStatus } : {}),
      ...(input.assignedTo !== undefined ? { assigned_to: input.assignedTo } : {}),
      payload: { ...payload, timeline, notes },
      updated_at: now,
      ...(input.patch ?? {})
    },
    input.actorId,
    env
  );

  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: `contact_requests.${input.timelineAction}`,
      entity_table: "contact_requests",
      entity_id: contactRequestId,
      severity: "info",
      metadata: { next_status: input.nextStatus ?? text(record.status) }
    },
    input.actorId,
    env
  ).catch(() => undefined);

  return { record, updated };
}

function mapContactRequestRow(row: JsonRecord): AdminContactRequestRow {
  const payload = readPayload(row.payload);
  const requestNumber = typeof row.request_number === "number"
    ? row.request_number
    : Number(row.request_number);

  return {
    id: text(row.id),
    request_number: Number.isFinite(requestNumber) && requestNumber > 0 ? requestNumber : null,
    customer_email: text(row.customer_email),
    customer_full_name: text(row.customer_full_name) || text(payload.customer_full_name),
    customer_company: text(row.customer_company) || text(payload.customer_company),
    customer_phone: text(row.customer_phone) || text(payload.customer_phone),
    subject: text(row.subject),
    body: text(row.body),
    status: text(row.status, "new"),
    assigned_to: text(row.assigned_to) || null,
    converted_order_id: text(row.converted_order_id) || null,
    created_at: text(row.created_at),
    updated_at: text(row.updated_at),
    archived_at: text(row.archived_at) || null,
    deleted_at: text(row.deleted_at) || null,
    timeline: readTimeline(payload),
    notes: readNotes(payload)
  };
}

export async function submitContactRequest(
  input: ContactRequestInput,
  actorId: string | null,
  env: EnvSource = process.env
) {
  const now = new Date().toISOString();
  const record = await createAdminRecord(
    "contact_requests",
    {
      customer_user_id: input.customerUserId ?? null,
      customer_email: input.customerEmail.trim(),
      customer_phone: input.customerPhone.trim(),
      customer_full_name: input.customerFullName.trim(),
      ...(input.customerCompany?.trim() ? { customer_company: input.customerCompany.trim() } : {}),
      subject: input.subject.trim(),
      body: input.body.trim(),
      region: input.region ?? null,
      status: "new",
      payload: {
        source: "contact",
        timeline: [{
          at: now,
          action: "submitted",
          actor_id: actorId,
          summary: "Consultation request submitted.",
          status: "new"
        }],
        notes: []
      }
    },
    actorId,
    env,
    contactMutationOptions(actorId)
  );

  const contactRequestId = text(record.id);
  const requestNumber = typeof record.request_number === "number"
    ? record.request_number
    : Number(record.request_number);
  const reference = formatContactRequestReference(requestNumber);

  if (contactRequestId && Number.isFinite(requestNumber) && requestNumber > 0) {
    await updateAdminRecord(
      "contact_requests",
      "id",
      contactRequestId,
      { subject: `${reference} · ${input.subject.trim()}` },
      actorId,
      env,
      contactMutationOptions(actorId)
    ).catch(() => undefined);
    record.subject = `${reference} · ${input.subject.trim()}`;
  }

  if (contactRequestId) {
    await notifyAdminsAboutContactRequest(
      {
        contactRequestId,
        title: "New contact request",
        body: `${input.customerEmail.trim()} submitted ${reference}: ${input.subject.trim()}`,
        actorId
      },
      env
    );
  }

  return record;
}

export async function listAdminContactRequests(env: EnvSource = process.env): Promise<AdminContactRequestRow[]> {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/contact_requests?select=id,request_number,customer_email,customer_phone,customer_full_name,customer_company,subject,body,status,assigned_to,converted_order_id,payload,archived_at,deleted_at,created_at,updated_at&deleted_at=is.null&order=created_at.desc&limit=100`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  const rows = (await response.json()) as JsonRecord[];
  return rows.map(mapContactRequestRow);
}

export async function markContactRequestContacted(
  contactRequestId: string,
  actorId: string,
  assignedTo: string | null = actorId,
  note?: string,
  env: EnvSource = process.env
) {
  const result = await persistContactRequestUpdate(
    contactRequestId,
    {
      actorId,
      nextStatus: "contacted",
      assignedTo: assignedTo ?? actorId,
      note,
      timelineAction: "contacted",
      timelineSummary: "Admin marked the contact request as contacted."
    },
    env
  );
  return result.updated;
}

export async function archiveContactRequest(
  contactRequestId: string,
  actorId: string,
  note?: string,
  env: EnvSource = process.env
) {
  const result = await persistContactRequestUpdate(
    contactRequestId,
    {
      actorId,
      nextStatus: "archived",
      note,
      timelineAction: "archived",
      timelineSummary: note?.trim() || "Contact request archived.",
      patch: { archived_at: new Date().toISOString() }
    },
    env
  );
  return result.updated;
}

export async function rejectContactRequest(
  contactRequestId: string,
  actorId: string,
  note?: string,
  env: EnvSource = process.env
) {
  const result = await persistContactRequestUpdate(
    contactRequestId,
    {
      actorId,
      nextStatus: "rejected",
      note,
      timelineAction: "rejected",
      timelineSummary: note?.trim() || "Contact request rejected."
    },
    env
  );
  return result.updated;
}

export async function restoreContactRequest(
  contactRequestId: string,
  actorId: string,
  env: EnvSource = process.env
) {
  const result = await persistContactRequestUpdate(
    contactRequestId,
    {
      actorId,
      nextStatus: "new",
      timelineAction: "restored",
      timelineSummary: "Contact request restored.",
      patch: { archived_at: null, deleted_at: null }
    },
    env
  );
  return result.updated;
}

export async function linkContactRequestToOrder(
  contactRequestId: string,
  orderId: string,
  actorId: string,
  env: EnvSource = process.env
) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(`${config.url}/rest/v1/rpc/link_contact_request_to_order`, {
    method: "POST",
    headers: headers(config.serviceRoleKey),
    cache: "no-store",
    body: JSON.stringify({
      p_contact_request_id: contactRequestId,
      p_order_id: orderId,
      p_actor_id: actorId
    })
  });

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Failed to link contact request to order: ${response.status}${body ? ` - ${body.slice(0, 240)}` : ""}`);
  }

  const result = body ? JSON.parse(body) as JsonRecord : {};
  if (result.ok !== true) {
    throw new Error(text(result.error, "Failed to link contact request to order."));
  }

  await createActivityLogRecord(
    {
      actor_id: actorId,
      action: "contact_requests.linked_to_order",
      entity_table: "contact_requests",
      entity_id: contactRequestId,
      severity: "info",
      metadata: { order_id: orderId }
    },
    actorId,
    env
  ).catch(() => undefined);

  return result;
}
