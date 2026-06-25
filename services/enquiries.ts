import { assertSupabaseAdminConfig } from "@/lib/env";
import {
  appendOrderTimelineViaRpc,
  createActivityLogRecord,
  createAdminRecord,
  createNotificationRecord,
  fetchAdminRecordsByColumn,
  updateAdminRecord
} from "@/services/admin-actions";
import { buildValidatedOrderDraft, type CheckoutOrderInput, type OrderCatalogProduct } from "@/services/orders";
import {
  type AdminEnquiryRow,
  type EnquiryTimelineEntry,
  formatEnquiryReference
} from "@/lib/enquiries/shared";

export type { AdminEnquiryRow, EnquiryNoteEntry, EnquiryTimelineEntry } from "@/lib/enquiries/shared";
export { formatEnquiryReference } from "@/lib/enquiries/shared";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

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

function mapCheckoutOrderToEnquiryRow(order: JsonRecord, orderItems: JsonRecord[]): AdminEnquiryRow {
  const metadata = isPlainRecord(order.metadata) ? order.metadata : {};
  const items = orderItems.filter(isPlainRecord);
  const firstItem = items[0];
  const itemSummary = items
    .map((item) => `${text(item.product_name, text(item.product_slug, "Item"))} x ${String(item.quantity ?? 1)}`)
    .join(", ");
  const enquiryMessage = text(metadata.enquiry_message);
  const orderNumber = text(order.order_number, text(order.id));

  return {
    id: text(order.id),
    customer_email: text(order.customer_email),
    subject: `Product enquiry · ${orderNumber}`,
    body: enquiryMessage || (itemSummary ? `Checkout enquiry for ${itemSummary}.` : "Checkout product enquiry."),
    status: text(order.status, "admin_review") === "admin_review" && !text(metadata.enquiry_contacted_at)
      ? "new"
      : "contacted",
    related_product_slug: text(firstItem?.product_slug) || null,
    assigned_to: null,
    converted_order_id: text(order.id) || null,
    created_at: text(order.created_at),
    updated_at: text(order.updated_at),
    payload: {
      source: "checkout",
      order_number: orderNumber,
      customer_phone: text(metadata.customer_phone),
      item_summary: itemSummary
    },
    source: "checkout",
    order_number: orderNumber,
    queue_kind: "checkout_order"
  };
}

export type EnquiryInput = {
  customerUserId?: string | null;
  customerEmail: string;
  customerPhone: string;
  subject: string;
  body: string;
  relatedProductSlug?: string | null;
  region?: string | null;
};

export type CheckoutProductEnquiryInput = {
  customerUserId?: string | null;
  customerEmail: string;
  customerPhone: string;
  enquiryMessage: string;
  orderId: string;
  orderNumber: string;
  region?: string | null;
  relatedProductSlug?: string | null;
  productSummary: string;
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
        source: "contact",
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
    { allowGuest: !actorId }
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
      env
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
  const summary = input.productSummary.trim();
  const now = new Date().toISOString();

  const enquiry = await createAdminRecord(
    "enquiries",
    {
      customer_user_id: input.customerUserId ?? null,
      customer_email: input.customerEmail.trim(),
      subject: "Product enquiry",
      body: summary ? `${message}\n\nCart: ${summary}` : message,
      related_product_slug: input.relatedProductSlug ?? null,
      region: input.region ?? null,
      status: "new",
      converted_order_id: input.orderId,
      payload: {
        customer_phone: input.customerPhone.trim(),
        source: "checkout",
        order_number: input.orderNumber.trim(),
        order_id: input.orderId,
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
    { allowGuest: !actorId }
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
      env
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
  const [enquiriesResponse, ordersResponse] = await Promise.all([
    fetch(
      `${config.url}/rest/v1/enquiries?select=id,enquiry_number,customer_email,subject,body,status,related_product_slug,assigned_to,converted_order_id,payload,created_at,updated_at&order=created_at.desc&limit=100`,
      { headers: headers(config.serviceRoleKey), cache: "no-store" }
    ),
    fetch(
      `${config.url}/rest/v1/orders?select=id,order_number,customer_email,status,metadata,created_at,updated_at&channel=eq.enquiry&order=created_at.desc&limit=100`,
      { headers: headers(config.serviceRoleKey), cache: "no-store" }
    )
  ]);

  const enquiries = enquiriesResponse.ok ? ((await enquiriesResponse.json()) as JsonRecord[]) : [];
  const checkoutOrders = ordersResponse.ok ? ((await ordersResponse.json()) as JsonRecord[]) : [];
  const checkoutOrderIds = checkoutOrders.map((order) => text(order.id)).filter(Boolean);
  const orderItemsByOrderId = new Map<string, JsonRecord[]>();

  if (checkoutOrderIds.length) {
    const itemsResponse = await fetch(
      `${config.url}/rest/v1/order_items?select=order_id,product_slug,product_name,quantity&order_id=in.(${checkoutOrderIds.map((id) => encodeURIComponent(id)).join(",")})`,
      { headers: headers(config.serviceRoleKey), cache: "no-store" }
    );
    if (itemsResponse.ok) {
      const orderItems = (await itemsResponse.json()) as JsonRecord[];
      for (const item of orderItems) {
        const orderId = text(item.order_id);
        if (!orderId) continue;
        const bucket = orderItemsByOrderId.get(orderId) ?? [];
        bucket.push(item);
        orderItemsByOrderId.set(orderId, bucket);
      }
    }
  }

  const linkedOrderIds = new Set(
    enquiries
      .map((enquiry) => text(enquiry.converted_order_id))
      .filter(Boolean)
  );

  const normalizedEnquiries: AdminEnquiryRow[] = enquiries.map((enquiry) => {
    const payload = readPayload(enquiry.payload);
    const enquiryNumber = typeof enquiry.enquiry_number === "number"
      ? enquiry.enquiry_number
      : Number(enquiry.enquiry_number);
    return {
      ...enquiry,
      id: text(enquiry.id),
      enquiry_number: Number.isFinite(enquiryNumber) && enquiryNumber > 0 ? enquiryNumber : null,
      customer_email: text(enquiry.customer_email),
      subject: text(enquiry.subject),
      body: text(enquiry.body),
      status: text(enquiry.status, "new"),
      source: text(payload.source) === "checkout" ? "checkout" : "contact",
      order_number: text(payload.order_number),
      queue_kind: "enquiry",
      timeline: readTimeline(payload),
      notes: readNotes(payload)
    };
  });

  const backfilledCheckoutEnquiries = checkoutOrders
    .filter((order) => !linkedOrderIds.has(text(order.id)))
    .map((order) => mapCheckoutOrderToEnquiryRow(order, orderItemsByOrderId.get(text(order.id)) ?? []));

  return [...normalizedEnquiries, ...backfilledCheckoutEnquiries].sort((left, right) => {
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
  if (!relatedSlug) {
    throw new Error("This enquiry has no linked order or product. Add a related product before converting.");
  }

  const { getCheckoutPricingBySlugs } = await import("@/services/catalog");
  const catalog = await getCheckoutPricingBySlugs([relatedSlug]);
  if (!catalog.length) {
    throw new Error(`Product "${relatedSlug}" was not found in the catalog.`);
  }

  return convertEnquiryToOrder(
    enquiryId,
    {
      customerEmail: text(enquiry.customer_email),
      phone: text(payload.customer_phone) || undefined,
      region: text(enquiry.region) || undefined,
      items: [{ productSlug: relatedSlug, quantity: 1 }],
      metadata: { source_enquiry_id: enquiryId }
    },
    catalog,
    actorId,
    env
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

export async function convertEnquiryToOrder(
  enquiryId: string,
  checkoutInput: CheckoutOrderInput,
  catalogProducts: OrderCatalogProduct[],
  actorId: string,
  env: EnvSource = process.env
) {
  const draft = buildValidatedOrderDraft(checkoutInput, catalogProducts);
  const order = await createAdminRecord(
    "orders",
    {
      ...draft.order,
      status: "admin_review",
      metadata: {
        ...draft.order.metadata,
        source_enquiry_id: enquiryId
      }
    },
    actorId,
    env
  );
  const orderId = String(order.id ?? "");
  for (const item of draft.orderItems) {
    await createAdminRecord("order_items", { ...item, order_id: orderId }, actorId, env);
  }

  const enquiry = await loadEnquiryRecord(enquiryId, env);
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
  return order;
}

export async function getEnquiryById(enquiryId: string, env: EnvSource = process.env) {
  const rows = await fetchAdminRecordsByColumn("enquiries", "id", enquiryId, env);
  return rows[0] ?? null;
}
