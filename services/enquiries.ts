import { assertSupabaseAdminConfig } from "@/lib/env";
import { createAdminRecord, fetchAdminRecordsByColumn, updateAdminRecord } from "@/services/admin-actions";
import { buildValidatedOrderDraft, type CheckoutOrderInput, type OrderCatalogProduct } from "@/services/orders";

type JsonRecord = Record<string, unknown>;
type EnvSource = Record<string, string | undefined>;

export type AdminEnquiryRow = JsonRecord & {
  id: string;
  customer_email: string;
  subject: string;
  body: string;
  status: string;
  source: "contact" | "checkout";
  queue_kind: "enquiry" | "checkout_order";
  order_number?: string;
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
    status: text(order.status, "admin_review") === "admin_review" ? "new" : "contacted",
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
  return createAdminRecord(
    "enquiries",
    {
      customer_user_id: input.customerUserId ?? null,
      customer_email: input.customerEmail.trim(),
      subject: input.subject.trim(),
      body: input.body.trim(),
      related_product_slug: input.relatedProductSlug ?? null,
      region: input.region ?? null,
      status: "new",
      payload: { customer_phone: input.customerPhone.trim() }
    },
    actorId,
    env,
    { allowGuest: !actorId }
  );
}

export async function submitCheckoutProductEnquiry(
  input: CheckoutProductEnquiryInput,
  actorId: string | null,
  env: EnvSource = process.env
) {
  const message = input.enquiryMessage.trim();
  const summary = input.productSummary.trim();

  return createAdminRecord(
    "enquiries",
    {
      customer_user_id: input.customerUserId ?? null,
      customer_email: input.customerEmail.trim(),
      subject: `Product enquiry · ${input.orderNumber.trim()}`,
      body: summary ? `${message}\n\nCart: ${summary}` : message,
      related_product_slug: input.relatedProductSlug ?? null,
      region: input.region ?? null,
      status: "new",
      converted_order_id: input.orderId,
      payload: {
        customer_phone: input.customerPhone.trim(),
        source: "checkout",
        order_number: input.orderNumber.trim(),
        order_id: input.orderId
      }
    },
    actorId,
    env,
    { allowGuest: !actorId }
  );
}

export async function listOwnEnquiries(userId: string, env: EnvSource = process.env) {
  const config = assertSupabaseAdminConfig(env);
  const response = await fetch(
    `${config.url}/rest/v1/enquiries?select=id,subject,body,status,related_product_slug,region,created_at,updated_at&customer_user_id=eq.${userId}&order=created_at.desc&limit=50`,
    { headers: headers(config.serviceRoleKey), cache: "no-store" }
  );
  if (!response.ok) return [];
  return (await response.json()) as JsonRecord[];
}

export async function listAdminEnquiries(env: EnvSource = process.env): Promise<AdminEnquiryRow[]> {
  const config = assertSupabaseAdminConfig(env);
  const [enquiriesResponse, ordersResponse] = await Promise.all([
    fetch(
      `${config.url}/rest/v1/enquiries?select=id,customer_email,subject,body,status,related_product_slug,assigned_to,converted_order_id,payload,created_at,updated_at&order=created_at.desc&limit=100`,
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

  const normalizedEnquiries: AdminEnquiryRow[] = enquiries.map((enquiry) => ({
    ...enquiry,
    id: text(enquiry.id),
    customer_email: text(enquiry.customer_email),
    subject: text(enquiry.subject),
    body: text(enquiry.body),
    status: text(enquiry.status, "new"),
    source: text(isPlainRecord(enquiry.payload) ? enquiry.payload.source : "") === "checkout" ? "checkout" : "contact",
    order_number: text(isPlainRecord(enquiry.payload) ? enquiry.payload.order_number : ""),
    queue_kind: "enquiry"
  }));

  const backfilledCheckoutEnquiries = checkoutOrders
    .filter((order) => !linkedOrderIds.has(text(order.id)))
    .map((order) => mapCheckoutOrderToEnquiryRow(order, orderItemsByOrderId.get(text(order.id)) ?? []));

  return [...normalizedEnquiries, ...backfilledCheckoutEnquiries].sort((left, right) => {
    const leftTime = Date.parse(text(left.created_at)) || 0;
    const rightTime = Date.parse(text(right.created_at)) || 0;
    return rightTime - leftTime;
  });
}

export async function assignEnquiry(enquiryId: string, assignedTo: string, actorId: string, env: EnvSource = process.env) {
  return updateAdminRecord(
    "enquiries",
    "id",
    enquiryId,
    { assigned_to: assignedTo, status: "contacted", updated_at: new Date().toISOString() },
    actorId,
    env
  );
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
  await updateAdminRecord(
    "enquiries",
    "id",
    enquiryId,
    {
      status: "converted",
      converted_order_id: orderId,
      updated_at: new Date().toISOString()
    },
    actorId,
    env
  );
  return order;
}

export async function getEnquiryById(enquiryId: string, env: EnvSource = process.env) {
  const rows = await fetchAdminRecordsByColumn("enquiries", "id", enquiryId, env);
  return rows[0] ?? null;
}
