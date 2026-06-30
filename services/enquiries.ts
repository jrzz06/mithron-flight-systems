import { assertSupabaseAdminConfig } from "@/lib/env";
import {
  appendOrderTimelineViaRpc,
  createActivityLogRecord,
  createAdminRecord,
  createNotificationRecord,
  fetchAdminRecordsByColumn,
  updateAdminRecord,
  type AdminMutationOptions
} from "@/services/admin-actions";
import { requirePermission } from "@/services/auth";
import { buildValidatedOrderDraft, type CheckoutOrderInput, type OrderCatalogProduct } from "@/services/orders";
import { resolveCheckoutStockSkus } from "@/services/checkout-stock";
import { notifyCustomerAboutOrder } from "@/services/order-workflow";
import {
  type AdminEnquiryRow,
  type EnquiryTimelineEntry,
  formatEnquiryReference
} from "@/lib/enquiries/shared";

export type { AdminEnquiryRow, EnquiryNoteEntry, EnquiryTimelineEntry } from "@/lib/enquiries/shared";
export { formatEnquiryReference } from "@/lib/enquiries/shared";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

function checkoutEnquiryMutationOptions(actorId: string | null): AdminMutationOptions {
  return actorId
    ? { guard: () => requirePermission("orders.checkout") }
    : { allowSystemActor: true };
}

const enquiryTransitions: Record<string, string[]> = {
  new: ["contacted", "qualified", "converted", "lost"],
  contacted: ["qualified", "won", "lost", "converted"],
  qualified: ["won", "lost", "converted"],
  won: [],
  lost: [],
  converted: []
};

function headers(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json"
  };
}

function isPlainRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readPayload(value: unknown) {
  return isPlainRecord(value) ? value : {};
}

function readTimeline(payload: JsonRecord) {
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

function readNotes(payload: JsonRecord) {
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

export async function notifyAdminsAboutEnquiry(
  input: {
    enquiryId: string;
    title: string;
    body: string;
    actorId: string | null;
  },
  env: EnvSource = process.env
) {
  const { getAdminSettingsPolicy } = await import("@/services/admin-settings-policy");
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
        entity_table: "enquiries",
        entity_id: input.enquiryId
      },
      input.actorId,
      env
    ).catch(() => undefined);
  }
}

export async function notifyAdminsAboutPaidOrder(
  input: {
    orderId: string;
    orderNumber: string;
    actorId?: string | null;
  },
  env: EnvSource = process.env
) {
  const { getAdminSettingsPolicy } = await import("@/services/admin-settings-policy");
  const policy = await getAdminSettingsPolicy(env);
  if (!policy.orderAlertsEnabled) return;

  const adminIds = await listAdminRecipientIds("admin", env);
  for (const recipientId of adminIds) {
    await createNotificationRecord(
      {
        recipient_id: recipientId,
        channel: "in_app",
        title: "New paid order",
        body: `Order ${input.orderNumber} was paid and is ready for review.`,
        status: "unread",
        priority: "high",
        entity_table: "orders",
        entity_id: input.orderId
      },
      input.actorId ?? null,
      env
    ).catch(() => undefined);
  }
}

async function notifyCustomerAboutEnquiry(
  input: {
    customerUserId: string | null;
    customerEmail: string;
    enquiryId: string;
    title: string;
    body: string;
    actorId: string | null;
  },
  env: EnvSource = process.env
) {
  if (!input.customerUserId) return;
  await createNotificationRecord(
    {
      recipient_id: input.customerUserId,
      channel: "customer",
      title: input.title,
      body: input.body,
      status: "unread",
      entity_table: "enquiries",
      entity_id: input.enquiryId,
      metadata: { recipient_email: input.customerEmail }
    },
    input.actorId,
    env
  ).catch(() => undefined);
}

async function logEnquiryActivity(
  input: {
    actorId: string;
    action: string;
    enquiryId: string;
    metadata?: JsonRecord;
  },
  env: EnvSource = process.env
) {
  await createActivityLogRecord(
    {
      actor_id: input.actorId,
      action: input.action,
      entity_table: "enquiries",
      entity_id: input.enquiryId,
      severity: "info",
      metadata: input.metadata ?? {}
    },
    input.actorId,
    env
  ).catch(() => undefined);
}

function assertEnquiryTransition(currentStatus: string, nextStatus: string) {
  const allowed = enquiryTransitions[currentStatus] ?? [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Cannot move enquiry from ${currentStatus} to ${nextStatus}.`);
  }
}

async function loadEnquiryRecord(enquiryId: string, env: EnvSource) {
  const enquiry = await getEnquiryById(enquiryId, env);
  if (!enquiry) throw new Error("Enquiry not found.");
  return enquiry;
}

async function persistEnquiryLifecycleUpdate(
  enquiryId: string,
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
  const enquiry = await loadEnquiryRecord(enquiryId, env);
  const currentStatus = text(enquiry.status, "new");
  const nextStatus = input.nextStatus ?? currentStatus;
  if (input.nextStatus) assertEnquiryTransition(currentStatus, nextStatus);

  const payload = readPayload(enquiry.payload);
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
    "enquiries",
    "id",
    enquiryId,
    {
      ...(input.nextStatus ? { status: input.nextStatus } : {}),
      ...(input.assignedTo !== undefined ? { assigned_to: input.assignedTo } : {}),
      payload: {
        ...payload,
        timeline,
        notes
      },
      updated_at: now,
      ...(input.patch ?? {})
    },
    input.actorId,
    env
  );

  await logEnquiryActivity(
    {
      actorId: input.actorId,
      action: `enquiries.${input.timelineAction}`,
      enquiryId,
      metadata: {
        previous_status: currentStatus,
        next_status: nextStatus,
        note: input.note?.trim() ?? null
      }
    },
    env
  );

  return { enquiry, updated, previousStatus: currentStatus, nextStatus };
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export type EnquiryInput = {
  customerUserId?: string | null;
  customerEmail: string;
  customerPhone: string;
  customerFullName: string;
  customerCompany?: string | null;
  subject: string;
  body: string;
  relatedProductSlug?: string | null;
  region?: string | null;
};

export type CheckoutProductEnquiryInput = {
  customerUserId?: string | null;
  customerEmail: string;
  customerPhone: string;
  customerFullName: string;
  customerCompany?: string | null;
  enquiryMessage: string;
  region?: string | null;
  relatedProductSlug?: string | null;
  cartLines: Array<{
    product_slug: string;
    product_name: string;
    quantity: number;
    sku?: string | null;
  }>;
  guestAddress?: {
    line1: string;
    city: string;
    region: string;
    postalCode: string;
    label?: string;
  } | null;
  addressId?: string | null;
};

export async function submitEnquiry(input: EnquiryInput, actorId: string | null, env: EnvSource = process.env) {
  const now = new Date().toISOString();
  const enquiry = await createAdminRecord(
    "enquiries",
    {
      customer_user_id: input.customerUserId ?? null,
      customer_email: input.customerEmail.trim(),
      subject: input.subject.trim(),
      body: input.body.trim(),
      related_product_slug: input.relatedProductSlug ?? null,
      region: input.region ?? null,
      status: "new",
      payload: {
        customer_phone: input.customerPhone.trim(),
        customer_full_name: input.customerFullName.trim(),
        ...(input.customerCompany?.trim() ? { customer_company: input.customerCompany.trim() } : {}),
        source: "contact",
        enquiry_message: input.body.trim(),
        timeline: [{
          at: now,
          action: "submitted",
          actor_id: actorId,
          summary: "Customer submitted a contact enquiry.",
          status: "new"
        }],
        notes: []
      }
    },
    actorId,
    env,
    checkoutEnquiryMutationOptions(actorId)
  );

  const enquiryId = String(enquiry.id ?? "");
  const enquiryNumber = typeof enquiry.enquiry_number === "number"
    ? enquiry.enquiry_number
    : Number(enquiry.enquiry_number);
  const enquiryReference = formatEnquiryReference(
    Number.isFinite(enquiryNumber) && enquiryNumber > 0 ? enquiryNumber : null
  );

  if (enquiryId && Number.isFinite(enquiryNumber) && enquiryNumber > 0) {
    await updateAdminRecord(
      "enquiries",
      "id",
      enquiryId,
      { subject: `${enquiryReference} · ${input.subject.trim()}` },
      actorId,
      env,
      checkoutEnquiryMutationOptions(actorId)
    ).catch(() => undefined);
    enquiry.subject = `${enquiryReference} · ${input.subject.trim()}`;
    enquiry.enquiry_number = enquiryNumber;
  }

  if (enquiryId) {
    await notifyAdminsAboutEnquiry(
      {
        enquiryId,
        title: "New customer enquiry",
        body: `${input.customerEmail.trim()} submitted ${enquiryReference}: ${input.subject.trim()}`,
        actorId
      },
      env
    );
    if (actorId) {
      await logEnquiryActivity(
        {
          actorId,
          action: "enquiries.submitted",
          enquiryId,
          metadata: { source: "contact", customer_email: input.customerEmail.trim() }
        },
        env
      );
    }
  }

  return enquiry;
}

export async function submitCheckoutProductEnquiry(
  input: CheckoutProductEnquiryInput,
  actorId: string | null,
  env: EnvSource = process.env
) {
  const message = input.enquiryMessage.trim();
  const now = new Date().toISOString();
  const cartSummary = input.cartLines
    .map((line) => `${line.product_name} × ${line.quantity}`)
    .join(", ");

  const enquiry = await createAdminRecord(
    "enquiries",
    {
      customer_user_id: input.customerUserId ?? null,
      customer_email: input.customerEmail.trim(),
      subject: "Product enquiry",
      body: message,
      related_product_slug: input.relatedProductSlug ?? null,
      region: input.region ?? null,
      status: "new",
      enquiry_kind: "checkout",
      converted_order_id: null,
      payload: {
        customer_phone: input.customerPhone.trim(),
        customer_full_name: input.customerFullName.trim(),
        ...(input.customerCompany?.trim() ? { customer_company: input.customerCompany.trim() } : {}),
        source: "checkout",
        enquiry_message: message,
        cart_lines: input.cartLines,
        item_summary: cartSummary,
        shipping_address_id: input.addressId ?? null,
        ...(input.guestAddress ? { guest_shipping_address: input.guestAddress } : {}),
        timeline: [{
          at: now,
          action: "submitted",
          actor_id: actorId,
          summary: "Checkout enquiry submitted.",
          status: "new"
        }],
        notes: []
      }
    },
    actorId,
    env,
    checkoutEnquiryMutationOptions(actorId)
  );

  const enquiryId = String(enquiry.id ?? "");
  const enquiryNumber = typeof enquiry.enquiry_number === "number"
    ? enquiry.enquiry_number
    : Number(enquiry.enquiry_number);
  const enquiryReference = formatEnquiryReference(enquiryNumber);

  if (enquiryId && Number.isFinite(enquiryNumber) && enquiryNumber > 0) {
    const payload = readPayload(enquiry.payload);
    const timeline = readTimeline(payload);
    await updateAdminRecord(
      "enquiries",
      "id",
      enquiryId,
      {
        subject: `Product enquiry · ${enquiryReference}`,
        payload: {
          ...payload,
          timeline: timeline.length
            ? [{ ...timeline[0], summary: `Checkout enquiry linked to ${enquiryReference}.` }, ...timeline.slice(1)]
            : timeline
        }
      },
      actorId,
      env,
      checkoutEnquiryMutationOptions(actorId)
    );
    enquiry.subject = `Product enquiry · ${enquiryReference}`;
    enquiry.enquiry_number = enquiryNumber;
  }

  if (enquiryId) {
    await notifyAdminsAboutEnquiry(
      {
        enquiryId,
        title: "New checkout enquiry",
        body: `${input.customerEmail.trim()} submitted ${enquiryReference}.`,
        actorId
      },
      env
    );
  }

  return enquiry;
}

export async function listOwnEnquiries(userId: string, env: EnvSource = process.env): Promise<Array<JsonRecord & {
  id?: string;
  enquiry_number?: number | null;
  subject?: string;
  body?: string;
  status?: string;
  created_at?: string;
  timeline: EnquiryTimelineEntry[];
}>> {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/enquiries?select=id,enquiry_number,subject,body,status,related_product_slug,region,payload,created_at,updated_at&customer_user_id=eq.${userId}&order=created_at.desc&limit=50`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  const rows = (await response.json()) as JsonRecord[];
  return rows.map((row) => {
    const payload = readPayload(row.payload);
    return {
      ...row,
      timeline: readTimeline(payload)
    };
  });
}

export async function listAdminEnquiries(env: EnvSource = process.env): Promise<AdminEnquiryRow[]> {
  const config = assertSupabaseAdminConfig(env);
  const enquiriesResponse = await fetch(
    `${config.url}/rest/v1/enquiries?select=id,enquiry_number,customer_email,subject,body,status,related_product_slug,assigned_to,converted_order_id,enquiry_kind,payload,created_at,updated_at,archived_at,deleted_at&enquiry_kind=in.(product,checkout)&deleted_at=is.null&order=created_at.desc&limit=100`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );

  const enquiries = enquiriesResponse.ok ? ((await enquiriesResponse.json()) as JsonRecord[]) : [];

  const normalizedEnquiries: AdminEnquiryRow[] = enquiries
    .filter((enquiry) => text(enquiry.payload && isPlainRecord(enquiry.payload) ? enquiry.payload.source : "") !== "contact")
    .map((enquiry) => {
    const payload = readPayload(enquiry.payload);
    const enquiryNumber = typeof enquiry.enquiry_number === "number"
      ? enquiry.enquiry_number
      : Number(enquiry.enquiry_number);
    const cartLines = Array.isArray(payload.cart_lines)
      ? payload.cart_lines
          .filter((line) => line && typeof line === "object" && !Array.isArray(line))
          .map((line) => {
            const record = line as JsonRecord;
            return {
              product_slug: text(record.product_slug),
              product_name: text(record.product_name, text(record.product_slug, "Item")),
              quantity: Number(record.quantity ?? 1) || 1,
              sku: text(record.sku) || null
            };
          })
      : [];
    return {
      ...enquiry,
      id: text(enquiry.id),
      enquiry_number: Number.isFinite(enquiryNumber) && enquiryNumber > 0 ? enquiryNumber : null,
      customer_email: text(enquiry.customer_email),
      customer_full_name: text(payload.customer_full_name),
      customer_company: text(payload.customer_company),
      customer_phone: text(payload.customer_phone),
      subject: text(enquiry.subject),
      body: text(enquiry.body),
      status: text(enquiry.status, "new"),
      source: text(payload.source) === "checkout" || text(enquiry.enquiry_kind) === "checkout" ? "checkout" : "contact",
      order_number: text(payload.order_number),
      order_id: text(enquiry.converted_order_id) || text(payload.order_id) || null,
      related_product_slug: text(enquiry.related_product_slug) || cartLines[0]?.product_slug || null,
      enquiry_message: text(payload.enquiry_message) || text(enquiry.body),
      cart_lines: cartLines,
      priority: text(payload.priority, "normal"),
      assigned_staff: text(payload.assigned_to),
      follow_up_date: text(payload.follow_up_date),
      queue_kind: "enquiry",
      timeline: readTimeline(payload),
      notes: readNotes(payload)
    };
  });

  return normalizedEnquiries.sort((left, right) => {
    const leftTime = Date.parse(text(left.created_at)) || 0;
    const rightTime = Date.parse(text(right.created_at)) || 0;
    return rightTime - leftTime;
  });
}

export async function markEnquiryContacted(
  enquiryId: string,
  actorId: string,
  assignedTo: string | null = actorId,
  note?: string,
  env: EnvSource = process.env
) {
  const result = await persistEnquiryLifecycleUpdate(
    enquiryId,
    {
      actorId,
      nextStatus: "contacted",
      assignedTo: assignedTo ?? actorId,
      note,
      timelineAction: "contacted",
      timelineSummary: "Admin marked the enquiry as contacted."
    },
    env
  );

  const customerUserId = text(result.enquiry.customer_user_id) || null;
  await notifyCustomerAboutEnquiry(
    {
      customerUserId,
      customerEmail: text(result.enquiry.customer_email),
      enquiryId,
      title: "We contacted you about your enquiry",
      body: `Our team has reviewed your enquiry: ${text(result.enquiry.subject)}.`,
      actorId
    },
    env
  );

  const orderId = text(result.enquiry.converted_order_id);
  if (orderId) {
    await appendOrderTimelineViaRpc(
      orderId,
      {
        at: new Date().toISOString(),
        event: "enquiry_contacted",
        actor_id: actorId,
        summary: "Customer enquiry marked as contacted."
      },
      actorId,
      env
    ).catch(() => undefined);
  }

  return result.updated;
}

export async function addEnquiryNote(
  enquiryId: string,
  actorId: string,
  note: string,
  env: EnvSource = process.env
) {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("A note is required.");

  const result = await persistEnquiryLifecycleUpdate(
    enquiryId,
    {
      actorId,
      note: trimmed,
      timelineAction: "note_added",
      timelineSummary: "Internal note recorded."
    },
    env
  );

  return result.updated;
}

export async function qualifyEnquiry(
  enquiryId: string,
  actorId: string,
  note?: string,
  env: EnvSource = process.env
) {
  const result = await persistEnquiryLifecycleUpdate(
    enquiryId,
    {
      actorId,
      nextStatus: "qualified",
      note,
      timelineAction: "qualified",
      timelineSummary: "Enquiry marked as qualified."
    },
    env
  );

  return result.updated;
}

export async function closeEnquiry(
  enquiryId: string,
  actorId: string,
  note?: string,
  env: EnvSource = process.env
) {
  const result = await persistEnquiryLifecycleUpdate(
    enquiryId,
    {
      actorId,
      nextStatus: "lost",
      note,
      timelineAction: "closed",
      timelineSummary: note?.trim() || "Enquiry closed."
    },
    env
  );

  return result.updated;
}

export async function archiveEnquiry(
  enquiryId: string,
  actorId: string,
  note?: string,
  env: EnvSource = process.env
) {
  const result = await persistEnquiryLifecycleUpdate(
    enquiryId,
    {
      actorId,
      timelineAction: "archived",
      timelineSummary: note?.trim() || "Enquiry archived.",
      patch: { archived_at: new Date().toISOString() }
    },
    env
  );
  return result.updated;
}

export async function rejectEnquiry(
  enquiryId: string,
  actorId: string,
  note?: string,
  env: EnvSource = process.env
) {
  const result = await persistEnquiryLifecycleUpdate(
    enquiryId,
    {
      actorId,
      nextStatus: "lost",
      note,
      timelineAction: "rejected",
      timelineSummary: note?.trim() || "Enquiry rejected."
    },
    env
  );
  return result.updated;
}

export async function restoreEnquiry(
  enquiryId: string,
  actorId: string,
  env: EnvSource = process.env
) {
  const result = await persistEnquiryLifecycleUpdate(
    enquiryId,
    {
      actorId,
      timelineAction: "restored",
      timelineSummary: "Enquiry restored.",
      patch: { archived_at: null, deleted_at: null }
    },
    env
  );
  return result.updated;
}

export async function updateEnquiryMeta(
  enquiryId: string,
  actorId: string,
  meta: { priority?: string; assignedTo?: string; followUpDate?: string },
  env: EnvSource = process.env
) {
  const enquiry = await loadEnquiryRecord(enquiryId, env);
  const payload = readPayload(enquiry.payload);
  const now = new Date().toISOString();
  const nextPayload = {
    ...payload,
    ...(meta.priority !== undefined ? { priority: meta.priority } : {}),
    ...(meta.assignedTo !== undefined ? { assigned_to: meta.assignedTo } : {}),
    ...(meta.followUpDate !== undefined ? { follow_up_date: meta.followUpDate } : {})
  };

  await updateAdminRecord(
    "enquiries",
    "id",
    enquiryId,
    {
      updated_at: now,
      ...(meta.assignedTo !== undefined ? { assigned_to: meta.assignedTo || null } : {}),
      payload: nextPayload
    },
    actorId,
    env
  );
}

export async function linkGuestEnquiriesToUser(userId: string, email: string, env: EnvSource = process.env) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!userId || !normalizedEmail) return { linked: 0 };

  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/enquiries?customer_user_id=is.null&customer_email=eq.${encodeURIComponent(normalizedEmail)}`,
    {
      method: "PATCH",
      headers: {
        ...headers(config.serviceRoleKey),
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        customer_user_id: userId,
        updated_at: new Date().toISOString()
      }),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Failed to link guest enquiries: ${response.status}${text ? ` - ${text.slice(0, 200)}` : ""}`);
  }

  const rows = (await response.json()) as JsonRecord[];
  return { linked: rows.length };
}

export async function getOwnEnquiryById(userId: string, enquiryId: string, env: EnvSource = process.env) {
  const enquiry = await getEnquiryById(enquiryId, env);
  if (!enquiry) return null;
  if (String(enquiry.customer_user_id ?? "") !== userId) return null;

  const payload = readPayload(enquiry.payload);
  return {
    ...enquiry,
    timeline: readTimeline(payload),
    notes: readNotes(payload)
  } as JsonRecord & {
    enquiry_number?: number | null;
    subject?: string;
    body?: string;
    status?: string;
    converted_order_id?: string | null;
    created_at?: string;
  };
}

export async function promoteEnquiryToOrder(
  enquiryId: string,
  actorId: string,
  env: EnvSource = process.env
) {
  const enquiry = await loadEnquiryRecord(enquiryId, env);
  const payload = readPayload(enquiry.payload);
  const existingOrderId = text(enquiry.converted_order_id) || text(payload.order_id);

  if (existingOrderId) {
    const orderRows = await fetchAdminRecordsByColumn("orders", "id", existingOrderId, env);
    const order = orderRows[0];
    if (!order) throw new Error("Linked order was not found.");

    const now = new Date().toISOString();
    const metadata = readPayload(order.metadata);
    await updateAdminRecord(
      "orders",
      "id",
      existingOrderId,
      {
        status: "admin_review",
        channel: "checkout",
        metadata: {
          ...metadata,
          source_enquiry_id: enquiryId,
          converted_from_enquiry_at: now
        },
        updated_at: now
      },
      actorId,
      env
    );

    await updateAdminRecord(
      "enquiries",
      "id",
      enquiryId,
      {
        status: "converted",
        converted_order_id: existingOrderId,
        updated_at: now,
        payload: {
          ...payload,
          timeline: [
            {
              at: now,
              action: "converted",
              actor_id: actorId,
              summary: `Enquiry converted to order ${text(order.order_number, existingOrderId)}.`,
              status: "converted"
            },
            ...readTimeline(payload)
          ]
        }
      },
      actorId,
      env
    );

    await logEnquiryActivity(
      {
        actorId,
        action: "enquiries.converted",
        enquiryId,
        metadata: { order_id: existingOrderId }
      },
      env
    );

    return orderRows[0];
  }

  const relatedSlug = text(enquiry.related_product_slug);
  const cartLines = Array.isArray(payload.cart_lines)
    ? payload.cart_lines
        .filter((line) => line && typeof line === "object" && !Array.isArray(line))
        .map((line) => {
          const record = line as JsonRecord;
          const productSlug = text(record.product_slug);
          const quantity = Number(record.quantity ?? 1);
          if (!productSlug || !Number.isInteger(quantity) || quantity <= 0) return null;
          return { productSlug, quantity };
        })
        .filter((line): line is { productSlug: string; quantity: number } => Boolean(line))
    : [];

  if (cartLines.length) {
    const { getCheckoutPricingBySlugs } = await import("@/services/catalog");
    const catalog = await getCheckoutPricingBySlugs(cartLines.map((line) => line.productSlug));
    if (!catalog.length) {
      throw new Error("Products in this enquiry are no longer available in the catalog.");
    }

    const itemsWithSku = await resolveCheckoutStockSkus(cartLines, env);
    const draft = buildValidatedOrderDraft(
      {
        customerEmail: text(enquiry.customer_email),
        phone: text(payload.customer_phone) || undefined,
        region: text(enquiry.region) || undefined,
        items: itemsWithSku.map((item) => ({
          productSlug: item.productSlug,
          quantity: item.quantity,
          sku: item.sku ?? undefined
        })),
        metadata: {
          source_enquiry_id: enquiryId,
          customer_full_name: text(payload.customer_full_name),
          customer_company: text(payload.customer_company),
          customer_phone: text(payload.customer_phone),
          enquiry_message: text(payload.enquiry_message),
          ...(payload.guest_shipping_address ? { guest_shipping_address: payload.guest_shipping_address } : {}),
          shipping_address_id: payload.shipping_address_id ?? null
        }
      },
      catalog
    );

    return convertEnquiryToOrderAtomic(
      enquiryId,
      {
        ...draft.order,
        status: "admin_review",
        created_by_user_id: text(enquiry.customer_user_id) || null,
        metadata: {
          ...draft.order.metadata,
          source_enquiry_id: enquiryId,
          created_by_user_id: text(enquiry.customer_user_id) || null
        }
      },
      draft.orderItems,
      actorId,
      env,
      `convert:${enquiryId}`
    );
  }

  if (!relatedSlug) {
    throw new Error("This enquiry has no linked order or product. Add a related product before converting.");
  }

  const { getCheckoutPricingBySlugs } = await import("@/services/catalog");
  const catalog = await getCheckoutPricingBySlugs([relatedSlug]);
  if (!catalog.length) {
    throw new Error(`Product "${relatedSlug}" was not found in the catalog.`);
  }

  const itemsWithSku = await resolveCheckoutStockSkus([{ productSlug: relatedSlug, quantity: 1 }], env);
  const draft = buildValidatedOrderDraft(
    {
      customerEmail: text(enquiry.customer_email),
      phone: text(payload.customer_phone) || undefined,
      region: text(enquiry.region) || undefined,
      items: itemsWithSku.map((item) => ({
        productSlug: item.productSlug,
        quantity: item.quantity,
        sku: item.sku ?? undefined
      })),
      metadata: { source_enquiry_id: enquiryId }
    },
    catalog
  );

  return convertEnquiryToOrderAtomic(
    enquiryId,
    {
      ...draft.order,
      status: "admin_review",
      created_by_user_id: text(enquiry.customer_user_id) || null,
      metadata: {
        ...draft.order.metadata,
        source_enquiry_id: enquiryId,
        created_by_user_id: text(enquiry.customer_user_id) || null
      }
    },
    draft.orderItems,
    actorId,
    env,
    `convert:${enquiryId}`
  );
}

export async function promoteCheckoutOrderEnquiry(
  orderId: string,
  actorId: string,
  env: EnvSource = process.env
) {
  const orderRows = await fetchAdminRecordsByColumn("orders", "id", orderId, env);
  const order = orderRows[0];
  if (!order) throw new Error("Checkout enquiry order was not found.");

  const now = new Date().toISOString();
  const metadata = readPayload(order.metadata);
  await updateAdminRecord(
    "orders",
    "id",
    orderId,
    {
      status: "admin_review",
      channel: "checkout",
      metadata: {
        ...metadata,
        converted_from_enquiry_at: now
      },
      updated_at: now
    },
    actorId,
    env
  );

  const linkedEnquiries = await fetchAdminRecordsByColumn("enquiries", "converted_order_id", orderId, env);
  if (linkedEnquiries[0]) {
    const enquiryId = text(linkedEnquiries[0].id);
    const enquiryPayload = readPayload(linkedEnquiries[0].payload);
    await updateAdminRecord(
      "enquiries",
      "id",
      enquiryId,
      {
        status: "converted",
        converted_order_id: orderId,
        updated_at: now,
        payload: {
          ...enquiryPayload,
          timeline: [
            {
              at: now,
              action: "converted",
              actor_id: actorId,
              summary: `Checkout enquiry converted to order ${text(order.order_number, orderId)}.`,
              status: "converted"
            },
            ...readTimeline(enquiryPayload)
          ]
        }
      },
      actorId,
      env
    );
  }

  return order;
}

export async function markCheckoutOrderEnquiryContacted(
  orderId: string,
  actorId: string,
  note?: string,
  env: EnvSource = process.env
) {
  const linked = await fetchAdminRecordsByColumn("enquiries", "converted_order_id", orderId, env);
  if (linked[0]) {
    return markEnquiryContacted(String(linked[0].id ?? ""), actorId, actorId, note, env);
  }

  const config = assertSupabaseAdminConfig(env);
  const orderResponse = await fetch(
    `${config.url}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=id,status,metadata&limit=1`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!orderResponse.ok) {
    throw new Error(`Failed to load checkout enquiry order ${orderId}.`);
  }
  const orders = (await orderResponse.json()) as JsonRecord[];
  const order = orders[0];
  if (!order) throw new Error(`Checkout enquiry order ${orderId} was not found.`);

  const now = new Date().toISOString();
  const metadata = readPayload(order.metadata);
  await updateAdminRecord(
    "orders",
    "id",
    orderId,
    {
      status: text(order.status, "admin_review") === "admin_review" ? "confirmed" : text(order.status, "confirmed"),
      metadata: {
        ...metadata,
        enquiry_contacted_at: now,
        enquiry_contacted_note: note?.trim() || null
      },
      updated_at: now
    },
    actorId,
    env
  );

  await appendOrderTimelineViaRpc(
    orderId,
    {
      at: now,
      event: "enquiry_contacted",
      actor_id: actorId,
      summary: note?.trim() || "Checkout enquiry marked as contacted."
    },
    actorId,
    env
  );

  await logEnquiryActivity(
    {
      actorId,
      action: "enquiries.contacted",
      enquiryId: orderId,
      metadata: { source: "checkout_order_backfill", order_id: orderId }
    },
    env
  );

  return { order_id: orderId, status: "contacted" };
}

/** @deprecated Use markEnquiryContacted instead. */
export async function assignEnquiry(enquiryId: string, assignedTo: string, actorId: string, env: EnvSource = process.env) {
  return markEnquiryContacted(enquiryId, actorId, assignedTo, undefined, env);
}

export async function convertEnquiryToOrderAtomic(
  enquiryId: string,
  order: JsonRecord,
  orderItems: JsonRecord[],
  actorId: string,
  env: EnvSource = process.env,
  idempotencyKey?: string | null
) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(`${config.url}/rest/v1/rpc/convert_enquiry_to_order_atomic`, {
    method: "POST",
    headers: headers(config.serviceRoleKey),
    cache: "no-store",
    body: JSON.stringify({
      p_enquiry_id: enquiryId,
      p_actor_id: actorId,
      p_order: order,
      p_order_items: orderItems,
      p_idempotency_key: idempotencyKey ?? null
    })
  });

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(`Enquiry conversion failed: ${response.status}${body ? ` - ${body.slice(0, 240)}` : ""}`);
  }

  const result = body ? JSON.parse(body) as JsonRecord : {};
  if (result.ok !== true) {
    throw new Error(text(result.error, "Enquiry conversion failed."));
  }

  const orderId = text(result.order_id);
  const orderRow = isPlainRecord(result.row) ? result.row : { id: orderId, order_number: result.order_number };

  if (orderId && result.idempotent !== true) {
    const enquiry = await getEnquiryById(enquiryId, env);
    const customerUserId = text(enquiry?.customer_user_id) || null;
    const orderNumber = String(orderRow.order_number ?? orderId);
    await notifyCustomerAboutOrder(
      { ...orderRow, created_by_user_id: customerUserId, customer_email: text(order.customer_email) },
      "Order created",
      `Your enquiry was converted to order ${orderNumber}. We will follow up with fulfillment details.`,
      actorId,
      env
    );
  }

  await logEnquiryActivity(
    {
      actorId,
      action: "enquiries.converted",
      enquiryId,
      metadata: { order_id: orderId, idempotent: result.idempotent === true }
    },
    env
  );

  return orderRow;
}

export async function convertEnquiryToOrder(
  enquiryId: string,
  checkoutInput: CheckoutOrderInput,
  catalogProducts: OrderCatalogProduct[],
  actorId: string,
  env: EnvSource = process.env
) {
  const enquiry = await loadEnquiryRecord(enquiryId, env);
  const customerUserId = text(enquiry.customer_user_id) || null;
  const itemsWithSku = await resolveCheckoutStockSkus(
    checkoutInput.items.map((item) => ({ productSlug: item.productSlug, quantity: item.quantity })),
    env
  );
  const draft = buildValidatedOrderDraft(
    {
      ...checkoutInput,
      items: itemsWithSku.map((item) => ({
        productSlug: item.productSlug,
        quantity: item.quantity,
        sku: item.sku ?? undefined
      }))
    },
    catalogProducts
  );
  const order = await createAdminRecord(
    "orders",
    {
      ...draft.order,
      status: "admin_review",
      created_by_user_id: customerUserId,
      metadata: {
        ...draft.order.metadata,
        source_enquiry_id: enquiryId,
        created_by_user_id: customerUserId
      }
    },
    actorId,
    env
  );
  const orderId = String(order.id ?? "");
  for (const item of draft.orderItems) {
    await createAdminRecord("order_items", { ...item, order_id: orderId }, actorId, env);
  }

  const payload = readPayload(enquiry.payload);
  const now = new Date().toISOString();
  await updateAdminRecord(
    "enquiries",
    "id",
    enquiryId,
    {
      status: "converted",
      converted_order_id: orderId,
      updated_at: now,
      payload: {
        ...payload,
        timeline: [
          {
            at: now,
            action: "converted",
            actor_id: actorId,
            summary: `Enquiry converted to order ${String(order.order_number ?? orderId)}.`,
            status: "converted"
          },
          ...readTimeline(payload)
        ]
      }
    },
    actorId,
    env
  );
  await logEnquiryActivity(
    {
      actorId,
      action: "enquiries.converted",
      enquiryId,
      metadata: { order_id: orderId }
    },
    env
  );

  const orderNumber = String(order.order_number ?? orderId);
  await notifyCustomerAboutOrder(
    { ...order, created_by_user_id: customerUserId, customer_email: draft.order.customer_email },
    "Order created",
    `Your enquiry was converted to order ${orderNumber}. We will follow up with fulfillment details.`,
    actorId,
    env
  );

  return order;
}

export async function getEnquiryById(enquiryId: string, env: EnvSource = process.env) {
  const rows = await fetchAdminRecordsByColumn("enquiries", "id", enquiryId, env);
  return rows[0] ?? null;
}
